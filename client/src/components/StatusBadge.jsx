import React from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const STYLE_MAP = {
  Available: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  Busy: 'bg-red-500/15 text-red-300 border-red-500/35',
  'On Break': 'bg-amber-500/15 text-amber-300 border-amber-500/35',
  Waiting: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
  Called: 'bg-salon-gold/20 text-salon-goldLight border-salon-gold/50',
  'In Chair': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  Done: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
  Cancelled: 'bg-gray-500/20 text-gray-300 border-gray-400/30',
  'No-show': 'bg-red-500/20 text-red-300 border-red-400/40',
  open: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  onlineClosed: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
  closed: 'bg-red-500/15 text-red-300 border-red-500/35',
};

const DOT_MAP = {
  Available: 'bg-emerald-400',
  Busy: 'bg-red-400',
  'On Break': 'bg-amber-400',
  Waiting: 'bg-sky-400',
  Called: 'bg-salon-gold animate-pulse',
  'In Chair': 'bg-emerald-400 animate-pulse',
  Done: 'bg-emerald-400',
  Cancelled: 'bg-gray-400',
  'No-show': 'bg-red-400',
  open: 'bg-emerald-400',
  onlineClosed: 'bg-amber-400',
  closed: 'bg-red-400',
};

export default function StatusBadge({ status, size = 'sm', className = '' }) {
  const { t } = useLanguage();
  const styles = STYLE_MAP[status] || 'bg-white/10 text-gray-200 border-white/20';
  const dot = DOT_MAP[status] || 'bg-gray-300';
  const sizeClass =
    size === 'lg'
      ? 'px-3.5 py-1.5 text-sm font-semibold'
      : size === 'md'
        ? 'px-3 py-1 text-xs sm:text-sm font-semibold'
        : 'px-2.5 py-0.5 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border whitespace-nowrap ${styles} ${sizeClass} ${className}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <span>{t(`status.${status}`)}</span>
    </span>
  );
}
