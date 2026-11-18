import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function ConfirmDialog({
  open,
  title,
  message,
  note = null,
  confirmLabel,
  cancelLabel,
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const { t } = useLanguage();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="salon-card-gold w-full max-w-md p-6 animate-fade-in-up">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                danger ? 'bg-red-500/20 text-red-400' : 'bg-salon-gold/20 text-salon-gold'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-gray-400 hover:text-white p-1"
            aria-label={t('app.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-4 text-sm text-gray-300 leading-relaxed">{message}</p>

        {note && (
          <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3.5 py-2.5 text-xs text-amber-200 leading-relaxed">
            {note}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary">
            {cancelLabel || t('app.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={danger ? 'btn-danger' : 'btn-gold'}
          >
            {loading ? '...' : confirmLabel || t('app.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
