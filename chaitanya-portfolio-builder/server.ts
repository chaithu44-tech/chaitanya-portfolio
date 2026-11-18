import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const PYTHON_PORT = Number(process.env.PYTHON_PORT || 8000);
const PYTHON_API_URL = process.env.PYTHON_API_URL || `http://127.0.0.1:${PYTHON_PORT}`;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

let pythonProcess: ChildProcess | null = null;

async function isPythonBackendHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${PYTHON_API_URL}/api/health`, {
      signal: AbortSignal.timeout(1200),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function startPythonBackend(): Promise<void> {
  if (await isPythonBackendHealthy()) {
    console.log(`[python-api] Connected to existing FastAPI service at ${PYTHON_API_URL}`);
    return;
  }

  const backendDir = path.resolve(__dirname, 'backend');
  const pythonBin = process.env.PYTHON_BIN || 'python3';

  console.log(`[python-api] Starting Python FastAPI backend on port ${PYTHON_PORT}...`);
  pythonProcess = spawn(
    pythonBin,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(PYTHON_PORT)],
    {
      cwd: backendDir,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  pythonProcess.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(`[fastapi] ${chunk.toString()}`);
  });
  pythonProcess.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[fastapi] ${chunk.toString()}`);
  });
  pythonProcess.on('exit', (code, signal) => {
    console.log(`[python-api] FastAPI exited (code=${code}, signal=${signal})`);
    pythonProcess = null;
  });

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await isPythonBackendHealthy()) {
      console.log(`[python-api] FastAPI ready at ${PYTHON_API_URL}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.warn('[python-api] FastAPI did not respond within startup timeout; proxy will retry per request.');
}

function shutdownPythonBackend(): void {
  if (pythonProcess && !pythonProcess.killed) {
    pythonProcess.kill('SIGTERM');
    pythonProcess = null;
  }
}

process.on('SIGINT', () => {
  shutdownPythonBackend();
  process.exit(0);
});
process.on('SIGTERM', () => {
  shutdownPythonBackend();
  process.exit(0);
});

async function bootstrap(): Promise<void> {
  await startPythonBackend();

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Proxy /api/* requests directly to the Python FastAPI backend
  app.use('/api', async (req: Request, res: Response) => {
    const targetUrl = `${PYTHON_API_URL}/api${req.url === '/' ? '' : req.url}`;
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (req.headers['content-type']) {
        headers['Content-Type'] = String(req.headers['content-type']);
      }

      const init: RequestInit = {
        method: req.method,
        headers,
        signal: AbortSignal.timeout(10000),
      };

      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
        init.body = JSON.stringify(req.body);
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      }

      const upstream = await fetch(targetUrl, init);
      const text = await upstream.text();
      const contentType = upstream.headers.get('content-type') || 'application/json';

      res.status(upstream.status).setHeader('Content-Type', contentType).send(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upstream FastAPI unavailable';
      res.status(502).json({
        detail: `Python FastAPI backend is currently unreachable (${message}).`,
      });
    }
  });

  if (IS_PRODUCTION) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        const rawHtml = fs.readFileSync(indexPath, 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(transformed);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Portfolio running at http://0.0.0.0:${PORT} (Python API -> ${PYTHON_API_URL})`);
  });
}

bootstrap().catch((err) => {
  console.error('[server] Failed to bootstrap server:', err);
  shutdownPythonBackend();
  process.exit(1);
});
