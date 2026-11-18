import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Scissors,
  Users,
  Clock,
  Volume2,
  VolumeX,
  BellRing,
  ArrowLeft,
} from 'lucide-react';
import {
  QUEUE_STATUSES,
  BARBER_STATUSES,
  getBarberCurrentEntry,
  getWaitingQueueOrdered,
} from '@shared/queueEngine.js';
import { useQueue } from '../context/QueueContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { playCallChime } from '../services/sound.js';
import LanguageToggle from '../components/LanguageToggle.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { LoadingState } from '../components/FeedbackStates.jsx';

export default function DisplayPage() {
  const { state, loading, nowMs, lastCallEvent } = useQueue();
  const { t, getLocalized } = useLanguage();

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeCallBanner, setActiveCallBanner] = useState(null);

  useEffect(() => {
    if (!lastCallEvent) return;
    setActiveCallBanner(lastCallEvent);
    if (soundEnabled) {
      playCallChime();
    }
    const timeout = window.setTimeout(() => {
      setActiveCallBanner((current) =>
        current && current.receivedAt === lastCallEvent.receivedAt ? null : current
      );
    }, 8500);
    return () => window.clearTimeout(timeout);
  }, [lastCallEvent, soundEnabled]);

  const activeEntries = state?.active_entries || [];
  const workingBarbers = useMemo(
    () => (state?.barbers || []).filter((b) => b.is_active && b.is_working_today),
    [state]
  );
  const nextFiveWaiting = useMemo(
    () => getWaitingQueueOrdered(activeEntries).slice(0, 5),
    [activeEntries]
  );

  if (loading && !state) return <LoadingState />;

  const settings = state?.settings;
  const nowDate = new Date(nowMs);
  const formattedClock = nowDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="min-h-screen bg-salon-dark text-white flex flex-col justify-between p-5 sm:p-8 lg:p-10 select-none">
      {/* Call Announcement Overlay Banner */}
      {activeCallBanner && (
        <div
          className="fixed inset-x-0 top-6 z-50 mx-auto max-w-5xl px-4 animate-fade-in-up"
          role="alert"
          aria-live="assertive"
        >
          <div className="rounded-3xl bg-salon-gold text-salon-dark px-8 py-6 shadow-2xl border-4 border-white/80 flex flex-wrap items-center justify-between gap-6 animate-gold-pulse">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-salon-dark text-salon-gold flex items-center justify-center shrink-0">
                <BellRing className="w-9 h-9 animate-bounce" />
              </div>
              <div>
                <div className="text-sm sm:text-base font-black tracking-[0.2em] uppercase text-salon-dark/80">
                  {t('display.nowCalling')}
                </div>
                <div className="text-3xl sm:text-5xl font-black tracking-tight">
                  {activeCallBanner.tokenNumber} — {activeCallBanner.customerName}
                </div>
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold bg-salon-dark text-salon-gold px-6 py-3 rounded-2xl">
              {t('display.pleaseProceed', { name: activeCallBanner.barberName.toUpperCase() })}
            </div>
          </div>
        </div>
      )}

      {/* Top TV Header */}
      <header className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-white/15">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-salon-gold to-salon-goldDark flex items-center justify-center shadow-xl shadow-salon-gold/25 shrink-0">
            <Scissors className="w-9 h-9 text-salon-dark" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              {getLocalized(settings, 'salon_name') || 'Regal Crown Salon'}
            </h1>
            <p className="text-sm sm:text-base text-salon-goldLight font-semibold mt-1">
              {t('app.tagline')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="rounded-2xl bg-salon-surface border border-salon-gold/40 px-6 py-3 flex items-center gap-3">
            <Users className="w-7 h-7 text-salon-gold" />
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400">
                {t('display.waitingCountLabel')}
              </div>
              <div className="text-3xl sm:text-4xl font-black text-salon-gold leading-none">
                {state?.waiting_count ?? 0}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-salon-surface border border-white/15 px-6 py-3 flex items-center gap-3">
            <Clock className="w-7 h-7 text-salon-gold" />
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-white font-mono">
              {formattedClock}
            </div>
          </div>
        </div>
      </header>

      {/* Main Section: Barber-wise Now Serving */}
      <section className="my-8 flex-1 flex flex-col justify-center">
        <div
          className={`grid gap-6 ${
            workingBarbers.length <= 3
              ? 'grid-cols-1 md:grid-cols-3'
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
          }`}
        >
          {workingBarbers.map((barber) => {
            const current = getBarberCurrentEntry(barber.id, activeEntries);
            const isCalled = current?.status === QUEUE_STATUSES.CALLED;
            const isInChair = current?.status === QUEUE_STATUSES.IN_CHAIR;
            const isAvailable = barber.status === BARBER_STATUSES.AVAILABLE && !current;
            const isOnBreak = barber.status === BARBER_STATUSES.ON_BREAK;

            return (
              <div
                key={barber.id}
                className={`rounded-3xl p-7 sm:p-8 border-2 flex flex-col justify-between min-h-[250px] transition-all ${
                  isCalled
                    ? 'bg-salon-gold text-salon-dark border-white shadow-2xl animate-gold-pulse'
                    : isInChair
                      ? 'bg-salon-surface border-salon-gold/60 shadow-xl'
                      : isAvailable
                        ? 'bg-salon-surface border-emerald-500/50'
                        : 'bg-salon-surface/70 border-amber-500/40'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2
                    className={`text-3xl sm:text-4xl font-black uppercase tracking-wide ${
                      isCalled ? 'text-salon-dark' : 'text-white'
                    }`}
                  >
                    {barber.name}
                  </h2>
                  {isCalled ? (
                    <span className="px-4 py-1.5 rounded-full bg-salon-dark text-salon-gold text-sm font-black tracking-wider">
                      {t('display.calledBadge')}
                    </span>
                  ) : isInChair ? (
                    <span className="px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-sm font-extrabold">
                      {t('display.inChairBadge')}
                    </span>
                  ) : (
                    <StatusBadge status={barber.status} size="lg" />
                  )}
                </div>

                <div className="mt-8">
                  {current ? (
                    <div>
                      <div
                        className={`text-lg font-bold uppercase tracking-wider ${
                          isCalled ? 'text-salon-dark/80' : 'text-gray-400'
                        }`}
                      >
                        {t('display.nowServing')}
                      </div>
                      <div
                        className={`mt-1 text-6xl sm:text-7xl font-black tracking-tight ${
                          isCalled ? 'text-salon-dark' : 'text-salon-gold'
                        }`}
                      >
                        {current.token_number}
                      </div>
                      <div
                        className={`mt-2 text-2xl font-bold truncate ${
                          isCalled ? 'text-salon-dark' : 'text-white'
                        }`}
                      >
                        {current.customer_name}
                      </div>
                    </div>
                  ) : isOnBreak ? (
                    <div className="text-4xl sm:text-5xl font-black text-amber-400">
                      {t('status.On Break')}
                    </div>
                  ) : (
                    <div className="text-4xl sm:text-5xl font-black text-emerald-400">
                      {t('status.Available')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom Section: Next 5 Queue Tokens */}
      <section className="rounded-3xl bg-salon-surface/90 border border-white/15 p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            {t('display.upNextTitle')}
          </h2>
          <div className="text-lg font-bold text-salon-goldLight">
            {t('home.approxWait')}: ~{state?.estimated_wait_minutes ?? 0} {t('app.minutes')}
          </div>
        </div>

        {nextFiveWaiting.length === 0 ? (
          <div className="py-6 text-center text-2xl sm:text-3xl font-bold text-emerald-300">
            {t('home.noOneWaiting')}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {nextFiveWaiting.map((entry, index) => (
              <div
                key={entry.id}
                className={`rounded-2xl p-4 sm:p-5 border text-center ${
                  index === 0
                    ? 'bg-salon-gold/15 border-salon-gold'
                    : 'bg-salon-dark/80 border-white/10'
                }`}
              >
                <div className="text-4xl sm:text-5xl font-black text-salon-gold">
                  {entry.token_number}
                </div>
                <div className="mt-2 text-base font-bold text-white truncate">
                  {entry.customer_name}
                </div>
                <div className="mt-1 text-sm text-gray-300 truncate">
                  {entry.preferred_barber_name || t('app.anyBarber')}
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 text-sm font-bold text-salon-goldLight">
                  ~{entry.estimated_wait_minutes ?? 0} {t('app.minutes')}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Subtle Corner Controls for Staff/TV Setup */}
      <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('app.backHome')}</span>
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playCallChime();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-salon-surface border border-white/15 text-gray-200 hover:text-white transition"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4 text-salon-gold" />
                <span>{t('display.soundOn')}</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-gray-400" />
                <span>{t('display.soundOff')}</span>
              </>
            )}
          </button>
          <LanguageToggle compact />
        </div>
      </footer>
    </div>
  );
}
