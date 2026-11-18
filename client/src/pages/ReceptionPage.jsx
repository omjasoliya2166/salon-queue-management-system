import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  Users,
  Scissors,
  Clock,
  CheckCircle2,
  PhoneCall,
  UserX,
  XCircle,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react';
import {
  QUEUE_STATUSES,
  BARBER_STATUSES,
  MAX_SERVICES_PER_BOOKING,
  canBarberReceiveCustomer,
  getBarberCurrentEntry,
  findNextEligibleCustomer,
  getWaitingQueueOrdered,
  getElapsedMinutes,
  getElapsedSeconds,
  formatTimerMMSS,
  isLongWait,
  isNoShowGraceElapsed,
  validatePhone,
  calculateBookingSummary,
} from '@shared/queueEngine.js';
import { useQueue } from '../context/QueueContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { api } from '../services/api.js';
import PinGate from '../components/PinGate.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { LoadingState, ErrorBanner, EmptyState } from '../components/FeedbackStates.jsx';

function WalkInModal({ open, onClose, services, barbers, onSuccess }) {
  const { t, getLocalized } = useLanguage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [preferredBarberId, setPreferredBarberId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeServices = services.filter((s) => s.is_active);
  const workingBarbers = barbers.filter((b) => b.is_active && b.is_working_today);
  const selectedServices = activeServices.filter((s) => selectedIds.includes(s.id));
  const summary = calculateBookingSummary(selectedServices);

  if (!open) return null;

  const toggleService = (id) => {
    setError('');
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SERVICES_PER_BOOKING) {
        setError(t('validation.maxThreeServices'));
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) {
      setError(t('validation.invalidName'));
      return;
    }
    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) {
      setError(t('validation.invalidPhone'));
      return;
    }
    if (selectedIds.length === 0) {
      setError(t('validation.selectAtLeastOneService'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.addWalkIn({
        name: name.trim(),
        phone: phoneCheck.normalized,
        serviceIds: selectedIds,
        preferredBarberId: preferredBarberId || null,
      });
      setName('');
      setPhone('');
      setSelectedIds([]);
      setPreferredBarberId('');
      onSuccess(res.entry);
      onClose();
    } catch (err) {
      if (err.status === 409 && err.payload?.existingEntry) {
        setError(
          `${t('join.duplicateTitle')} (${err.payload.existingEntry.token_number})`
        );
      } else {
        setError(err.message || t('validation.genericError'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="salon-card-gold w-full max-w-xl p-6 my-8 animate-fade-in-up">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">{t('reception.walkInModalTitle')}</h2>
            <p className="text-xs text-gray-400 mt-1">{t('reception.walkInModalSubtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white"
            aria-label={t('app.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                {t('join.nameLabel')} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('join.namePlaceholder')}
                className="salon-input py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                {t('join.phoneLabel')} *
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder={t('join.phonePlaceholder')}
                className="salon-input py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-300">
                {t('join.servicesLabel')} *
              </label>
              <span className="text-xs text-salon-gold font-semibold">
                {t('join.selectedCount', { count: selectedIds.length })}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeServices.map((svc) => {
                const selected = selectedIds.includes(svc.id);
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => toggleService(svc.id)}
                    className={`text-left rounded-xl p-3 border text-xs flex items-center justify-between gap-2 transition ${
                      selected
                        ? 'bg-salon-gold/15 border-salon-gold text-white'
                        : 'bg-salon-dark/60 border-white/10 text-gray-300 hover:border-white/25'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-white">{getLocalized(svc, 'name')}</div>
                      <div className="text-gray-400 mt-0.5">
                        {svc.duration_minutes}m • {t('app.currency')}
                        {svc.price}
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                        selected
                          ? 'bg-salon-gold border-salon-gold text-salon-dark'
                          : 'border-white/25'
                      }`}
                    >
                      {selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              {t('join.barberLabel')}
            </label>
            <select
              value={preferredBarberId}
              onChange={(e) => setPreferredBarberId(e.target.value)}
              className="salon-input py-2.5 text-sm"
            >
              <option value="">{t('app.anyBarberFastest')}</option>
              {workingBarbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({t(`status.${b.status}`)})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl bg-salon-dark/70 border border-white/10 p-3 flex items-center justify-between text-sm">
            <span className="text-gray-300">
              {summary.totalDuration} {t('app.minutesFull')}
            </span>
            <span className="font-extrabold text-salon-gold text-base">
              {t('app.currency')}
              {summary.totalPrice}
            </span>
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/15 border border-red-500/40 px-3.5 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">
              {t('app.cancel')}
            </button>
            <button type="submit" disabled={submitting} className="btn-gold text-sm">
              {submitting ? '...' : t('reception.walkInSubmitBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReceptionDashboardContent() {
  const { state, loading, error, nowMs, refreshState } = useQueue();
  const { t, getLocalized } = useLanguage();

  const [actionError, setActionError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [walkInOpen, setWalkInOpen] = useState(false);

  const [noShowTarget, setNoShowTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [assignModalEntry, setAssignModalEntry] = useState(null);

  const activeEntries = state?.active_entries || [];
  const barbers = state?.barbers || [];
  const services = state?.services || [];
  const workingBarbers = useMemo(
    () => barbers.filter((b) => b.is_active && b.is_working_today),
    [barbers]
  );

  const calledEntries = useMemo(
    () => activeEntries.filter((e) => e.status === QUEUE_STATUSES.CALLED),
    [activeEntries]
  );
  const waitingEntries = useMemo(() => getWaitingQueueOrdered(activeEntries), [activeEntries]);
  const tableEntries = useMemo(
    () => [...calledEntries, ...waitingEntries],
    [calledEntries, waitingEntries]
  );

  const servingCount = activeEntries.filter(
    (e) => e.status === QUEUE_STATUSES.CALLED || e.status === QUEUE_STATUSES.IN_CHAIR
  ).length;
  const availableBarbersCount = workingBarbers.filter((b) =>
    canBarberReceiveCustomer(b, activeEntries)
  ).length;

  if (loading && !state) return <LoadingState />;

  const handleCallNextForBarber = async (barberId, entryId = null) => {
    setActionError('');
    setBusyKey(`call-${barberId}-${entryId || 'next'}`);
    try {
      await api.callNext(barberId, entryId);
      setAssignModalEntry(null);
    } catch (err) {
      setActionError(err.message || t('validation.genericError'));
    } finally {
      setBusyKey('');
    }
  };

  const handleRowCallClick = (entry) => {
    setActionError('');
    const freeBarbers = workingBarbers.filter((b) => canBarberReceiveCustomer(b, activeEntries));
    if (entry.preferred_barber_id) {
      const preferredFree = freeBarbers.find((b) => b.id === entry.preferred_barber_id);
      if (!preferredFree) {
        setActionError(t('reception.noBarberFree'));
        return;
      }
      handleCallNextForBarber(preferredFree.id, entry.id);
      return;
    }
    if (freeBarbers.length === 0) {
      setActionError(t('reception.noBarberFree'));
      return;
    }
    if (freeBarbers.length === 1) {
      handleCallNextForBarber(freeBarbers[0].id, entry.id);
      return;
    }
    setAssignModalEntry(entry);
  };

  const confirmNoShow = async () => {
    if (!noShowTarget) return;
    setBusyKey(`noshow-${noShowTarget.id}`);
    setActionError('');
    try {
      await api.markNoShow(noShowTarget.id);
      setNoShowTarget(null);
    } catch (err) {
      setActionError(err.message || t('validation.genericError'));
      setNoShowTarget(null);
    } finally {
      setBusyKey('');
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setBusyKey(`cancel-${cancelTarget.id}`);
    setActionError('');
    try {
      await api.receptionCancel(cancelTarget.id);
      setCancelTarget(null);
    } catch (err) {
      setActionError(err.message || t('validation.genericError'));
      setCancelTarget(null);
    } finally {
      setBusyKey('');
    }
  };

  const freeBarbersForAssign = workingBarbers.filter((b) =>
    canBarberReceiveCustomer(b, activeEntries)
  );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5 animate-fade-in-up">
      <ErrorBanner message={error || actionError} onRetry={() => { setActionError(''); refreshState(); }} />

      {/* Header + Walk-in CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">{t('reception.title')}</h1>
          <p className="text-xs sm:text-sm text-gray-400">{t('reception.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setWalkInOpen(true)}
          className="btn-gold text-sm sm:text-base px-5 py-3 shadow-lg shadow-salon-gold/20"
        >
          <UserPlus className="w-5 h-5" />
          <span>{t('reception.addWalkIn')}</span>
        </button>
      </div>

      {/* Top KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="salon-card p-4">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{t('reception.kpiWaiting')}</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-white">
            {waitingEntries.length}
          </div>
        </div>
        <div className="salon-card p-4">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{t('reception.kpiServing')}</span>
            <Scissors className="w-4 h-4 text-salon-gold" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-salon-gold">
            {servingCount}
          </div>
        </div>
        <div className="salon-card p-4">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{t('reception.kpiAvailable')}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-400">
            {availableBarbersCount}{' '}
            <span className="text-base font-semibold text-gray-400">/ {workingBarbers.length}</span>
          </div>
        </div>
        <div className="salon-card p-4">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{t('reception.kpiAvgWait')}</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-white">
            {state?.daily_stats?.average_wait_minutes ?? state?.estimated_wait_minutes ?? 0}{' '}
            <span className="text-sm font-medium text-gray-400">{t('app.minutes')}</span>
          </div>
        </div>
      </section>

      {/* Main Tablet-Landscape Split: Left Barbers (4 cols) | Right Queue Table (8 cols) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Barber Management Cards */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Scissors className="w-4 h-4 text-salon-gold" />
            <span>{t('reception.barbersPanelTitle')}</span>
          </h2>

          {workingBarbers.length === 0 ? (
            <EmptyState title={t('home.noWorkingBarbers')} icon={Users} />
          ) : (
            <div className="space-y-3">
              {workingBarbers.map((barber) => {
                const current = getBarberCurrentEntry(barber.id, activeEntries);
                const canCall = canBarberReceiveCustomer(barber, activeEntries);
                const nextEligible = findNextEligibleCustomer(barber.id, activeEntries);
                const isCalling = busyKey === `call-${barber.id}-next`;

                const timerSeconds = current
                  ? current.status === QUEUE_STATUSES.IN_CHAIR && current.started_at
                    ? getElapsedSeconds(current.started_at, nowMs)
                    : getElapsedSeconds(current.called_at, nowMs)
                  : 0;

                return (
                  <div
                    key={barber.id}
                    className={`rounded-2xl p-4 border transition ${
                      barber.status === BARBER_STATUSES.AVAILABLE
                        ? 'bg-salon-surface border-emerald-500/30'
                        : barber.status === BARBER_STATUSES.ON_BREAK
                          ? 'bg-salon-surface/80 border-amber-500/30'
                          : 'bg-salon-surface border-salon-gold/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-lg text-white">{barber.name}</div>
                      <StatusBadge status={barber.status} />
                    </div>

                    {current ? (
                      <div className="mt-3 rounded-xl bg-salon-dark/75 border border-white/10 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            {t('reception.currentCustomer')}
                          </span>
                          <StatusBadge status={current.status} />
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xl font-black text-salon-gold">
                            {current.token_number}
                          </span>
                          <span className="text-sm font-semibold text-white truncate">
                            {current.customer_name}
                          </span>
                        </div>
                        <div className="text-xs text-gray-300 truncate">
                          {(current.services || []).map((s) => getLocalized(s, 'name')).join(', ')}
                        </div>
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                          <span className="text-gray-400">
                            {current.status === QUEUE_STATUSES.IN_CHAIR
                              ? t('reception.serviceTimer')
                              : t('reception.calledTimer')}
                          </span>
                          <span className="font-mono font-bold text-white text-sm">
                            {formatTimerMMSS(timerSeconds)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl bg-salon-dark/40 border border-dashed border-white/10 px-3 py-3 text-xs text-gray-400 text-center">
                        {t('reception.noCurrentCustomer')}
                      </div>
                    )}

                    <div className="mt-3">
                      <button
                        type="button"
                        disabled={!canCall || !nextEligible || isCalling}
                        onClick={() => handleCallNextForBarber(barber.id)}
                        className="btn-gold w-full py-2.5 text-sm"
                      >
                        <PhoneCall className="w-4 h-4" />
                        <span>
                          {isCalling
                            ? '...'
                            : !nextEligible && canCall
                              ? t('reception.noEligibleShort')
                              : nextEligible && canCall
                                ? `${t('reception.callNextBtn')} (${nextEligible.token_number})`
                                : t('reception.callNextBtn')}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Waiting Queue Table */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-salon-gold" />
              <span>{t('reception.queuePanelTitle')}</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-salon-gold/15 text-salon-gold">
                {tableEntries.length}
              </span>
            </h2>
            {calledEntries.length > 0 && (
              <span className="text-xs text-gray-400">{t('reception.calledSectionHint')}</span>
            )}
          </div>

          {tableEntries.length === 0 ? (
            <EmptyState title={t('home.noOneWaiting')} icon={CheckCircle2} />
          ) : (
            <div className="salon-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-salon-dark/90 text-xs uppercase text-gray-400 border-b border-white/10">
                    <tr>
                      <th className="px-3.5 py-3">{t('reception.colToken')}</th>
                      <th className="px-3.5 py-3">{t('reception.colCustomer')}</th>
                      <th className="px-3.5 py-3">{t('reception.colPhone')}</th>
                      <th className="px-3.5 py-3">{t('reception.colServices')}</th>
                      <th className="px-3.5 py-3">{t('reception.colBarber')}</th>
                      <th className="px-3.5 py-3">{t('reception.colWait')}</th>
                      <th className="px-3.5 py-3">{t('reception.colStatus')}</th>
                      <th className="px-3.5 py-3 text-right">{t('reception.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {tableEntries.map((entry) => {
                      const longWait = isLongWait(entry, nowMs);
                      const waitedMins = getElapsedMinutes(entry.joined_at, nowMs);
                      const calledMins = getElapsedMinutes(entry.called_at, nowMs);
                      const graceReady = isNoShowGraceElapsed(entry, nowMs);
                      const isCalled = entry.status === QUEUE_STATUSES.CALLED;
                      const isWaiting = entry.status === QUEUE_STATUSES.WAITING;

                      const canBeCalledNow =
                        isWaiting &&
                        (entry.preferred_barber_id
                          ? freeBarbersForAssign.some((b) => b.id === entry.preferred_barber_id)
                          : freeBarbersForAssign.length > 0);

                      return (
                        <tr
                          key={entry.id}
                          className={`transition ${
                            longWait
                              ? 'bg-amber-500/15 hover:bg-amber-500/20'
                              : isCalled
                                ? 'bg-salon-gold/10 hover:bg-salon-gold/15'
                                : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <td className="px-3.5 py-3 font-black text-salon-gold whitespace-nowrap">
                            {entry.token_number}
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="font-semibold text-white">{entry.customer_name}</div>
                            {entry.source === 'walk-in' && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-400/30 text-[10px] font-semibold text-purple-200">
                                {t('app.walkIn')}
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 font-mono text-xs text-gray-300 whitespace-nowrap">
                            {entry.customer_phone}
                          </td>
                          <td className="px-3.5 py-3 text-xs text-gray-200 max-w-[180px]">
                            <div className="truncate" title={(entry.services || []).map((s) => getLocalized(s, 'name')).join(', ')}>
                              {(entry.services || []).map((s) => getLocalized(s, 'name')).join(', ')}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {entry.total_duration_minutes}m • {t('app.currency')}
                              {entry.total_price}
                            </div>
                          </td>
                          <td className="px-3.5 py-3 text-xs font-medium text-white whitespace-nowrap">
                            {entry.assigned_barber_name ||
                              entry.preferred_barber_name ||
                              t('app.anyBarber')}
                          </td>
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <div
                              className={`text-xs font-bold ${
                                longWait ? 'text-amber-300' : 'text-gray-200'
                              }`}
                            >
                              {waitedMins} {t('app.minutes')}
                            </div>
                            {longWait && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300">
                                <AlertTriangle className="w-3 h-3" />
                                {t('reception.longWaitTag')}
                              </span>
                            )}
                            {isCalled && (
                              <div
                                className={`text-[10px] font-semibold mt-0.5 ${
                                  graceReady ? 'text-red-300' : 'text-salon-goldLight'
                                }`}
                              >
                                {graceReady
                                  ? t('reception.noShowGraceReady')
                                  : `${t('reception.calledTimer')}: ${calledMins}m`}
                              </div>
                            )}
                          </td>
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <StatusBadge status={entry.status} />
                          </td>
                          <td className="px-3.5 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {isWaiting && (
                                <button
                                  type="button"
                                  disabled={!canBeCalledNow || Boolean(busyKey)}
                                  onClick={() => handleRowCallClick(entry)}
                                  className="px-2.5 py-1.5 rounded-lg bg-salon-gold text-salon-dark text-xs font-bold hover:bg-salon-goldLight disabled:opacity-35 transition inline-flex items-center gap-1"
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                  <span>{t('reception.callBtn')}</span>
                                </button>
                              )}
                              {isCalled && (
                                <button
                                  type="button"
                                  disabled={Boolean(busyKey)}
                                  onClick={() => setNoShowTarget(entry)}
                                  className="px-2.5 py-1.5 rounded-lg bg-red-600/90 text-white text-xs font-bold hover:bg-red-500 transition inline-flex items-center gap-1"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>{t('reception.noShowBtn')}</span>
                                </button>
                              )}
                              {isWaiting && (
                                <button
                                  type="button"
                                  disabled={Boolean(busyKey)}
                                  onClick={() => setCancelTarget(entry)}
                                  className="px-2.5 py-1.5 rounded-lg bg-salon-card border border-white/15 text-gray-200 text-xs font-semibold hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-200 transition inline-flex items-center gap-1"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>{t('reception.cancelBtn')}</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Walk-in Modal */}
      <WalkInModal
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        services={services}
        barbers={barbers}
        onSuccess={() => setActionError('')}
      />

      {/* Choose Barber Modal when calling an Any Barber row with multiple free barbers */}
      {assignModalEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="salon-card-gold w-full max-w-sm p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white">{t('reception.chooseBarberTitle')}</h3>
              <button
                type="button"
                onClick={() => setAssignModalEntry(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-300 mb-4">
              {t('reception.chooseBarberDesc', {
                token: assignModalEntry.token_number,
                name: assignModalEntry.customer_name,
              })}
            </p>
            <div className="space-y-2">
              {freeBarbersForAssign.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleCallNextForBarber(b.id, assignModalEntry.id)}
                  className="btn-gold w-full justify-between"
                >
                  <span>{b.name}</span>
                  <PhoneCall className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirm No-show */}
      <ConfirmDialog
        open={Boolean(noShowTarget)}
        title={t('reception.noShowConfirmTitle')}
        message={
          noShowTarget
            ? t('reception.noShowConfirmMsg', {
                token: noShowTarget.token_number,
                name: noShowTarget.customer_name,
                mins: getElapsedMinutes(noShowTarget.called_at, nowMs),
                barber: noShowTarget.assigned_barber_name || '',
              })
            : ''
        }
        note={
          noShowTarget && !isNoShowGraceElapsed(noShowTarget, nowMs)
            ? t('reception.noShowEarlyNote', {
                mins: getElapsedMinutes(noShowTarget.called_at, nowMs),
              })
            : null
        }
        confirmLabel={t('reception.noShowBtn')}
        loading={Boolean(busyKey)}
        onConfirm={confirmNoShow}
        onCancel={() => setNoShowTarget(null)}
      />

      {/* Confirm Cancel */}
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title={t('reception.cancelConfirmTitle')}
        message={
          cancelTarget
            ? t('reception.cancelConfirmMsg', {
                token: cancelTarget.token_number,
                name: cancelTarget.customer_name,
              })
            : ''
        }
        confirmLabel={t('reception.cancelBtn')}
        loading={Boolean(busyKey)}
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </main>
  );
}

export default function ReceptionPage() {
  return (
    <PinGate requiredRole="staff">
      <ReceptionDashboardContent />
    </PinGate>
  );
}
