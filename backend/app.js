import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import systemRouter from './routes/system.js';
import casesRouter from './routes/cases.js';
import documentsRouter from './routes/documents.js';
import loanRequestsRouter from './routes/loan-requests.js';
import oauthRouter from './routes/oauth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendDistPath = path.resolve(__dirname, '..', 'maestro-ui', 'dist');
const frontendEntryPath = path.join(frontendDistPath, 'index.html');

export const createApp = () => {
  const app = express();
  const hasFrontendBuild = fs.existsSync(frontendEntryPath);

  app.use(cors());
  app.use(express.json());

  app.use('/api', systemRouter);
  app.use('/api', loanRequestsRouter);
  app.use('/api', casesRouter);
  app.use('/api', documentsRouter);
  app.use('/api', oauthRouter);

  if (hasFrontendBuild) {
    app.use(express.static(frontendDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path === '/api') {
        return next();
      }
      res.sendFile(frontendEntryPath);
    });
  } else {
    app.get('/', (_req, res) => {
      res.json({
        ok: true,
        message: 'Backend API running. Frontend is served separately in dev from maestro-ui, or from maestro-ui/dist after a production build.',
      });
    });
  }

  return {
    app,
    hasFrontendBuild,
  };
};
