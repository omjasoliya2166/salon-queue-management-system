import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
  getDailyStats,
  createService,
  updateService,
  deleteService,
  createBarber,
  updateBarber,
  deleteBarber,
  updateSalonSettings,
} from '../db/repository.js';
import { broadcastStateSync } from '../socket/broadcaster.js';

const router = Router();
router.use(requireRole('owner'));

router.get('/stats', (req, res, next) => {
  try {
    const stats = getDailyStats(req.query.date || undefined);
    return res.json({ stats });
  } catch (err) {
    return next(err);
  }
});

router.post('/services', (req, res, next) => {
  try {
    const service = createService(req.body || {});
    broadcastStateSync();
    return res.status(201).json({ service });
  } catch (err) {
    return next(err);
  }
});

router.patch('/services/:id', (req, res, next) => {
  try {
    const service = updateService(req.params.id, req.body || {});
    broadcastStateSync();
    return res.json({ service });
  } catch (err) {
    return next(err);
  }
});

router.delete('/services/:id', (req, res, next) => {
  try {
    const result = deleteService(req.params.id);
    broadcastStateSync();
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/barbers', (req, res, next) => {
  try {
    const barber = createBarber(req.body || {});
    broadcastStateSync();
    return res.status(201).json({ barber });
  } catch (err) {
    return next(err);
  }
});

router.patch('/barbers/:id', (req, res, next) => {
  try {
    const barber = updateBarber(req.params.id, req.body || {});
    broadcastStateSync();
    return res.json({ barber });
  } catch (err) {
    return next(err);
  }
});

router.delete('/barbers/:id', (req, res, next) => {
  try {
    const result = deleteBarber(req.params.id);
    broadcastStateSync();
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.patch('/settings', (req, res, next) => {
  try {
    const settings = updateSalonSettings(req.body || {});
    broadcastStateSync();
    return res.json({ settings });
  } catch (err) {
    return next(err);
  }
});

export default router;
