import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Play,
  CheckCircle2,
  Coffee,
  UserCheck,
  Clock,
  Sparkles,
  ArrowLeft,
  Scissors,
  Users,
  AlertTriangle,
} from 'lucide-react';
import {
  QUEUE_STATUSES,
  BARBER_STATUSES,
  getBarberCurrentEntry,
  findNextEligibleCustomer,
  getElapsedSeconds,
  formatTimerMMSS,
} from '@shared/queueEngine.js';
import { useQueue } from '../context/QueueContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { api } from '../services/api.js';
import PinGate from '../components/PinGate.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { LoadingState, ErrorBanner, EmptyState } from '../components/FeedbackStates.jsx';

function BarberWorkspace() {
  const { name } = useParams();
  const { state, loading, error, nowMs, refreshState } = useQueue();
  const { t, getLocalized } = useLanguage();

  const [busyAction, setBusyAction] = useState('');
  const [actionError, setActionError] = useState('');

  const activeBarbers = useMemo(
    () => (state?.barbers || []).filter((b) => b.is_active),
    [state]
  );
  const activeEntries = state?.active_entries || [];

  if (loading && !state) return <LoadingState />;

  // If no :name param, show barber station selector
  if (!name) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fade-in-up">
        <ErrorBanner message={error} onRetry={() => refreshState()} />
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            {t('barber.pickerTitle')}
          </h1>
          <p className="text-sm text-gray-400 mt-1">{t('barber.pickerSubtitle')}</p>
        </div>

        {activeBarbers.length === 0 ? (
          <EmptyState title={t('home.noWorkingBarbers')} icon={Users} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {activeBarbers.map((barber) => {
              const current = getBarberCurrentEntry(barber.id, activeEntries);
              return (
                <Link
                  key={barber.id}
                  to={`/barber/${encodeURIComponent(barber.slug || barber.name.toLowerCase())}`}
                  className="salon-card-gold p-5 flex flex-col justify-between gap-4 hover:scale-[1.01] transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-salon-gold/15 border border-salon-gold/40 flex items-center justify-center text-salon-gold font-extrabold text-xl">
                      {barber.name.charAt(0).toUpperCase()}
                    </div>
                    <StatusBadge status={barber.status} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{barber.name}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {getLocalized(barber, 'specialty')}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-white/10 text-xs flex items-center justify-between">
                    <span className="text-gray-400">{t('barber.currentCustomer')}</span>
                    <span className="font-bold text-salon-gold">
                      {current ? current.token_number : '—'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    );
  }

  const normalizedParam = decodeURIComponent(name).toLowerCase();
  const barber = activeBarbers.find(
    (b) =>
      b.slug.toLowerCase() === normalizedParam ||
      b.name.toLowerCase() === normalizedParam ||
      b.id.toLowerCase() === normalizedParam
  );

  if (!barber) {
    return (
      <main className="max-w-lg mx-auto px-4 py-12">
        <EmptyState
          title={t('barber.notFound')}
          icon={Scissors}
          action={
            <Link to="/barber" className="btn-gold">
              <ArrowLeft className="w-4 h-4" />
              <span>{t('barber.backToList')}</span>
            </Link>
          }
        />
      </main>
    );
  }

  const currentEntry = getBarberCurrentEntry(barber.id, activeEntries);
  const nextEligible = findNextEligibleCustomer(barber.id, activeEntries);

  const isCalled = currentEntry?.status === QUEUE_STATUSES.CALLED;
  const isInChair = currentEntry?.status === QUEUE_STATUSES.IN_CHAIR;
  const isAvailable = barber.status === BARBER_STATUSES.AVAILABLE;
  const isOnBreak = barber.status === BARBER_STATUSES.ON_BREAK;
  const isBusy = barber.status === BARBER_STATUSES.BUSY || Boolean(currentEntry);

  const elapsedSeconds =
    isInChair && currentEntry?.started_at
      ? getElapsedSeconds(currentEntry.started_at, nowMs)
      : 0;

  const estimatedTotalSeconds = Number(currentEntry?.total_duration_minutes || 0) * 60;
  const isOvertime = isInChair && estimatedTotalSeconds > 0 && elapsedSeconds > estimatedTotalSeconds;

  const runAction = async (key, fn) => {
    setBusyAction(key);
    setActionError('');
    try {
      await fn();
    } catch (err) {
      setActionError(err.message || t('validation.genericError'));
    } finally {
      setBusyAction('');
    }
  };

  return (
    <main className="max-w-lg mx-auto px-4 py-6 space-y-5 animate-fade-in-up">
      <ErrorBanner message={error || actionError} onRetry={() => { setActionError(''); refreshState(); }} />

      {/* Top Barber Header */}
      <section className="salon-card-gold p-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/barber"
            className="p-2 rounded-xl bg-salon-dark border border-white/10 text-gray-300 hover:text-white"
            aria-label={t('barber.backToList')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-white truncate">{barber.name}</h1>
            <p className="text-xs text-gray-400 truncate">{getLocalized(barber, 'specialty')}</p>
          </div>
        </div>
        <StatusBadge status={barber.status} size="lg" />
      </section>

      {isOnBreak && (
        <div className="rounded-2xl bg-amber-500/15 border border-amber-500/40 p-4 flex items-start gap-3 text-sm text-amber-200">
          <Coffee className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <span>{t('barber.onBreakBanner')}</span>
        </div>
      )}

      {/* Current Customer Card */}
      <section className="salon-card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
            {t('barber.currentCustomer')}
          </h2>
          {currentEntry && <StatusBadge status={currentEntry.status} size="md" />}
        </div>

        {currentEntry ? (
          <>
            <div className="text-center py-3 rounded-2xl bg-salon-dark/80 border border-salon-gold/30">
              <div className="text-5xl font-black text-salon-gold">
                {currentEntry.token_number}
              </div>
              <div className="mt-2 text-xl font-bold text-white">
                {currentEntry.customer_name}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {isCalled ? t('barber.calledPrompt') : t('barber.inChairPrompt')}
              </p>
            </div>

            {/* Services */}
            <div className="space-y-2">
              <div className="text-xs text-gray-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-salon-gold" />
                <span>{t('myStatus.servicesLabel')}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(currentEntry.services || []).map((svc, idx) => (
                  <span
                    key={`${svc.service_id || idx}`}
                    className="px-3 py-1.5 rounded-xl bg-salon-dark border border-white/10 text-xs font-semibold text-white"
                  >
                    {getLocalized(svc, 'name')} ({svc.duration_minutes}m)
                  </span>
                ))}
              </div>
            </div>

            {/* Duration & Live Elapsed Timer */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-salon-dark/70 border border-white/10 p-3.5 text-center">
                <div className="text-xs text-gray-400">{t('barber.estimatedDuration')}</div>
                <div className="mt-1 text-xl font-extrabold text-white">
                  {currentEntry.total_duration_minutes} {t('app.minutes')}
                </div>
              </div>
              <div
                className={`rounded-xl border p-3.5 text-center ${
                  isOvertime
                    ? 'bg-amber-500/15 border-amber-500/50'
                    : 'bg-salon-dark/70 border-white/10'
                }`}
              >
                <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-salon-gold" />
                  <span>{t('barber.elapsedTime')}</span>
                </div>
                <div
                  className={`mt-1 text-2xl font-mono font-black ${
                    isOvertime ? 'text-amber-300' : 'text-salon-gold'
                  }`}
                >
                  {formatTimerMMSS(elapsedSeconds)}
                </div>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title={t('barber.noCustomerAssigned')}
            description={t('barber.waitingForReception')}
            icon={Scissors}
          />
        )}

        {/* Primary Action Buttons (Start / Done) */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            disabled={!isCalled || Boolean(busyAction)}
            onClick={() =>
              runAction('start', () => api.barberStart(barber.id, currentEntry?.id))
            }
            className="btn-gold py-4 text-base"
          >
            <Play className="w-5 h-5" />
            <span>{busyAction === 'start' ? '...' : t('barber.startBtn')}</span>
          </button>

          <button
            type="button"
            disabled={!isInChair || Boolean(busyAction)}
            onClick={() => runAction('done', () => api.barberDone(barber.id, currentEntry?.id))}
            className="btn-success py-4 text-base"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{busyAction === 'done' ? '...' : t('barber.doneBtn')}</span>
          </button>
        </div>

        {/* Availability Controls (On Break / Available) */}
        <div className="pt-3 border-t border-white/10 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!isAvailable || isBusy || Boolean(busyAction)}
              onClick={() =>
                runAction('break', () => api.barberSetStatus(barber.id, BARBER_STATUSES.ON_BREAK))
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500/20 border border-amber-500/40 px-4 py-3 text-sm font-bold text-amber-200 hover:bg-amber-500/30 disabled:opacity-35 disabled:cursor-not-allowed transition"
            >
              <Coffee className="w-4 h-4" />
              <span>{busyAction === 'break' ? '...' : t('barber.onBreakBtn')}</span>
            </button>

            <button
              type="button"
              disabled={!isOnBreak || isBusy || Boolean(busyAction)}
              onClick={() =>
                runAction('available', () =>
                  api.barberSetStatus(barber.id, BARBER_STATUSES.AVAILABLE)
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-4 py-3 text-sm font-bold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-35 disabled:cursor-not-allowed transition"
            >
              <UserCheck className="w-4 h-4" />
              <span>{busyAction === 'available' ? '...' : t('barber.availableBtn')}</span>
            </button>
          </div>

          {isBusy && (
            <p className="text-xs text-gray-400 flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('barber.cannotBreakBusy')}</span>
            </p>
          )}
        </div>
      </section>

      {/* "Next for you" Card */}
      <section className="salon-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-salon-gold">
            {t('barber.nextForYouTitle')}
          </h2>
          {nextEligible && (
            <span className="text-xs font-semibold text-gray-400">
              {nextEligible.preferred_barber_id ? barber.name : t('app.anyBarber')}
            </span>
          )}
        </div>

        {nextEligible ? (
          <div className="rounded-xl bg-salon-dark/70 border border-white/10 p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-salon-gold">
                  {nextEligible.token_number}
                </span>
                <span className="font-bold text-white truncate">
                  {nextEligible.customer_name}
                </span>
              </div>
              <div className="text-xs text-gray-300 mt-1 truncate">
                {(nextEligible.services || []).map((s) => getLocalized(s, 'name')).join(', ')}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-bold text-white">
                {nextEligible.total_duration_minutes} {t('app.minutes')}
              </div>
              <div className="text-xs text-salon-gold">
                {t('app.currency')}
                {nextEligible.total_price}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">{t('barber.noNextCustomer')}</p>
        )}
      </section>
    </main>
  );
}

export default function BarberPage() {
  return (
    <PinGate requiredRole="staff">
      <BarberWorkspace />
    </PinGate>
  );
}
