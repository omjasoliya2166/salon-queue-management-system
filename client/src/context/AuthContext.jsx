import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [role, setRole] = useState(() => {
    try {
      return window.sessionStorage.getItem('sqms_auth_role') || null;
    } catch {
      return null;
    }
  });
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    const token = window.sessionStorage.getItem('sqms_auth_token');
    if (!token) {
      setRole(null);
      setChecking(false);
      return;
    }
    api
      .verifySession()
      .then((res) => {
        if (!active) return;
        if (res.valid) {
          setRole(res.role);
          window.sessionStorage.setItem('sqms_auth_role', res.role);
        } else {
          window.sessionStorage.removeItem('sqms_auth_token');
          window.sessionStorage.removeItem('sqms_auth_role');
          setRole(null);
        }
      })
      .catch(() => {
        if (!active) return;
        window.sessionStorage.removeItem('sqms_auth_token');
        window.sessionStorage.removeItem('sqms_auth_role');
        setRole(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (pin, requestedRole = 'staff') => {
    const res = await api.loginPin(pin, requestedRole);
    window.sessionStorage.setItem('sqms_auth_token', res.token);
    window.sessionStorage.setItem('sqms_auth_role', res.role);
    setRole(res.role);
    return res;
  }, []);

  const logout = useCallback(() => {
    window.sessionStorage.removeItem('sqms_auth_token');
    window.sessionStorage.removeItem('sqms_auth_role');
    setRole(null);
  }, []);

  const hasAccess = useCallback(
    (requiredRole) => {
      if (requiredRole === 'owner') return role === 'owner';
      if (requiredRole === 'staff') return role === 'staff' || role === 'owner';
      return true;
    },
    [role]
  );

  return (
    <AuthContext.Provider value={{ role, checking, login, logout, hasAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
