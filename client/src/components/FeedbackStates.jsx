import React from 'react';
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export function LoadingState({ message }) {
  const { t } = useLanguage();
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="w-10 h-10 border-2 border-salon-gold border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-300">{message || t('app.loading')}</p>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  const { t } = useLanguage();
  if (!message) return null;
  return (
    <div className="rounded-xl bg-red-500/15 border border-red-500/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm text-red-200">
      <div className="flex items-center gap-2.5">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 px-3 py-1.5 text-xs font-semibold text-white transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t('app.retry')}</span>
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, icon: Icon = Inbox, action = null }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-salon-dark/40 p-8 text-center flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-2xl bg-salon-gold/10 border border-salon-gold/25 flex items-center justify-center text-salon-gold mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-base font-semibold text-white">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-400 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function formatTime12h(hhmm) {
  if (!hhmm || !hhmm.includes(':')) return hhmm || '';
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${mStr} ${suffix}`;
}
