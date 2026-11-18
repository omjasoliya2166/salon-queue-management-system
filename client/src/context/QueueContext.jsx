import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { api, API_BASE_URL } from '../services/api.js';

const QueueContext = createContext(null);

export function QueueProvider({ children }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastCallEvent, setLastCallEvent] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const socketRef = useRef(null);

  const refreshState = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getState();
      setState(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Unable to connect to the salon server.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial HTTP fetch + Socket.IO real-time subscription
  useEffect(() => {
    refreshState();

    const socket = io(API_BASE_URL || undefined, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 4000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
      socket.emit('state:request');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('state:sync', (nextState) => {
      if (nextState) {
        setState(nextState);
        setLoading(false);
        setError(null);
      }
    });

    socket.on('customer:called', (payload) => {
      setLastCallEvent({ ...payload, receivedAt: Date.now() });
    });

    const handleFocus = () => {
      if (socket.connected) {
        socket.emit('state:request');
      } else {
        refreshState({ silent: true });
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      socket.disconnect();
    };
  }, [refreshState]);

  // 1-second clock tick for smooth live service timers & elapsed wait displays
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Periodic background state reconciliation every 30s (e.g., 30-min closing cutoff crossing)
  useEffect(() => {
    const syncInterval = window.setInterval(() => {
      refreshState({ silent: true });
    }, 30000);
    return () => window.clearInterval(syncInterval);
  }, [refreshState]);

  return (
    <QueueContext.Provider
      value={{
        state,
        loading,
        error,
        connected,
        lastCallEvent,
        nowMs,
        refreshState,
      }}
    >
      {children}
    </QueueContext.Provider>
  );
}

export function useQueue() {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useQueue must be used within QueueProvider');
  return ctx;
}
