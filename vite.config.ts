import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

function workoutStorePlugin(): Plugin {
  const dataDir = path.resolve(process.cwd(), 'data');
  const getStorePath = (reqUrl?: string) => {
    try {
      const u = new URL(reqUrl || '', 'http://localhost');
      const user = (u.searchParams.get('user') || 'default')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_');
      if (user && user !== 'default') {
        const userFile = path.join(dataDir, `workout-store-${user}.json`);
        if (fs.existsSync(userFile)) return userFile;
        // Fallback to default workout-store.json on first read if it exists
        const fallback = path.join(dataDir, 'workout-store.json');
        if (fs.existsSync(fallback)) return fallback;
        return userFile;
      }
    } catch {
      // Ignore
    }
    return path.join(dataDir, 'workout-store.json');
  };

  const getWritePath = (reqUrl?: string) => {
    try {
      const u = new URL(reqUrl || '', 'http://localhost');
      const user = (u.searchParams.get('user') || 'default')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_');
      if (user && user !== 'default') {
        return path.join(dataDir, `workout-store-${user}.json`);
      }
    } catch {
      // Ignore
    }
    return path.join(dataDir, 'workout-store.json');
  };

  const attachMiddleware = (middlewares: any) => {
    middlewares.use('/api/store', (req: any, res: any, next: any) => {
      if (req.method === 'GET') {
        try {
          const storePath = getStorePath(req.url);
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

      if (req.method === 'POST' || req.method === 'PUT') {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            if (!fs.existsSync(dataDir)) {
              fs.mkdirSync(dataDir, { recursive: true });
            }
            const writePath = getWritePath(req.url);
            const existing = fs.existsSync(writePath)
              ? fs.readFileSync(writePath, 'utf-8')
              : null;
            if (existing !== body) {
              fs.writeFileSync(writePath, body, 'utf-8');
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
