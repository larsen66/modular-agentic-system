// scripts/port-check.ts — verifies the Docker adapter publishes common dev ports
// even when the ProvisionSpec declares none (the Studio sends no ports).
import { resolveEnvironment } from '../src/registry/index.js';
import '../src/environments/docker/index.js';

async function main() {
  const env = resolveEnvironment('docker');
  const h = await env.provision({ source: { kind: 'files', files: [] }, runtimeProfile: 'node:20-slim' });
  await h.exec(`node -e 'require("http").createServer((q,s)=>s.end("OK-NOPORTS")).listen(5173,"0.0.0.0")'`, { detached: true });
  await h.waitForPort?.(5173, 20000);
  const { url } = await h.exposePort(5173);
  console.log('EXPOSED URL (no declared ports):', url);
  const res = await fetch(url);
  const body = await res.text();
  console.log('STATUS:', res.status, 'BODY:', body);
  await h.destroy();
  const pass = res.status === 200 && body.includes('OK-NOPORTS');
  console.log(pass ? 'PORT-FIX PASS ✅' : 'FAIL');
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
