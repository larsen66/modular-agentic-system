// src/environments/previewProxy.ts
// Local browser-openable proxy for provider previews that require auth headers.
// Tokens stay inside the adapter; Core/history/events only see localhost URLs.

import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

interface ProxyEntry {
  server: http.Server;
  proxyPort: number;
}

export class HeaderPreviewProxy {
  private entries = new Map<string, ProxyEntry>();

  async exposeUrl(targetUrl: string, extraHeaders: Record<string, string>): Promise<{ url: string }> {
    const target = new URL(targetUrl);
    const key = `${target.href}:${Object.keys(extraHeaders).sort().join(',')}`;
    const existing = this.entries.get(key);
    if (existing) return { url: `http://localhost:${existing.proxyPort}/` };

    const proxyPort = await this.freePort();
    const server = http.createServer((clientReq, clientRes) => {
      const upstreamHeaders = { ...clientReq.headers, ...extraHeaders, host: target.host };
      delete upstreamHeaders.connection;
      const request = target.protocol === 'https:' ? https.request : http.request;
      const upstream = request(
        {
          hostname: target.hostname,
          port: target.port || (target.protocol === 'https:' ? 443 : 80),
          path: `${target.pathname.replace(/\/$/, '')}${clientReq.url ?? '/'}`,
          method: clientReq.method,
          headers: upstreamHeaders,
        },
        (upRes) => {
          clientRes.writeHead(upRes.statusCode ?? 502, upRes.headers);
          upRes.pipe(clientRes, { end: true });
        }
      );
      upstream.on('error', () => {
        if (!clientRes.headersSent) clientRes.writeHead(502);
        clientRes.end('preview upstream unavailable');
      });
      clientReq.pipe(upstream, { end: true });
    });

    server.on('upgrade', (req, socket, head) => {
      const upstream = net.connect(Number(target.port || 443), target.hostname, () => {
        const reqLine = `${req.method} ${req.url} HTTP/1.1\r\n`;
        const headers = { ...req.headers, ...extraHeaders, host: target.host };
        const rawHeaders = Object.entries(headers)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('\r\n');
        upstream.write(reqLine + rawHeaders + '\r\n\r\n');
        if (head.length) upstream.write(head);
        socket.pipe(upstream);
        upstream.pipe(socket);
      });
      upstream.on('error', () => socket.destroy());
      socket.on('error', () => upstream.destroy());
    });

    await new Promise<void>((resolve) => server.listen(proxyPort, '0.0.0.0', resolve));
    this.entries.set(key, { server, proxyPort });
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
