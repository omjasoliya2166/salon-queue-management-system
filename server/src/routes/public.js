import { Router } from 'express';
import {
  getFullState,
  getEntryById,
  getActiveEntryByPhone,
  joinQueue,
  cancelEntry,
} from '../db/repository.js';
import { broadcastStateSync } from '../socket/broadcaster.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/state', (_req, res) => {
  res.json(getFullState());
});

router.get('/queue/lookup/:phone', (req, res, next) => {
  try {
    const entry = getActiveEntryByPhone(req.params.phone);
    if (!entry) {
      return res.status(404).json({
        error: 'NO_ACTIVE_ENTRY',
        message: 'No active queue entry found for this mobile number.',
      });
    }
    return res.json({ entry });
  } catch (err) {
    return next(err);
  }
});

router.get('/queue/:id', (req, res, next) => {
  try {
    const entry = getEntryById(req.params.id);
    if (!entry) {
      return res.status(404).json({
        error: 'ENTRY_NOT_FOUND',
        message: 'Queue entry not found.',
      });
    }
    return res.json({ entry });
  } catch (err) {
    return next(err);
  }
});

router.post('/queue/join', (req, res, next) => {
  try {
    const { name, phone, serviceIds, preferredBarberId } = req.body || {};
    const entry = joinQueue({
      name,
      phone,
      serviceIds,
      preferredBarberId: preferredBarberId || null,
      source: 'online',
    });
    broadcastStateSync();
    return res.status(201).json({ entry });
  } catch (err) {
    return next(err);
  }
});

router.post('/queue/:id/cancel', (req, res, next) => {
  try {
    const entry = cancelEntry(req.params.id);
    broadcastStateSync();
    return res.json({ entry });
  } catch (err) {
    return next(err);
  }
});

export default router;
