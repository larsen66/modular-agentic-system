import { useEffect, useId, useRef, useState } from 'react';
import mermaid from 'mermaid';

// One-time mermaid config. startOnLoad:false because we render imperatively
// into a ref (React owns the DOM); 'neutral' theme matches Carbon's light UI.
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'strict',
  flowchart: { htmlLabels: true, curve: 'basis', nodeSpacing: 40, rankSpacing: 60 },
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
});

// The whole VBP request-execution architecture as one mermaid flowchart. This
// IS the page now — not a copyable string buried under a hand-drawn diagram.
const ARCHITECTURE_DIAGRAM = `flowchart LR
  classDef ui fill:#edf5ff,stroke:#0f62fe,color:#0043ce;
  classDef store fill:#f4f4f4,stroke:#8d8d8d,color:#393939;
  classDef core fill:#e8daff,stroke:#8a3ffc,color:#491d8b;
  classDef policy fill:#fff8e1,stroke:#b28600,color:#684e00;
  classDef exec fill:#defbe6,stroke:#24a148,color:#0e6027;
  classDef event fill:#fcf4d6,stroke:#d2a106,color:#684e00;

  User["User<br/>пишет запрос"]:::ui
  Builder["Builder<br/>UI для запуска"]:::ui
  Explorer["Explorer<br/>смотрит state/history"]:::ui
  API["server/http<br/>POST /message"]:::ui

  BOS[("BOS DB<br/>user / org / project")]:::store
  Org["Org data<br/>identity + RLS scope"]:::store
  Run[("Run record<br/>status + events")]:::store

  Engine{{"Engine (kernel)<br/>admission + provision + orchestrate"}}:::core
  Registry["Registry<br/>resolve ref → factory"]:::core

  Skills["Skills<br/>read-only context"]:::policy
  ToolScope["Tool kit<br/>что можно выполнять"]:::policy
  Harness{{"Harness = Adapter<br/>harnesses/* — Hermes/Codex/Claude/SDK/Pi"}}:::policy
  Model["model_source<br/>provider / auth / billing"]:::policy

  Env{"Environment<br/>где выполнять"}:::exec
  Cloud["Cloud sandbox<br/>Docker / E2B / Daytona"]:::exec
  Local["Local machine<br/>локальный runtime"]:::exec
  Pi["Pi orchestrator<br/>edge topology"]:::exec

  Agent(["Agent<br/>persona + instruction"]):::core
  Tools["Tool execution<br/>shell / files / API / MCP"]:::exec
  Preview["Preview<br/>running app / port"]:::ui
  Events["EngineEvent stream<br/>tokens / tools / logs"]:::event
  Answer["Builder answer<br/>final text + UI update"]:::ui

  User -->|"1 prompt"| Builder
  Builder -->|"2 POST /message + refs"| API
  API -->|"3 SessionConfig"| Engine
  API -->|"load identity"| BOS
  Explorer -->|"read state"| BOS
  BOS -->|"RLS / org scope"| Org
  Org -->|"visible data"| Engine

  Engine -->|"create run"| Run
  Engine -->|"4 admit + resolve refs"| Registry
  Registry -->|"harness ref"| Harness
  Registry -->|"environment ref"| Env
  Registry -->|"skill refs"| Skills
  Registry -->|"tool refs"| ToolScope

  Engine -->|"5 provision + topology"| Env
  Engine -->|"6 run(task, handle, kit)"| Harness
  Model -->|"model auth"| Harness
  Skills -->|"инструкции"| Harness
  ToolScope -->|"allowed tools"| Harness

  Env -->|"cloud"| Cloud
  Env -->|"local"| Local
  Env -->|"edge"| Pi
  Cloud -->|"hosts"| Agent
  Local -->|"hosts"| Agent
  Pi -->|"EngineEvent contract"| Agent
  Harness -->|"runtime calls"| Agent

  Agent -->|"7 tool_call"| Tools
  Tools -->|"tool_result"| Agent
  Agent -->|"preview_ready"| Preview
  Agent -->|"8 stream"| Events
  Events -->|"settle + save"| Run
  Events -->|"9 final_text"| Answer
  Answer -->|"show result"| Builder`;

const requestPath: [string, string][] = [
  ['1. Пользователь пишет запрос в Builder', 'Builder собирает текст запроса, проект, пользователя, workspace/org scope и настройки запуска.'],
  ['2. API принимает запрос', 'server/http превращает UI-запрос в SessionConfig: какой harness, environment, model, topology и какие skill/tool refs запускать, от чьего имени и в каком проекте.'],
  ['3. Проверяется пользователь и org data', 'BOS DB отвечает, какие проекты, provider accounts и прошлые runs доступны этому пользователю (identity + RLS scope).'],
  ['4. Engine создает run и резолвит refs', 'Engine (kernel) проверяет admission, пишет run record и через Registry резолвит ref-строки в фабрики: harness, environment, skills, tools.'],
  ['5. Engine провижинит Environment и запускает Harness', 'Engine провижинит выбранный Environment, согласует topology с capabilities харнеса и окружения, затем вызывает Harness = Adapter с готовым kit (Skills + Tools) и env handle.'],
  ['6. Agent выполняет работу через Tools', 'Agent получает инструкцию, контекст и разрешенные Tools. Skill только объясняет как работать; Tool реально выполняет действие.'],
  ['7. Events стримятся обратно', 'EngineEvent поток возвращает token chunks, tool calls, tool results, logs, preview URL и final answer.'],
  ['8. Ответ возвращается в UI и DB', 'Final text обновляет Builder, а весь поток событий сохраняется в run history.'],
];

const terms: [string, string][] = [
  ['Builder', 'Место, где пользователь просит агента что-то сделать и видит выполнение в реальном времени.'],
  ['Explorer', 'Место, где пользователь смотрит состояние проекта: данные, историю runs, chats, context.'],
  ['BOS DB', 'Главная база: user, organization, workspace, projects, chats, runs, skills, tool scopes, provider accounts.'],
  ['Engine', 'Координатор одного run (src/kernel): admission, провижининг env, оркестрация харнеса, settlement, сохранение результата.'],
  ['Registry', 'Seam резолва (src/registry): превращает ref-строку в фабрику harness/environment/tool/skill. UI ничего не импортирует напрямую — только передает refs.'],
  ['Harness = Adapter', 'В этом билде это один seam (src/harnesses/*): и политика запуска, и граница к конкретному runtime/provider — Hermes, Codex, Claude, SDK, OpenAI Agents, OpenCode, Pi.'],
  ['Skill', 'Read-only инструкция. Объясняет агенту правила и контекст, но сама ничего не выполняет.'],
  ['Tool', 'Исполняемая возможность: shell, file edit, API call, MCP action, connector, browser, preview, deploy.'],
  ['Environment', 'Место, где реально идет работа: cloud sandbox, local machine или Raspberry Pi/edge host.'],
  ['EngineEvent', 'Единый формат событий: tool_call, tool_result, log, preview_ready, stream_chunk, final_text, terminal.'],
];

// Renders a mermaid source string into actual SVG. Re-renders on `chart` change;
// surfaces parse errors instead of leaving a blank box.
function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    mermaid
      .render(`arch-${id}`, chart)
      .then(({ svg }) => {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return <pre className="architecture-mermaid-error">{error}</pre>;
  }
  return <div className="architecture-mermaid-svg" ref={ref} aria-label="VBP architecture diagram" />;
}

export default function ArchitectureFlow() {
  return (
    <section className="architecture-page architecture-page-ru" aria-label="Architecture diagram">
      <div className="architecture-head architecture-head-simple">
        <div>
          <p className="architecture-kicker">Architecture</p>
          <h1>Как запрос проходит через VBP перед выполнением</h1>
          <p>
            Одна mermaid-диаграмма всей системы: читайте слева направо — User → Builder → API → Engine →
            Registry → Environment + Harness → Agent → Tools / Preview → EngineEvent → ответ в Builder.
          </p>
        </div>
      </div>

      <div className="architecture-primer">
        <div className="architecture-primer-head">
          <div>
            <p className="architecture-kicker">Diagram</p>
            <h2>Архитектура целиком</h2>
            <p>
              UI не выполняет работу напрямую. Он отправляет scoped request; Engine проверяет пользователя и
              правила, Harness собирает разрешенный контекст, Agent работает в Environment, а результат
              возвращается как поток EngineEvent.
            </p>
          </div>
        </div>
        <div className="architecture-mermaid">
          <MermaidDiagram chart={ARCHITECTURE_DIAGRAM} />
        </div>
      </div>

      <div className="architecture-primer">
        <div className="architecture-primer-head">
          <div>
            <p className="architecture-kicker">1. Request path</p>
            <h2>Путь запроса до выполнения</h2>
          </div>
        </div>
        <div className="architecture-info-grid architecture-info-grid-path">
          {requestPath.map(([title, body]) => (
            <section className="architecture-info-row" key={title}>
              <strong>{title}</strong>
              <span>{body}</span>
            </section>
          ))}
        </div>
      </div>

      <div className="architecture-primer">
        <div className="architecture-primer-head">
          <div>
            <p className="architecture-kicker">2. Terms</p>
            <h2>Термины архитектуры</h2>
          </div>
        </div>
        <div className="architecture-info-grid architecture-info-grid-terms">
          {terms.map(([title, body]) => (
            <section className="architecture-info-row" key={title}>
              <strong>{title}</strong>
              <span>{body}</span>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
