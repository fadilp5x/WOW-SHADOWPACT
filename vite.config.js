import { defineConfig, loadEnv } from 'vite';
import { handleApi } from './src/api.js';

// loadEnv is used only by the development server. Secrets are never defined in
// client JavaScript. Netlify reads the same names from its runtime environment.
export default defineConfig(({ command, mode }) => ({
  build: { outDir: 'dist/client', emptyOutDir: true },
  plugins: command === 'serve' ? [{
    name: 'shadowpact-api',
    configureServer(server) {
      const runtimeEnv = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();
        try {
          let body = '';
          for await (const chunk of req) {
            body += chunk;
            if (Buffer.byteLength(body) > 8192) {
              res.writeHead(413, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Enter a shorter app name or website.' }));
              return;
            }
          }
          const request = new Request('http://localhost' + req.url, {
            method: req.method, headers: req.headers, ...(body ? { body } : {}),
          });
          const result = await handleApi(request, runtimeEnv);
          res.writeHead(result.status, Object.fromEntries(result.headers));
          if (result.body) for await (const chunk of result.body) res.write(Buffer.from(chunk));
          res.end();
        } catch {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'The policy service could not complete this request.' }));
          } else res.end();
        }
      });
    },
  }] : [],
}));
