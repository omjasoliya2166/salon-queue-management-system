import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
  startService,
  completeService,
  setBarberAvailability,
} from '../db/repository.js';
import { broadcastStateSync } from '../socket/broadcaster.js';

const router = Router();
router.use(requireRole('staff'));

router.post('/:barberId/start', (req, res, next) => {
  try {
    const { entryId = null } = req.body || {};
    const entry = startService(req.params.barberId, entryId);
    broadcastStateSync();
    return res.json({ entry });
  } catch (err) {
    return next(err);
  }
});

router.post('/:barberId/done', (req, res, next) => {
  try {
    const { entryId = null } = req.body || {};
    const entry = completeService(req.params.barberId, entryId);
    broadcastStateSync();
    return res.json({ entry });
  } catch (err) {
    return next(err);
  }
});

router.patch('/:barberId/status', (req, res, next) => {
  try {
    const { status } = req.body || {};
    const barber = setBarberAvailability(req.params.barberId, status);
    broadcastStateSync();
    return res.json({ barber });
  } catch (err) {
    return next(err);
  }
});

export default router;
