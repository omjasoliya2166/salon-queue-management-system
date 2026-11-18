import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Clock,
  Users,
  Sparkles,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  XCircle,
  Scissors,
  ArrowLeft,
} from 'lucide-react';
import { QUEUE_STATUSES, BARBER_STATUSES } from '@shared/queueEngine.js';
import { useQueue } from '../context/QueueContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { api } from '../services/api.js';
import { playCallChime } from '../services/sound.js';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { LoadingState, ErrorBanner, EmptyState } from '../components/FeedbackStates.jsx';

export default function MyStatusPage() {
  const { id } = useParams();
  const { state, lastCallEvent } = useQueue();
  const { t, getLocalized } = useLanguage();

  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [overlayMinimized, setOverlayMinimized] = useState(false);

  const prevStatusRef = useRef(null);

  const fetchEntry = useCallback(async () => {
    try {
      const res = await api.getQueueEntry(id);
      setEntry(res.entry);
      setNotFound(false);
      setError('');
    } catch (err) {
      if (err.status === 404) {
        setNotFound(true);
      } else {
        setError(t('validation.networkError'));
      }
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  // Initial load & refresh whenever global real-time state updates
  useEffect(() => {
    fetchEntry();
  }, [fetchEntry, state?.server_time]);

  // Also immediately adopt live entry from Socket.IO active_entries for instant <100ms updates
  useEffect(() => {
    if (!state?.active_entries) return;
    const liveMatch = state.active_entries.find((e) => e.id === id);
    if (liveMatch) {
      setEntry(liveMatch);
      setNotFound(false);
      setLoading(false);
    }
  }, [state, id]);

  // Trigger chime & un-minimize overlay when status transitions into Called
  useEffect(() => {
    if (!entry) return;
    if (entry.status === QUEUE_STATUSES.CALLED && prevStatusRef.current !== QUEUE_STATUSES.CALLED) {
      setOverlayMinimized(false);
      playCallChime();
    }
    prevStatusRef.current = entry.status;
  }, [entry?.status]);

  useEffect(() => {
    if (lastCallEvent && lastCallEvent.entryId === id) {
      setOverlayMinimized(false);
      playCallChime();
    }
  }, [lastCallEvent, id]);

  const handleCancelConfirm = async () => {
    setCancelling(true);
    setError('');
    try {
      const res = await api.cancelCustomerSpot(id);
      setEntry(res.entry);
      setShowCancelDialog(false);
    } catch (err) {
      setError(err.message || t('validation.genericError'));
      setShowCancelDialog(false);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <LoadingState />;

  if (notFound || !entry) {
    return (
      <main className="max-w-lg mx-auto px-4 py-12">
        <EmptyState
          title={t('myStatus.notFoundTitle')}
          description={t('myStatus.notFoundDesc')}
          icon={XCircle}
          action={
            <Link to="/" className="btn-gold">
              <ArrowLeft className="w-4 h-4" />
              <span>{t('app.backHome')}</span>
            </Link>
          }
        />
      </main>
    );
  }

  const isWaiting = entry.status === QUEUE_STATUSES.WAITING;
  const isCalled = entry.status === QUEUE_STATUSES.CALLED;
  const isInChair = entry.status === QUEUE_STATUSES.IN_CHAIR;
  const isDone = entry.status === QUEUE_STATUSES.DONE;
  const isCancelled = entry.status === QUEUE_STATUSES.CANCELLED;
  const isNoShow = entry.status === QUEUE_STATUSES.NO_SHOW;

  const isAlmostNext = isWaiting && entry.position === 2;
  const preferredBarberOnBreak =
    isWaiting &&
    entry.preferred_barber_id &&
    entry.preferred_barber_status === BARBER_STATUSES.ON_BREAK;

  const barberDisplayName =
    entry.assigned_barber_name || entry.preferred_barber_name || t('app.anyBarber');

  return (
    <>
      {/* FULL-SCREEN GOLD CALL NOTIFICATION */}
      {isCalled && !overlayMinimized && (
        <div
          className="fixed inset-0 z-50 bg-salon-gold text-salon-dark flex flex-col items-center justify-center p-6 text-center animate-fade-in-up"
          role="alertdialog"
          aria-live="assertive"
        >
          <div className="w-24 h-24 rounded-full bg-salon-dark text-salon-gold flex items-center justify-center mb-6 animate-gold-pulse shadow-2xl">
            <BellRing className="w-12 h-12 animate-bounce" />
          </div>
          <div className="inline-block px-5 py-1.5 rounded-full bg-salon-dark/15 text-salon-dark font-extrabold tracking-widest text-sm uppercase mb-4">
            {t('myStatus.tokenLabel')}: {entry.token_number}
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-salon-dark">
            {t('myStatus.itsYourTurn')}
          </h1>
          <p className="mt-4 text-2xl sm:text-3xl font-bold text-salon-dark/90">
            {t('myStatus.proceedToBarber', { name: entry.assigned_barber_name || barberDisplayName })}
          </p>
          <p className="mt-3 text-base font-semibold text-salon-dark/75">{entry.customer_name}</p>
          <button
            type="button"
            onClick={() => setOverlayMinimized(true)}
            className="mt-10 px-6 py-3 rounded-xl bg-salon-dark text-white font-semibold hover:bg-gray-900 transition shadow-lg"
          >
            {t('myStatus.minimizeAlert')}
          </button>
        </div>
      )}

      <main className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5 animate-fade-in-up">
        <ErrorBanner message={error} onRetry={fetchEntry} />

        {/* Called Banner (if overlay minimized) */}
        {isCalled && overlayMinimized && (
          <div className="rounded-2xl bg-salon-gold text-salon-dark p-5 flex flex-wrap items-center justify-between gap-3 shadow-xl">
            <div>
              <p className="text-lg font-black">{t('myStatus.itsYourTurn')}</p>
              <p className="text-sm font-bold">
                {t('myStatus.proceedToBarber', { name: entry.assigned_barber_name || barberDisplayName })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOverlayMinimized(false)}
              className="px-4 py-2 rounded-xl bg-salon-dark text-white text-xs font-bold"
            >
              {t('myStatus.reopenAlert')}
            </button>
          </div>
        )}

        {/* Position #2 Notification */}
        {isAlmostNext && (
          <div className="rounded-2xl bg-amber-500/20 border-2 border-amber-400 p-5 flex items-start gap-3.5 animate-fade-in-up">
            <BellRing className="w-6 h-6 text-amber-300 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-base font-extrabold text-amber-200">
                {t('myStatus.almostNextTitle')}
              </p>
              <p className="text-xs sm:text-sm text-amber-100/85 mt-1">
                {t('myStatus.almostNextDesc')}
              </p>
            </div>
          </div>
        )}

        {/* Barber On Break Alert (Rule 9) */}
        {preferredBarberOnBreak && (
          <div className="rounded-2xl bg-amber-500/15 border border-amber-500/40 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200 leading-relaxed">
              {t('myStatus.barberBreakAlert', { name: entry.preferred_barber_name })}
            </p>
          </div>
        )}

        {/* In Chair / Terminal State Banners */}
        {isInChair && (
          <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/40 p-4 flex items-center gap-3 text-emerald-200">
            <Scissors className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-sm font-semibold">
              {t('myStatus.inChairBanner', { name: entry.assigned_barber_name || barberDisplayName })}
            </p>
          </div>
        )}

        {isDone && (
          <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/40 p-5 text-center space-y-3">
            <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto" />
            <p className="text-base font-bold text-emerald-200">{t('myStatus.doneBanner')}</p>
            <Link to="/" className="btn-gold text-sm">
              {t('app.backHome')}
            </Link>
          </div>
        )}

        {isCancelled && (
          <div className="rounded-2xl bg-gray-500/15 border border-gray-500/35 p-5 text-center space-y-3">
            <XCircle className="w-9 h-9 text-gray-400 mx-auto" />
            <p className="text-base font-bold text-gray-200">{t('myStatus.cancelledBanner')}</p>
            <Link to="/join" className="btn-gold text-sm">
              {t('myStatus.rejoinBtn')}
            </Link>
          </div>
        )}

        {isNoShow && (
          <div className="rounded-2xl bg-red-500/15 border border-red-500/40 p-5 text-center space-y-3">
            <AlertTriangle className="w-9 h-9 text-red-400 mx-auto" />
            <p className="text-sm font-semibold text-red-200">{t('myStatus.noShowBanner')}</p>
            <Link to="/join" className="btn-gold text-sm">
              {t('myStatus.rejoinBtn')}
            </Link>
          </div>
        )}

        {/* Main Token Card */}
        <section className="salon-card-gold p-6 sm:p-8 text-center space-y-6">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-salon-gold uppercase">
              {t('myStatus.tokenLabel')}
            </p>
            <div className="mt-2 text-6xl sm:text-7xl font-black text-white tracking-tight">
              {entry.token_number}
            </div>
            <div className="mt-4 flex justify-center">
              <StatusBadge status={entry.status} size="lg" />
            </div>
          </div>

          {isWaiting && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-xl bg-salon-dark/80 border border-white/10 p-4">
                <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                  <Users className="w-3.5 h-3.5 text-salon-gold" />
                  <span>{t('myStatus.positionLabel')}</span>
                </div>
                <div className="mt-1.5 text-3xl font-extrabold text-white">
                  #{entry.position ?? 1}
                </div>
              </div>
              <div className="rounded-xl bg-salon-dark/80 border border-white/10 p-4">
                <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                  <Clock className="w-3.5 h-3.5 text-salon-gold" />
                  <span>{t('myStatus.waitLabel')}</span>
                </div>
                <div className="mt-1.5 text-3xl font-extrabold text-salon-gold">
                  ~{entry.estimated_wait_minutes ?? 0}
                  <span className="text-sm font-semibold text-gray-300 ml-1">
                    {t('app.minutes')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="rounded-xl bg-salon-dark/60 border border-white/10 p-4 text-left space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-400">{t('myStatus.customerLabel')}</span>
              <span className="font-semibold text-white">{entry.customer_name}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-400">{t('myStatus.barberLabel')}</span>
              <span className="font-semibold text-white">{barberDisplayName}</span>
            </div>
            <div className="pt-2 border-t border-white/10">
              <div className="text-gray-400 text-xs mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-salon-gold" />
                <span>{t('myStatus.servicesLabel')}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(entry.services || []).map((svc, idx) => (
                  <span
                    key={`${svc.service_id || idx}`}
                    className="px-2.5 py-1 rounded-lg bg-salon-card border border-white/10 text-xs font-medium text-white"
                  >
                    {getLocalized(svc, 'name')} ({svc.duration_minutes}m)
                  </span>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-gray-400">{t('myStatus.totalLabel')}</span>
              <span className="font-bold text-salon-gold">
                {entry.total_duration_minutes} {t('app.minutes')} • {t('app.currency')}
                {entry.total_price}
              </span>
            </div>
          </div>

          {isWaiting && (
            <button
              type="button"
              onClick={() => setShowCancelDialog(true)}
              className="btn-danger w-full"
            >
              {t('myStatus.cancelSpotBtn')}
            </button>
          )}

          <p className="text-xs text-gray-400">{t('myStatus.autoUpdateHint')}</p>
        </section>
      </main>

      <ConfirmDialog
        open={showCancelDialog}
        title={t('myStatus.cancelDialogTitle')}
        message={t('myStatus.cancelDialogMessage', { token: entry.token_number })}
        confirmLabel={t('myStatus.cancelConfirmBtn')}
        loading={cancelling}
        onConfirm={handleCancelConfirm}
        onCancel={() => setShowCancelDialog(false)}
      />
    </>
  );
}
