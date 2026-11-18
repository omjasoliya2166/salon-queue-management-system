import React, { useState } from 'react';
import { Lock, ShieldCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function PinGate({ requiredRole = 'staff', children }) {
  const { hasAccess, checking, login } = useAuth();
  const { t } = useLanguage();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (checking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-9 h-9 border-2 border-salon-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (hasAccess(requiredRole)) {
    return children;
  }

  const isOwner = requiredRole === 'owner';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await login(pin.trim(), requiredRole);
      setPin('');
    } catch {
      setError(t('auth.invalidPin'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="salon-card-gold w-full max-w-md p-7 animate-fade-in-up">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-salon-gold/15 border border-salon-gold/40 flex items-center justify-center mb-4">
            {isOwner ? (
              <ShieldCheck className="w-7 h-7 text-salon-gold" />
            ) : (
              <Lock className="w-7 h-7 text-salon-gold" />
            )}
          </div>
          <h1 className="text-xl font-bold text-white">
            {isOwner ? t('auth.ownerTitle') : t('auth.staffTitle')}
          </h1>
          <p className="mt-2 text-sm text-gray-300">
            {isOwner ? t('auth.ownerDesc') : t('auth.staffDesc')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="relative">
            <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={t('auth.pinPlaceholder')}
              className="salon-input pl-10 text-center tracking-[0.35em] text-lg font-bold"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/15 border border-red-500/35 px-3.5 py-2.5 text-sm text-red-200 text-center">
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting || !pin.trim()} className="btn-gold w-full">
            {submitting ? '...' : t('auth.unlockBtn')}
          </button>

          <p className="text-xs text-center text-gray-400 pt-1">
            {isOwner ? t('auth.demoHintOwner') : t('auth.demoHintStaff')}
          </p>
        </form>
      </div>
    </div>
  );
}
