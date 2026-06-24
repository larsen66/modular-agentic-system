// src/kernel/index.ts
// The Kernel facade. The ONLY policy surface the server talks to:
//   runMessage(config, prompt, sink) → resolve refs → provision → run → pump → settle.
// Substrate- and harness-agnostic. Grep-clean: no container_id / dockerode /
// workspace_dir / e2b anywhere in this directory.

import { randomUUID } from 'node:crypto';
import {
  listEnvironments,
  listHarnesses,
  resolveEnvironment,
  resolveHarness,
} from '../registry/index.js';
import type { Delegator, EngineEvent, EnvLogger, ExecutionTopology, RunContext } from '../types/index.js';
import { Admission } from './admission.js';
import { SessionManager, type SessionConfig } from './session.js';
import { PrewarmPool, type PrewarmRequest, type PrewarmStatus } from './prewarmPool.js';
import { Orchestrator } from './orchestrator.js';
import { PreviewRegistry, type PreviewState } from './preview.js';
import { previewSnapshotStore, type ResolvedFile } from './previewSnapshot.js';
import type { RunResult } from './settlement.js';

export type { SessionConfig } from './session.js';
export type { RunResult } from './settlement.js';

export interface RunHandle {
  runId: string;
  result: Promise<RunResult>;
  cancel: () => void;
}

// How deep PI→sub-agent→sub-agent recursion may go. depth 0 = the entry agent;
// the cap stops a runaway delegation chain (PI also guards this harness-side).
const MAX_DELEGATION_DEPTH = 2;

export class Kernel {
  private readonly admission = new Admission();
  // Project-open warm pool — declared BEFORE sessions so the field initializer
  // can hand it to the SessionManager (class fields init in declaration order).
  private readonly prewarm = new PrewarmPool();
  private readonly sessions = new SessionManager(this.prewarm);
  private readonly preview = new PreviewRegistry();
  private readonly orchestrator = new Orchestrator({ preview: this.preview });
  // parentSessionId → ( `${harness}::${env}` → childSessionId ). Child workspaces
  // are reused across delegate calls within a session and torn down with it.
  private readonly childSessions = new Map<string, Map<string, string>>();

  listHarnesses(): string[] {
    return listHarnesses();
  }
  listEnvironments(): string[] {
    return listEnvironments();
  }

  // The execution-topology matrix the Studio uses to drive the toggle: which
  // topologies each harness supports, and which environments can host an agent
  // runtime (the gate for agent-in-sandbox). A consumer composes valid
  // (harness, env, topology) triples: agent-as-tool is valid on ANY env for a
  // harness that supports it; agent-in-sandbox is valid only where
  // hostsAgentRuntime is true. Derived from live adapter capabilities — never a
  // hand-maintained list, so it cannot drift from what actually runs.
  describeTopologies(): {
    harnesses: { ref: string; topologies: ExecutionTopology[]; defaultTopology: ExecutionTopology }[];
    environments: { ref: string; hostsAgentRuntime: boolean }[];
  } {
    const harnesses = listHarnesses().flatMap((ref) => {
      try {
        const c = resolveHarness(ref).capabilities;
        return [{ ref, topologies: c.topologies, defaultTopology: c.defaultTopology }];
      } catch {
        return []; // a broken/optional factory never breaks the listing
      }
    });
    const environments = listEnvironments().flatMap((ref) => {
      try {
        return [{ ref, hostsAgentRuntime: resolveEnvironment(ref).capabilities.hostsAgentRuntime }];
      } catch {
        return [];
      }
    });
    return { harnesses, environments };
  }
  // Owner-scoped when `ownerId` is supplied: if the live session belongs to a
  // different owner, SessionManager.get throws SessionOwnershipError (→ 404 at
  // the transport). When the session is already gone we fall back to the
  // preview registry (no live owner to check against).
  getPreviewUrl(sessionId: string, ownerId?: string): string | null {
    if (ownerId) this.sessions.get(sessionId, ownerId); // throws on cross-owner
    return this.preview.get(sessionId)?.url || null;
  }

  // Full preview state (live url + durable snapshot pointer). Owner-scoped the
  // same way getPreviewUrl is: while the session is live, a cross-owner read
  // throws SessionOwnershipError; once the session is gone we fall back to the
  // registry (no live owner to check). The transport turns the snapshotId into a
  // same-origin static URL — the kernel never builds URLs.
  getPreview(sessionId: string, ownerId?: string): PreviewState | null {
    if (ownerId) this.sessions.get(sessionId, ownerId); // throws on cross-owner
    return this.preview.get(sessionId) ?? null;
  }

  // Resolve one file inside the session's durable snapshot to an on-disk path
  // the transport can stream. Owner-scoped; returns null when there is no
  // snapshot or the file is absent (404 either way — no existence leak).
  readPreviewFile(sessionId: string, ownerId: string | undefined, relPath: string): ResolvedFile | null {
    if (ownerId) this.sessions.get(sessionId, ownerId); // throws on cross-owner
    const snapshotId = this.preview.get(sessionId)?.snapshotId;
    if (!snapshotId) return null;
    return previewSnapshotStore().resolve(snapshotId, relPath);
  }

  // Pre-provision (warm) a session's workspace ahead of the first message, so the
  // cold sandbox cost (e2b cold start = seconds) is paid while the user is still
  // typing, not on send. Idempotent: ensureWorkspace reuses an existing handle for
  // the same (sessionId, env), so the subsequent runMessage finds it warm. `logger`
  // streams the substrate lifecycle to the caller (optional). Best-effort — a warm
  // failure must NOT block; the run path re-provisions and surfaces errors there.
  async warmSession(config: SessionConfig, logger?: EnvLogger): Promise<void> {
    await this.sessions.ensureWorkspace(config, logger);
  }

  // Project-OPEN warm pool: keep N sandboxes ready (full git clone of the project)
  // BEFORE any chat exists, so opening a chat adopts one instantly via
  // SessionManager.ensureWorkspace. Unlike warmSession (keyed to one sessionId),
  // this is keyed to the project — a chat created later under any new sessionId
  // claims it as long as (owner, env, runtimeProfile, projectId) match. Returns
  // immediately; provisioning happens in the background. `target` overrides the
  // pool size (env PREWARM_POOL_SIZE) for this project.
  prewarmProject(req: PrewarmRequest, target?: number, logger?: EnvLogger): PrewarmStatus {
    return this.prewarm.ensure(req, target, logger);
  }

  // Snapshot of the warm pool (per-key ready/provisioning counts) for /healthz.
  prewarmStats(): PrewarmStatus[] {
    return this.prewarm.stats();
  }

  // Tear down every warm handle (process shutdown).
  async destroyPrewarmPool(): Promise<void> {
    await this.prewarm.destroyAll();
  }

  // Build the delegation context handed to a MAIN/router harness (pi). The
  // Delegator re-enters the SAME orchestrator for a sub-task on a DIFFERENT
  // (harness, env, topology), on a child session/workspace. Sub-run non-terminal
  // events are forwarded as nested progress (usage_delta rolls up into the
  // parent's billing via Settlement); the sub-run's terminal is CONSUMED so it
  // never settles the parent run. Recurses with depth+1 so a delegated PI can
  // itself delegate — until MAX_DELEGATION_DEPTH.
  private buildRunContext(parentSessionId: string, ownerId: string | undefined, depth: number): RunContext {
    const delegate: Delegator = async (req, onEvent, signal) => {
      if (depth >= MAX_DELEGATION_DEPTH) {
        return {
          cause: 'error',
          finalText: '',
          error: {
            code: 'max_delegation_depth',
            message: `delegation depth ${depth} exceeds cap ${MAX_DELEGATION_DEPTH}`,
          },
        };
      }

      const childRunId = randomUUID();
      // Reuse one child workspace per (harness, env) within this parent session.
      const reuseKey = `${req.harness}::${req.environment}`;
      let children = this.childSessions.get(parentSessionId);
      if (!children) {
        children = new Map();
        this.childSessions.set(parentSessionId, children);
      }
      let childSessionId = children.get(reuseKey);
      if (!childSessionId) {
        childSessionId = `${parentSessionId}:sub:${randomUUID().slice(0, 8)}`;
        children.set(reuseKey, childSessionId);
      }

      onEvent({ type: 'child_started', childRunId });

      // Consume the child terminal; forward everything else (incl. usage_delta).
      const childSink = (ev: EngineEvent): void => {
        if (ev.type === 'terminal') return;
        onEvent(ev);
      };

      try {
        const handle = await this.sessions.ensureWorkspace({
          sessionId: childSessionId,
          runId: childRunId,
          ownerId,
          harness: req.harness,
          environment: req.environment,
          topology: req.topology,
          model: req.model,
          source: { kind: 'files', files: [] },
        });
        const result = await this.orchestrator.run({
          runId: childRunId,
          sessionId: childSessionId,
          harnessRef: req.harness,
          prompt: req.task,
          model: req.model,
          topology: req.topology,
          handle,
          signal,
          ctx: this.buildRunContext(childSessionId, ownerId, depth + 1),
          emit: childSink,
        });
        onEvent({ type: 'child_settled', childRunId, cause: result.cause });
        return { cause: result.cause, finalText: result.finalText, error: result.error };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        onEvent({ type: 'child_settled', childRunId, cause: 'error' });
        return { cause: 'error', finalText: '', error: { code: 'delegate_failed', message } };
      }
    };

    return { delegate, depth, catalog: this.describeTopologies() };
  }

  // One user message = one intent. Returns immediately with a RunHandle whose
  // `result` resolves when settlement fires. Events stream to `sink` as they go.
  runMessage(
    config: SessionConfig,
    prompt: string,
    sink: (ev: EngineEvent) => void
  ): RunHandle {
    // Honour a caller-supplied run id (transport pre-generates it to persist the
    // run row + stamp admission.principal before streaming). Falls back to a
    // fresh uuid for internal callers.
    const runId = config.runId ?? randomUUID();

    // Admission: reject a second concurrent run for the same session.
    const decision = this.admission.admit(config.sessionId);
    if (!decision.ok) {
      const result = Promise.resolve<RunResult>({
        runId,
        cause: 'error',
        finalText: '',
        usage: { inputTokens: 0, outputTokens: 0 },
        cost: 0,
        error: { code: decision.code ?? 'rejected', message: 'Run already active for session.' },
      });
      // Still emit a terminal so the SSE consumer settles.
      sink({
        type: 'terminal',
        cause: 'error',
        error: { code: decision.code ?? 'rejected', message: 'Run already active for session.' },
      });
      return { runId, result, cancel: () => {} };
    }

    const controller = new AbortController();

    // Diagnostics sink: stamp + forward as a `log` EngineEvent. Used for kernel
    // run lifecycle and (via ensureWorkspace) the env adapter's substrate
    // lifecycle. Additive — never touches settlement/billing.
    const log = (category: 'kernel' | 'env', level: 'info' | 'warn' | 'error', message: string) =>
      sink({ type: 'log', category, level, message, at: Date.now() });
    const envLogger = (level: 'info' | 'warn' | 'error', message: string) =>
      log('env', level, message);

    const result = (async (): Promise<RunResult> => {
      try {
        log('kernel', 'info', `run started · harness=${config.harness} · environment=${config.environment}`);
        const handle = await this.sessions.ensureWorkspace(config, envLogger);
        log('kernel', 'info', 'workspace ready · invoking harness');
        const r = await this.orchestrator.run({
          runId,
          sessionId: config.sessionId,
          harnessRef: config.harness,
          prompt,
          model: config.model,
          topology: config.topology,
          toolRefs: config.toolRefs,
          skillRefs: config.skillRefs,
          // The entry agent (depth 0) is the router: hand it the delegation seam —
          // UNLESS delegation is explicitly disabled (the lean build path), where
          // pi runs as a pure builder with no Delegator (no delegate tool/preamble).
          ctx:
            config.delegation === false
              ? undefined
              : this.buildRunContext(config.sessionId, config.ownerId, 0),
          handle,
          signal: controller.signal,
          emit: sink,
        });
        log(
          'kernel',
          r.cause === 'error' ? 'error' : 'info',
          `run settled · cause=${r.cause} · tokens in=${r.usage.inputTokens} out=${r.usage.outputTokens} · cost=$${r.cost}`
        );
        return r;
      } catch (err) {
        // Provisioning itself failed — settlement still owes a terminal.
        const message = err instanceof Error ? err.message : String(err);
        log('kernel', 'error', `run failed during provisioning: ${message}`);
        sink({ type: 'terminal', cause: 'error', error: { code: 'provision_failed', message } });
        return {
          runId,
          cause: 'error',
          finalText: '',
          usage: { inputTokens: 0, outputTokens: 0 },
          cost: 0,
          error: { code: 'provision_failed', message },
        };
      } finally {
        this.admission.release(config.sessionId);
      }
    })();

    return { runId, result, cancel: () => controller.abort() };
  }

  // Lifecycle: tear down a session's workspace handle AND every child workspace
  // a router run spun up under it (reused per (harness, env) during delegation).
  async endSession(sessionId: string): Promise<void> {
    this.preview.clear(sessionId);
    const children = this.childSessions.get(sessionId);
    if (children) {
      for (const childSessionId of children.values()) {
        this.preview.clear(childSessionId);
        await this.sessions.end(childSessionId).catch(() => {});
      }
      this.childSessions.delete(sessionId);
    }
    await this.sessions.end(sessionId);
  }
}
