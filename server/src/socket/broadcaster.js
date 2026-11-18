import { getFullState } from '../db/repository.js';

let ioInstance = null;

export function attachSocketServer(io) {
  ioInstance = io;
}

export function broadcastStateSync() {
  if (!ioInstance) return;
  const state = getFullState();
  ioInstance.emit('state:sync', state);
}

export function broadcastCustomerCalled({ entry, barber }) {
  if (!ioInstance) return;
  ioInstance.emit('customer:called', {
    entryId: entry.id,
    tokenNumber: entry.token_number,
    customerName: entry.customer_name,
    barberId: barber.id,
    barberName: barber.name,
    calledAt: entry.called_at,
  });
  broadcastStateSync();
}
