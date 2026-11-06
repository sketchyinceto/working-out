import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

function workoutStorePlugin(): Plugin {
  const dataDir = path.resolve(process.cwd(), 'data');
  const storePath = path.join(dataDir, 'workout-store.json');

  const attachMiddleware = (middlewares: any) => {
    middlewares.use('/api/store', (req: any, res: any, next: any) => {
      if (req.method === 'GET') {
        try {
          if (fs.existsSync(storePath)) {
            const raw = fs.readFileSync(storePath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(raw);
            return;
          }
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ empty: true }));
          return;
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
          return;
        }
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            if (!fs.existsSync(dataDir)) {
              fs.mkdirSync(dataDir, { recursive: true });
            }
            const existing = fs.existsSync(storePath)
              ? fs.readFileSync(storePath, 'utf-8')
              : null;
            if (existing !== body) {
              fs.writeFileSync(storePath, body, 'utf-8');
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
        return;
      }

      next();
    });
  };

  return {
    name: 'workout-store-api',
    configureServer(server) {
      server.watcher.unwatch(path.join(dataDir, '**'));
      server.watcher.unwatch(storePath);
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), workoutStorePlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      ignored: ['**/data/**', '**/workout-store.json', '**/*.tsbuildinfo'],
    },
  },
});
