import { Router } from 'express';
import { authenticatePin, verifySessionToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { pin, role = 'staff' } = req.body || {};
  const result = authenticatePin(pin, role);
  if (!result.valid) {
    return res.status(401).json({
      error: 'INVALID_PIN',
      message: 'Incorrect PIN. Please try again.',
    });
  }
  return res.json({
    role: result.role,
    token: result.token,
  });
});

router.get('/verify', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ valid: false });
  }
  return res.json({ valid: true, role: payload.role });
});

export default router;
