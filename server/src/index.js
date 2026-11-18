import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env.js';
import { initDatabase } from './db/database.js';
import { AppError, getFullState } from './db/repository.js';
import { attachSocketServer } from './socket/broadcaster.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import receptionRoutes from './routes/reception.js';
import barberRoutes from './routes/barber.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createAppServer({ dbPath = null } = {}) {
  initDatabase(dbPath);

  const app = express();
  const allowedOrigins =
    env.corsOrigin === '*'
      ? true
      : env.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/auth', authRoutes);
  app.use('/api', publicRoutes);
  app.use('/api/reception', receptionRoutes);
  app.use('/api/barber', barberRoutes);
  app.use('/api/admin', adminRoutes);

  // Optional static client serving for single-service deployments
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  if (env.serveClient && fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  // Centralized error handler
  app.use((err, _req, res, _next) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: err.code,
        message: err.message,
        ...err.extra,
      });
    }
    console.error('[SQMS Server Error]', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong on the server. Please try again.',
    });
  });

  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      credentials: true,
    },
  });

  attachSocketServer(io);

  io.on('connection', (socket) => {
    // Push fresh authoritative snapshot immediately on connect
    socket.emit('state:sync', getFullState());

    socket.on('state:request', () => {
      socket.emit('state:sync', getFullState());
    });
  });

  return { app, httpServer, io };
}

// Only bind listener when executed directly
const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const { httpServer } = createAppServer();
  httpServer.listen(env.port, () => {
    console.log(`[SQMS] Backend server running on port ${env.port}`);
  });
}
