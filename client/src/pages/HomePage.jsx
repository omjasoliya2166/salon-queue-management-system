import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Scissors,
  Clock,
  Users,
  Sparkles,
  MapPin,
  Phone,
  ArrowRight,
  Search,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';
import {
  BARBER_STATUSES,
  getBarberCurrentEntry,
  validatePhone,
} from '@shared/queueEngine.js';
import { useQueue } from '../context/QueueContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { api } from '../services/api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import {
  LoadingState,
  ErrorBanner,
  EmptyState,
  formatTime12h,
} from '../components/FeedbackStates.jsx';

export default function HomePage() {
  const { state, loading, error, refreshState } = useQueue();
  const { t, getLocalized } = useLanguage();
  const navigate = useNavigate();

  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  if (loading && !state) return <LoadingState />;

  const settings = state?.settings;
  const onlineStatus = state?.online_queue_status;
  const services = (state?.services || []).filter((s) => s.is_active);
  const workingBarbers = (state?.barbers || []).filter((b) => b.is_active && b.is_working_today);
  const activeEntries = state?.active_entries || [];
  const waitingCount = state?.waiting_count ?? 0;
  const estWait = state?.estimated_wait_minutes ?? 0;

  const isOnlineOpen = Boolean(onlineStatus?.isOnlineJoiningOpen);
  const isSalonOpen = Boolean(onlineStatus?.isSalonOpen);
  const openBadgeStatus = !isSalonOpen ? 'closed' : isOnlineOpen ? 'open' : 'onlineClosed';

  const hasAvailableBarber = workingBarbers.some((b) => b.status === BARBER_STATUSES.AVAILABLE);

  const getClosedReasonText = () => {
    if (!onlineStatus) return t('home.onlineClosedBanner');
    if (onlineStatus.reason === 'closing_soon') {
      return t('home.onlineClosedCutoff', {
        cutoff: formatTime12h(onlineStatus.onlineCutoffTime),
      });
    }
    if (onlineStatus.reason === 'outside_hours') {
      return t('home.onlineClosedHours', {
        open: formatTime12h(settings?.opening_time),
        close: formatTime12h(settings?.closing_time),
      });
    }
    return t('home.onlineClosedManual');
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    setLookupError('');
    const check = validatePhone(lookupPhone);
    if (!check.valid) {
      setLookupError(t('validation.invalidPhone'));
      return;
    }
    setLookupLoading(true);
    try {
      const res = await api.lookupByPhone(check.normalized);
      if (res.entry?.id) {
        navigate(`/status/${res.entry.id}`);
      }
    } catch (err) {
      if (err.status === 404) {
        setLookupError(t('home.noActiveTokenFound'));
      } else {
        setLookupError(t('validation.networkError'));
      }
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 animate-fade-in-up">
      <ErrorBanner message={error} onRetry={() => refreshState()} />

      {/* Hero Card */}
      <section className="salon-card-gold relative overflow-hidden p-6 sm:p-8">
        <div className="absolute -right-12 -top-12 w-52 h-52 rounded-full bg-salon-gold/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-salon-gold to-salon-goldDark flex items-center justify-center shadow-lg shadow-salon-gold/20 shrink-0">
                <Scissors className="w-7 h-7 text-salon-dark" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {getLocalized(settings, 'salon_name') || 'Regal Crown Salon'}
                </h1>
                <p className="text-xs sm:text-sm text-salon-goldLight font-medium mt-0.5">
                  {t('app.tagline')}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <StatusBadge status={openBadgeStatus} size="md" />
              {settings && (
                <div className="flex items-center gap-1.5 text-xs text-gray-300">
                  <Clock className="w-3.5 h-3.5 text-salon-gold" />
                  <span>
                    {t('home.openingHours')}: {formatTime12h(settings.opening_time)} –{' '}
                    {formatTime12h(settings.closing_time)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Live Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-xl bg-salon-dark/70 border border-white/10 p-4">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Users className="w-4 h-4 text-salon-gold" />
                <span>{t('home.peopleWaiting')}</span>
              </div>
              <div className="mt-2 text-3xl sm:text-4xl font-extrabold text-white">
                {waitingCount}
              </div>
            </div>

            <div className="rounded-xl bg-salon-dark/70 border border-white/10 p-4">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Clock className="w-4 h-4 text-salon-gold" />
                <span>{t('home.approxWait')}</span>
              </div>
              <div className="mt-2 text-3xl sm:text-4xl font-extrabold text-salon-gold">
                {estWait}{' '}
                <span className="text-base sm:text-lg font-semibold text-gray-300">
                  {t('app.minutes')}
                </span>
              </div>
            </div>
          </div>

          {waitingCount === 0 && isSalonOpen && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 flex items-center gap-2.5 text-sm text-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-medium">{t('home.noOneWaiting')}</span>
            </div>
          )}

          {/* Main CTA or Closed Banner */}
          {isOnlineOpen ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link to="/join" className="btn-gold text-base py-3.5 px-7 flex-1 sm:flex-none">
                <span>{t('home.joinQueueBtn')}</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                disabled
                className="btn-gold w-full sm:w-auto text-base py-3.5 px-7"
              >
                <span>{t('home.joinQueueBtn')}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/35 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-200">
                    {t('home.onlineClosedBanner')}
                  </p>
                  <p className="text-xs text-amber-100/80 leading-relaxed">
                    {getClosedReasonText()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Track Existing Token */}
      <section className="salon-card p-5">
        <form
          onSubmit={handleLookup}
          className="flex flex-col sm:flex-row sm:items-center gap-3"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-white shrink-0">
            <Search className="w-4 h-4 text-salon-gold" />
            <span>{t('home.checkExistingTitle')}</span>
          </div>
          <div className="flex-1 flex flex-col sm:flex-row gap-2">
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={lookupPhone}
              onChange={(e) => {
                setLookupPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                setLookupError('');
              }}
              placeholder={t('home.checkExistingPlaceholder')}
              className="salon-input py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={lookupLoading}
              className="btn-secondary shrink-0 text-sm"
            >
              {lookupLoading ? '...' : t('home.checkExistingBtn')}
            </button>
          </div>
        </form>
        {lookupError && <p className="mt-2 text-xs text-red-300">{lookupError}</p>}
      </section>

      {/* Barbers Section */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-salon-gold" />
              <span>{t('home.barbersTitle')}</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{t('home.barbersSubtitle')}</p>
          </div>
        </div>

        {workingBarbers.length > 0 && !hasAvailableBarber && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm text-amber-200 flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{t('home.allBarbersBusy')}</span>
          </div>
        )}

        {workingBarbers.length === 0 ? (
          <EmptyState title={t('home.noWorkingBarbers')} icon={UserCheck} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {workingBarbers.map((barber) => {
              const current = getBarberCurrentEntry(barber.id, activeEntries);
              return (
                <div
                  key={barber.id}
                  className="salon-card p-5 flex flex-col justify-between gap-4 hover:border-salon-gold/35 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-salon-gold/15 border border-salon-gold/40 flex items-center justify-center text-salon-gold font-bold text-lg shrink-0">
                        {barber.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-base truncate">{barber.name}</h3>
                        <p className="text-xs text-gray-400 truncate">
                          {getLocalized(barber, 'specialty')}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={barber.status} />
                  </div>

                  {current && (
                    <div className="rounded-xl bg-salon-dark/70 border border-white/10 px-3 py-2 flex items-center justify-between text-xs">
                      <span className="text-gray-400">{t('home.nowServingShort')}</span>
                      <span className="font-bold text-salon-gold">{current.token_number}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Services Preview */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-salon-gold" />
            <span>{t('home.servicesTitle')}</span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{t('home.servicesSubtitle')}</p>
        </div>

        {services.length === 0 ? (
          <EmptyState title={t('home.noServices')} icon={Sparkles} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {services.map((svc) => (
              <div
                key={svc.id}
                className="salon-card p-5 flex flex-col justify-between gap-3 hover:border-salon-gold/35 transition"
              >
                <div>
                  <h3 className="font-bold text-white text-base">{getLocalized(svc, 'name')}</h3>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock className="w-3.5 h-3.5 text-salon-gold" />
                    <span>
                      {svc.duration_minutes} {t('app.minutesFull')}
                    </span>
                  </div>
                </div>
                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xl font-extrabold text-salon-gold">
                    {t('app.currency')}
                    {svc.price}
                  </span>
                  {isOnlineOpen && (
                    <Link
                      to={`/join?service=${encodeURIComponent(svc.id)}`}
                      className="text-xs font-semibold text-gray-200 hover:text-salon-gold transition inline-flex items-center gap-1"
                    >
                      <span>{t('nav.join')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Salon Information */}
      {settings && (
        <section className="salon-card p-6">
          <h2 className="text-lg font-bold text-white mb-4">{t('home.salonInfoTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-300">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-salon-gold shrink-0 mt-0.5" />
              <span>{getLocalized(settings, 'address')}</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Phone className="w-4 h-4 text-salon-gold shrink-0 mt-0.5" />
              <span>{settings.phone}</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-salon-gold shrink-0 mt-0.5" />
              <span>
                {formatTime12h(settings.opening_time)} – {formatTime12h(settings.closing_time)}
              </span>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
