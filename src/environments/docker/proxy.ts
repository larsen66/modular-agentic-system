// src/environments/docker/proxy.ts
// The written-ONCE reverse proxy for Docker's exposePort. Docker only binds a
// host port (localhost:hostPort) and gives no public URL — so the ENTIRE
// DNS/host-port/proxy apparatus is sealed here, behind the EnvironmentHandle's
// exposePort signature. Core only ever receives a finished `{ url }` string.
//
// MVP = simplest correct thing: a local http reverse proxy that forwards to the
// container's published host port and returns http://localhost:<proxyPort>/.
// No HTML/URL rewriting, no HMR-WS correlation (those are v2, SPEC §4 non-goals).

import http from 'node:http';
import net from 'node:net';

interface ProxyEntry {
  server: http.Server;
  proxyPort: number;
  targetHost: string;
  targetPort: number;
}

export class DockerPreviewProxy {
  // Keyed by `${targetHost}:${targetPort}` so re-exposing the same port reuses
  // the proxy rather than spawning a second one (single-writer routing).
  private entries = new Map<string, ProxyEntry>();

  async expose(targetHost: string, targetPort: number): Promise<{ url: string }> {
    const key = `${targetHost}:${targetPort}`;
    const existing = this.entries.get(key);
    if (existing) return { url: `http://localhost:${existing.proxyPort}/` };

    const proxyPort = await this.freePort();
    const server = http.createServer((clientReq, clientRes) => {
      const options: http.RequestOptions = {
        host: targetHost,
        port: targetPort,
        path: clientReq.url,
        method: clientReq.method,
        headers: clientReq.headers,
      };
      const upstream = http.request(options, (upRes) => {
        clientRes.writeHead(upRes.statusCode ?? 502, upRes.headers);
        upRes.pipe(clientRes, { end: true });
      });
      upstream.on('error', () => {
        if (!clientRes.headersSent) clientRes.writeHead(502);
        clientRes.end('preview upstream unavailable');
      });
      clientReq.pipe(upstream, { end: true });
    });

    // Proxy raw WebSocket upgrades (HMR) at the TCP level — no correlation/rewrite.
    server.on('upgrade', (req, socket, head) => {
      const upstream = net.connect(targetPort, targetHost, () => {
        const reqLine = `${req.method} ${req.url} HTTP/1.1\r\n`;
        const headers = Object.entries(req.headers)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('\r\n');
        upstream.write(reqLine + headers + '\r\n\r\n');
        if (head && head.length) upstream.write(head);
        socket.pipe(upstream);
        upstream.pipe(socket);
      });
      upstream.on('error', () => socket.destroy());
      socket.on('error', () => upstream.destroy());
    });

    await new Promise<void>((resolve) => server.listen(proxyPort, '0.0.0.0', resolve));
    this.entries.set(key, { server, proxyPort, targetHost, targetPort });
    return { url: `http://localhost:${proxyPort}/` };
  }

  async destroy(): Promise<void> {
    for (const entry of this.entries.values()) {
      await new Promise<void>((resolve) => entry.server.close(() => resolve()));
    }
    this.entries.clear();
  }

  private freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.once('error', reject);
      srv.listen(0, () => {
        const addr = srv.address();
        if (addr && typeof addr === 'object') {
          const port = addr.port;
          srv.close(() => resolve(port));
        } else {
          srv.close(() => reject(new Error('could not acquire free port')));
        }
      });
    });
  }
}
