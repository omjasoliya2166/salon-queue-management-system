import crypto from 'node:crypto';
import { env } from '../config/env.js';

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function signPayload(payloadBase64) {
  return crypto
    .createHmac('sha256', env.jwtSecret)
    .update(payloadBase64)
    .digest('base64url');
}

export function createSessionToken(role) {
  const payload = {
    role,
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = signPayload(encoded);

  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function authenticatePin(pin, requestedRole = 'staff') {
  const normalizedPin = String(pin ?? '').trim();
  if (requestedRole === 'owner') {
    if (normalizedPin === env.ownerPin) {
      return { valid: true, role: 'owner', token: createSessionToken('owner') };
    }
    return { valid: false };
  }

  // Staff role accepts either Staff PIN or Owner PIN
  if (normalizedPin === env.ownerPin) {
    return { valid: true, role: 'owner', token: createSessionToken('owner') };
  }
  if (normalizedPin === env.staffPin) {
    return { valid: true, role: 'staff', token: createSessionToken('staff') };
  }
  return { valid: false };
}

function extractBearer(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

export function requireRole(requiredRole) {
  return (req, res, next) => {
    const token = extractBearer(req);
    const payload = verifySessionToken(token);
    if (!payload) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Staff authentication required.',
      });
    }
    if (requiredRole === 'owner' && payload.role !== 'owner') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Owner PIN required for this action.',
      });
    }
    req.auth = payload;
    return next();
  };
}
