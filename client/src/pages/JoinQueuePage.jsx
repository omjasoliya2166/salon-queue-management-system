import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  User,
  Phone,
  Check,
  Clock,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Users,
  CheckCircle2,
} from 'lucide-react';
import {
  MAX_SERVICES_PER_BOOKING,
  BARBER_STATUSES,
  validatePhone,
  calculateBookingSummary,
  estimateWaitMinutes,
} from '@shared/queueEngine.js';
import { useQueue } from '../context/QueueContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { api } from '../services/api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { LoadingState, ErrorBanner, EmptyState } from '../components/FeedbackStates.jsx';

export default function JoinQueuePage() {
  const { state, loading, error, nowMs, refreshState } = useQueue();
  const { t, getLocalized } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [preferredBarberId, setPreferredBarberId] = useState('');

  const [fieldError, setFieldError] = useState('');
  const [limitNotice, setLimitNotice] = useState('');
  const [duplicateEntry, setDuplicateEntry] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const activeServices = useMemo(
    () => (state?.services || []).filter((s) => s.is_active),
    [state]
  );
  const workingBarbers = useMemo(
    () => (state?.barbers || []).filter((b) => b.is_active && b.is_working_today),
    [state]
  );

  // Pre-select a service if navigated from Home service card
  useEffect(() => {
    const preselected = searchParams.get('service');
    if (preselected && activeServices.some((s) => s.id === preselected)) {
      setSelectedServiceIds((prev) => (prev.length === 0 ? [preselected] : prev));
    }
  }, [searchParams, activeServices]);

  const selectedServices = useMemo(
    () => activeServices.filter((s) => selectedServiceIds.includes(s.id)),
    [activeServices, selectedServiceIds]
  );

  const summary = useMemo(() => calculateBookingSummary(selectedServices), [selectedServices]);

  const estimatedWait = useMemo(() => {
    if (!state) return 0;
    return estimateWaitMinutes({
      queueEntries: state.active_entries || [],
      barbers: state.barbers || [],
      preferredBarberId: preferredBarberId || null,
      targetEntryId: null,
      nowMs,
    });
  }, [state, preferredBarberId, nowMs]);

  const selectedBarberObj = useMemo(
    () => workingBarbers.find((b) => b.id === preferredBarberId) || null,
    [workingBarbers, preferredBarberId]
  );

  if (loading && !state) return <LoadingState />;

  const isOnlineOpen = Boolean(state?.online_queue_status?.isOnlineJoiningOpen);

  const toggleService = (serviceId) => {
    setFieldError('');
    setLimitNotice('');
    setSelectedServiceIds((prev) => {
      if (prev.includes(serviceId)) {
        return prev.filter((id) => id !== serviceId);
      }
      if (prev.length >= MAX_SERVICES_PER_BOOKING) {
        setLimitNotice(t('validation.maxThreeServices'));
        return prev;
      }
      return [...prev, serviceId];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldError('');
    setDuplicateEntry(null);

    if (!isOnlineOpen) {
      setFieldError(t('join.closedNotice'));
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setFieldError(t('validation.invalidName'));
      return;
    }

    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) {
      setFieldError(t('validation.invalidPhone'));
      return;
    }

    if (selectedServiceIds.length === 0) {
      setFieldError(t('validation.selectAtLeastOneService'));
      return;
    }

    if (selectedServiceIds.length > MAX_SERVICES_PER_BOOKING) {
      setFieldError(t('validation.maxThreeServices'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.joinQueue({
        name: trimmedName,
        phone: phoneCheck.normalized,
        serviceIds: selectedServiceIds,
        preferredBarberId: preferredBarberId || null,
      });
      if (res.entry?.id) {
        navigate(`/status/${res.entry.id}`);
      }
    } catch (err) {
      if (err.status === 409 && err.payload?.existingEntry) {
        setDuplicateEntry(err.payload.existingEntry);
      } else if (err.status === 403) {
        setFieldError(t('join.closedNotice'));
      } else if (err.status === 0) {
        setFieldError(t('validation.networkError'));
      } else {
        setFieldError(err.message || t('validation.genericError'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 animate-fade-in-up">
      <ErrorBanner message={error} onRetry={() => refreshState()} />

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{t('join.title')}</h1>
        <p className="text-sm text-gray-400 mt-1">{t('join.subtitle')}</p>
      </div>

      {!isOnlineOpen && (
        <div className="mb-6 rounded-2xl bg-amber-500/15 border border-amber-500/40 p-5 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-200">{t('home.onlineClosedBanner')}</p>
            <p className="text-sm text-amber-100/85 mt-1">{t('join.closedNotice')}</p>
            <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-salon-gold mt-3 hover:underline">
              {t('app.backHome')}
            </Link>
          </div>
        </div>
      )}

      {duplicateEntry && (
        <div className="mb-6 rounded-2xl bg-salon-gold/15 border border-salon-gold/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-salon-gold shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">{t('join.duplicateTitle')}</p>
              <p className="text-sm text-gray-200 mt-0.5">
                {t('join.duplicateSubtitle', {
                  token: duplicateEntry.token_number,
                  status: t(`status.${duplicateEntry.status}`),
                })}
              </p>
            </div>
          </div>
          <Link to={`/status/${duplicateEntry.id}`} className="btn-gold shrink-0">
            <span>{t('join.viewExistingBtn')}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form Steps */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <section className="salon-card p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-1.5">
                  {t('join.nameLabel')} *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setFieldError('');
                    }}
                    placeholder={t('join.namePlaceholder')}
                    className="salon-input pl-10"
                    disabled={!isOnlineOpen}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-1.5">
                  {t('join.phoneLabel')} *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 12));
                      setFieldError('');
                      setDuplicateEntry(null);
                    }}
                    placeholder={t('join.phonePlaceholder')}
                    className="salon-input pl-10"
                    disabled={!isOnlineOpen}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Service Selection */}
          <section className="salon-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-salon-gold" />
                  <span>{t('join.servicesLabel')} *</span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">{t('join.servicesHint')}</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-salon-gold/15 text-salon-gold border border-salon-gold/30">
                {t('join.selectedCount', { count: selectedServiceIds.length })}
              </span>
            </div>

            {limitNotice && (
              <div className="rounded-xl bg-amber-500/15 border border-amber-500/35 px-3.5 py-2.5 text-xs text-amber-200">
                {limitNotice}
              </div>
            )}

            {activeServices.length === 0 ? (
              <EmptyState title={t('home.noServices')} icon={Sparkles} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeServices.map((svc) => {
                  const isSelected = selectedServiceIds.includes(svc.id);
                  const maxReached =
                    !isSelected && selectedServiceIds.length >= MAX_SERVICES_PER_BOOKING;
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      disabled={!isOnlineOpen}
                      onClick={() => toggleService(svc.id)}
                      className={`text-left rounded-xl p-4 border transition-all flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'bg-salon-gold/15 border-salon-gold shadow-md shadow-salon-gold/10'
                          : maxReached
                            ? 'bg-salon-dark/40 border-white/5 opacity-55 hover:border-amber-500/40'
                            : 'bg-salon-dark/60 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm sm:text-base">
                          {getLocalized(svc, 'name')}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-gray-300">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-salon-gold" />
                            {svc.duration_minutes} {t('app.minutes')}
                          </span>
                          <span className="font-bold text-salon-gold">
                            {t('app.currency')}
                            {svc.price}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition ${
                          isSelected
                            ? 'bg-salon-gold border-salon-gold text-salon-dark'
                            : 'border-white/25 bg-transparent'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Preferred Barber Selection */}
          <section className="salon-card p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-salon-gold" />
              <span>{t('join.barberLabel')}</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Any Barber */}
              <button
                type="button"
                disabled={!isOnlineOpen}
                onClick={() => setPreferredBarberId('')}
                className={`text-left rounded-xl p-4 border transition-all flex items-center justify-between gap-3 ${
                  preferredBarberId === ''
                    ? 'bg-salon-gold/15 border-salon-gold'
                    : 'bg-salon-dark/60 border-white/10 hover:border-white/30'
                }`}
              >
                <div>
                  <div className="font-bold text-white text-sm">{t('app.anyBarberFastest')}</div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    preferredBarberId === '' ? 'border-salon-gold' : 'border-white/30'
                  }`}
                >
                  {preferredBarberId === '' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-salon-gold" />
                  )}
                </div>
              </button>

              {workingBarbers.map((barber) => {
                const selected = preferredBarberId === barber.id;
                return (
                  <button
                    key={barber.id}
                    type="button"
                    disabled={!isOnlineOpen}
                    onClick={() => setPreferredBarberId(barber.id)}
                    className={`text-left rounded-xl p-4 border transition-all flex items-center justify-between gap-3 ${
                      selected
                        ? 'bg-salon-gold/15 border-salon-gold'
                        : 'bg-salon-dark/60 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white text-sm truncate">{barber.name}</div>
                      <div className="mt-1">
                        <StatusBadge status={barber.status} />
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selected ? 'border-salon-gold' : 'border-white/30'
                      }`}
                    >
                      {selected && <div className="w-2.5 h-2.5 rounded-full bg-salon-gold" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedBarberObj?.status === BARBER_STATUSES.ON_BREAK && (
              <div className="rounded-xl bg-amber-500/15 border border-amber-500/35 px-4 py-3 text-xs sm:text-sm text-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{t('join.barberOnBreakNotice', { name: selectedBarberObj.name })}</span>
              </div>
            )}
          </section>
        </div>

        {/* Right Live Booking Summary */}
        <aside className="lg:col-span-1">
          <div className="salon-card-gold p-5 sm:p-6 sticky top-20 space-y-5">
            <h2 className="text-lg font-bold text-white border-b border-white/10 pb-3">
              {t('join.summaryTitle')}
            </h2>

            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-gray-400">{t('join.selectedServices')}</div>
                <div className="mt-1 font-semibold text-white">
                  {selectedServices.length > 0
                    ? selectedServices.map((s) => getLocalized(s, 'name')).join(' + ')
                    : t('join.noServicesChosen')}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-gray-400">{t('join.barberLabel')}</span>
                <span className="font-semibold text-white">
                  {selectedBarberObj ? selectedBarberObj.name : t('app.anyBarber')}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">{t('join.totalDuration')}</span>
                <span className="font-semibold text-white">
                  {summary.totalDuration} {t('app.minutesFull')}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">{t('join.totalPrice')}</span>
                <span className="text-xl font-extrabold text-salon-gold">
                  {t('app.currency')}
                  {summary.totalPrice}
                </span>
              </div>

              <div className="rounded-xl bg-salon-dark/80 border border-white/10 p-3.5 flex items-center justify-between">
                <span className="text-xs text-gray-300">{t('join.estimatedWait')}</span>
                <span className="text-base font-bold text-salon-goldLight">
                  ~{estimatedWait} {t('app.minutesFull')}
                </span>
              </div>
            </div>

            {fieldError && (
              <div className="rounded-xl bg-red-500/15 border border-red-500/40 px-3.5 py-2.5 text-xs sm:text-sm text-red-200">
                {fieldError}
              </div>
            )}

            <button
              type="submit"
              disabled={!isOnlineOpen || submitting || activeServices.length === 0}
              className="btn-gold w-full py-3.5 text-base"
            >
              <span>{submitting ? t('join.submitting') : t('join.confirmBtn')}</span>
              {!submitting && <ArrowRight className="w-5 h-5" />}
            </button>
          </div>
        </aside>
      </form>
    </main>
  );
}
