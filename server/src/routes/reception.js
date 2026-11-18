import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
  joinQueue,
  callNextForBarber,
  markNoShow,
  cancelEntry,
} from '../db/repository.js';
import { broadcastStateSync, broadcastCustomerCalled } from '../socket/broadcaster.js';

const router = Router();
router.use(requireRole('staff'));

router.post('/walkin', (req, res, next) => {
  try {
    const { name, phone, serviceIds, preferredBarberId } = req.body || {};
    const entry = joinQueue({
      name,
      phone,
      serviceIds,
      preferredBarberId: preferredBarberId || null,
      source: 'walk-in',
    });
    broadcastStateSync();
    return res.status(201).json({ entry });
  } catch (err) {
    return next(err);
  }
});

router.post('/call-next', (req, res, next) => {
  try {
    const { barberId, entryId = null } = req.body || {};
    if (!barberId) {
      return res.status(400).json({ error: 'MISSING_BARBER', message: 'Barber ID is required.' });
    }
    const result = callNextForBarber(barberId, entryId || null);
    broadcastCustomerCalled(result);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/entries/:id/no-show', (req, res, next) => {
  try {
    const entry = markNoShow(req.params.id);
    broadcastStateSync();
    return res.json({ entry });
  } catch (err) {
    return next(err);
  }
});

router.post('/entries/:id/cancel', (req, res, next) => {
  try {
    const entry = cancelEntry(req.params.id);
    broadcastStateSync();
    return res.json({ entry });
  } catch (err) {
    return next(err);
  }
});

export default router;
