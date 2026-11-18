import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(serverRoot, '.env') });

export const env = {
  port: Number(process.env.PORT) || 4000,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  dbPath: process.env.DB_PATH
    ? path.isAbsolute(process.env.DB_PATH)
      ? process.env.DB_PATH
      : path.resolve(serverRoot, process.env.DB_PATH)
    : path.resolve(serverRoot, 'data/salon.db'),
  staffPin: String(process.env.STAFF_PIN || '1234'),
  ownerPin: String(process.env.OWNER_PIN || '9999'),
  jwtSecret: String(process.env.JWT_SECRET || 'regal-crown-default-secret'),
  serveClient: process.env.SERVE_CLIENT === 'true',
  nodeEnv: process.env.NODE_ENV || 'development',
};
