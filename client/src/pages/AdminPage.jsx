import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Users,
  Settings,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  Power,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  UserX,
  IndianRupee,
} from 'lucide-react';
import { useQueue } from '../context/QueueContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { api } from '../services/api.js';
import PinGate from '../components/PinGate.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import {
  LoadingState,
  ErrorBanner,
  EmptyState,
  formatTime12h,
} from '../components/FeedbackStates.jsx';

function AdminDashboardContent() {
  const { state, loading, error, refreshState } = useQueue();
  const { t, getLocalized } = useLanguage();

  const [activeTab, setActiveTab] = useState('services');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  // Service Modal State
  const [serviceModal, setServiceModal] = useState({ open: false, editing: null });
  const [svcForm, setSvcForm] = useState({
    name_en: '',
    name_gu: '',
    duration_minutes: 30,
    price: 150,
  });
  const [deleteSvcTarget, setDeleteSvcTarget] = useState(null);

  // Barber Modal State
  const [barberModal, setBarberModal] = useState({ open: false, editing: null });
  const [barberForm, setBarberForm] = useState({
    name: '',
    specialty_en: '',
    specialty_gu: '',
    is_working_today: true,
  });
  const [deleteBarberTarget, setDeleteBarberTarget] = useState(null);

  // Queue Settings State
  const [settingsForm, setSettingsForm] = useState({
    salon_name_en: '',
    salon_name_gu: '',
    opening_time: '09:00',
    closing_time: '21:00',
  });

  useEffect(() => {
    if (state?.settings) {
      setSettingsForm({
        salon_name_en: state.settings.salon_name_en || '',
        salon_name_gu: state.settings.salon_name_gu || '',
        opening_time: state.settings.opening_time || '09:00',
        closing_time: state.settings.closing_time || '21:00',
      });
    }
  }, [state?.settings]);

  if (loading && !state) return <LoadingState />;

  const services = state?.services || [];
  const barbers = state?.barbers || [];
  const settings = state?.settings;
  const onlineStatus = state?.online_queue_status;
  const stats = state?.daily_stats || {
    total_served_today: 0,
    current_waiting: 0,
    currently_serving: 0,
    average_wait_minutes: 0,
    no_shows_today: 0,
    cancelled_today: 0,
    total_revenue_today: 0,
    served_by_barber: [],
  };

  const flashSuccess = (msg) => {
    setActionSuccess(msg);
    window.setTimeout(() => setActionSuccess(''), 3500);
  };

  // --- Services Handlers ---
  const openAddService = () => {
    setActionError('');
    setSvcForm({ name_en: '', name_gu: '', duration_minutes: 30, price: 150 });
    setServiceModal({ open: true, editing: null });
  };

  const openEditService = (svc) => {
    setActionError('');
    setSvcForm({
      name_en: svc.name_en,
      name_gu: svc.name_gu,
      duration_minutes: svc.duration_minutes,
      price: svc.price,
    });
    setServiceModal({ open: true, editing: svc });
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    setBusy(true);
    setActionError('');
    try {
      const payload = {
        name_en: svcForm.name_en.trim(),
        name_gu: svcForm.name_gu.trim() || svcForm.name_en.trim(),
        duration_minutes: Number(svcForm.duration_minutes),
        price: Number(svcForm.price),
      };
      if (serviceModal.editing) {
        await api.updateService(serviceModal.editing.id, payload);
      } else {
        await api.createService(payload);
      }
      setServiceModal({ open: false, editing: null });
    } catch (err) {
      setActionError(err.message || t('validation.genericError'));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleServiceActive = async (svc) => {
    setBusy(true);
    setActionError('');
    try {
      await api.updateService(svc.id, { is_active: !svc.is_active });
    } catch (err) {
      setActionError(err.message || t('validation.genericError'));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDeleteService = async () => {
    if (!deleteSvcTarget) return;
    setBusy(true);
    setActionError('');
    try {
      await api.deleteService(deleteSvcTarget.id);
      setDeleteSvcTarget(null);
    } catch (err) {
      setActionError(err.message || t('validation.genericError'));
      setDeleteSvcTarget(null);
    } finally {
      setBusy(false);
    }
  };

  // --- Barbers Handlers ---
  const openAddBarber = () => {
    setActionError('');
    setBarberForm({ name: '', specialty_en: '', specialty_gu: '', is_working_today: true });
    setBarberModal({ open: true, editing: null });
  };

  const openEditBarber = (barber) => {
    setActionError('');
    setBarberForm({
      name: barber.name,
      specialty_en: barber.specialty_en || '',
      specialty_gu: barber.specialty_gu || '',
      is_working_today: barber.is_working_today,
    });
    setBarberModal({ open: true, editing: barber });
  };

  const handleSaveBarber = async (e) => {
    e.preventDefault();
    setBusy(true);
    setActionError('');
    try {
      const payload = {
        name: barberForm.name.trim(),
        specialty_en: barberForm.specialty_en.trim(),
        specialty_gu: barberForm.specialty_gu.trim() || barberForm.specialty_en.trim(),
        is_working_today: Boolean(barberForm.is_working_today),
      };
      if (barberModal.editing) {
        await api.updateBarber(barberModal.editing.id, payload);
      } else {
        await api.createBarber(payload);
      }
      setBarberModal({ open: false, editing: null });
    } catch (err) {
      setActionError(err.message || t('validation.genericError'));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleWorkingToday = async (barber) => {
    setBusy(true);
    setActionError('');
    try {
      await api.updateBarber(barber.id, {
        is_working_today: !barber.is_working_today,
        is_active: true,
      });
    } catch (err) {
      setActionError(err.message || t('validation.genericError'));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDeleteBarber = async () => {
    if (!deleteBarberTarget) return;
    setBusy(true);
    setActionError('');
    try {
      await api.deleteBarber(deleteBarberTarget.id);
      setDeleteBarberTarget(null);
    } catch (err) {
      setActionError(err.message || t('validation.genericError'));
      setDeleteBarberTarget(null);
    } finally {
      setBusy(false);
    }
  };

  // --- Settings Handlers ---
  const handleToggleOnlineQueue = async (isOpen) => {
    setBusy(true);
    setActionError('');
    try {
      await api.updateSettings({ is_online_queue_open: isOpen });
      flashSuccess(t('admin.settingsSaved'));
    } catch (err) {
      setActionError(err.message || t('validation.genericError'));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setBusy(true);
    setActionError('');
    try {
      await api.updateSettings(settingsForm);
      flashSuccess(t('admin.settingsSaved'));
    } catch (err) {
      setActionError(err.message || t('validation.genericError'));
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { id: 'services', label: t('admin.tabServices'), icon: Sparkles },
    { id: 'barbers', label: t('admin.tabBarbers'), icon: Users },
    { id: 'queue', label: t('admin.tabQueue'), icon: Settings },
    { id: 'stats', label: t('admin.tabStats'), icon: BarChart3 },
  ];

  const maxBarberServed = Math.max(
    1,
    ...(stats.served_by_barber || []).map((b) => Number(b.served_count || 0))
  );
  const totalOutcomes =
    stats.total_served_today +
    stats.no_shows_today +
    stats.cancelled_today +
    stats.current_waiting +
    stats.currently_serving;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in-up">
      <ErrorBanner
        message={error || actionError}
        onRetry={() => {
          setActionError('');
          refreshState();
        }}
      />

      {actionSuccess && (
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-4 py-3 text-sm text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{t('admin.title')}</h1>
          <p className="text-sm text-gray-400 mt-1">{t('admin.subtitle')}</p>
        </div>
      </div>

      {/* Desktop Sidebar / Top Tabs Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-3 salon-card p-2.5 flex lg:flex-col gap-1.5 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                setActionError('');
              }}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
                activeTab === id
                  ? 'bg-salon-gold text-salon-dark shadow-md'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </aside>

        <section className="lg:col-span-9 space-y-5">
          {/* SECTION A: SERVICES MANAGEMENT */}
          {activeTab === 'services' && (
            <div className="salon-card p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-white">{t('admin.servicesHeader')}</h2>
                <button type="button" onClick={openAddService} className="btn-gold text-sm py-2.5">
                  <Plus className="w-4 h-4" />
                  <span>{t('admin.addServiceBtn')}</span>
                </button>
              </div>

              {services.length === 0 ? (
                <EmptyState title={t('home.noServices')} icon={Sparkles} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-salon-dark/80 text-xs uppercase text-gray-400 border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3">{t('admin.serviceNameEn')}</th>
                        <th className="px-4 py-3">{t('admin.serviceNameGu')}</th>
                        <th className="px-4 py-3">{t('admin.durationLabel')}</th>
                        <th className="px-4 py-3">{t('admin.priceLabel')}</th>
                        <th className="px-4 py-3">{t('reception.colStatus')}</th>
                        <th className="px-4 py-3 text-right">{t('reception.colActions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {services.map((svc) => (
                        <tr key={svc.id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-semibold text-white">{svc.name_en}</td>
                          <td className="px-4 py-3 text-gray-200">{svc.name_gu}</td>
                          <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                            {svc.duration_minutes} {t('app.minutes')}
                          </td>
                          <td className="px-4 py-3 font-bold text-salon-gold whitespace-nowrap">
                            {t('app.currency')}
                            {svc.price}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                svc.is_active
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                                  : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                              }`}
                            >
                              {svc.is_active ? t('admin.activeLabel') : t('admin.inactiveLabel')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => openEditService(svc)}
                                className="p-2 rounded-lg bg-salon-card border border-white/10 text-gray-200 hover:text-salon-gold hover:border-salon-gold/40"
                                title={t('app.edit')}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleToggleServiceActive(svc)}
                                className="px-2.5 py-1.5 rounded-lg bg-salon-card border border-white/10 text-xs font-semibold text-gray-200 hover:text-white"
                              >
                                {svc.is_active ? t('admin.deactivate') : t('admin.activate')}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setDeleteSvcTarget(svc)}
                                className="p-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25"
                                title={t('app.delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SECTION B: BARBER MANAGEMENT */}
          {activeTab === 'barbers' && (
            <div className="salon-card p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-white">{t('admin.barbersHeader')}</h2>
                <button type="button" onClick={openAddBarber} className="btn-gold text-sm py-2.5">
                  <Plus className="w-4 h-4" />
                  <span>{t('admin.addBarberBtn')}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {barbers.map((barber) => (
                  <div
                    key={barber.id}
                    className={`rounded-2xl p-5 border space-y-4 ${
                      barber.is_active
                        ? 'bg-salon-dark/60 border-white/10'
                        : 'bg-salon-dark/30 border-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-white truncate">{barber.name}</h3>
                        <p className="text-xs text-gray-400 truncate">
                          {getLocalized(barber, 'specialty') || '—'}
                        </p>
                      </div>
                      <StatusBadge status={barber.status} />
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/10">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggleWorkingToday(barber)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                          barber.is_working_today && barber.is_active
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                            : 'bg-gray-500/20 text-gray-300 border-gray-500/35'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>
                          {barber.is_working_today && barber.is_active
                            ? t('admin.workingToday')
                            : t('admin.offDuty')}
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openEditBarber(barber)}
                          className="p-2 rounded-lg bg-salon-card border border-white/10 text-gray-200 hover:text-salon-gold"
                          title={t('app.edit')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setDeleteBarberTarget(barber)}
                          className="p-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25"
                          title={t('app.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION C: QUEUE MANAGEMENT & OPERATING HOURS */}
          {activeTab === 'queue' && settings && (
            <div className="space-y-5">
              <div className="salon-card-gold p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{t('admin.onlineQueueSwitch')}</h2>
                    <p className="text-xs text-gray-400 mt-1">{t('admin.walkInNote')}</p>
                  </div>
                  <StatusBadge
                    status={
                      onlineStatus?.isOnlineJoiningOpen
                        ? 'open'
                        : onlineStatus?.isSalonOpen
                          ? 'onlineClosed'
                          : 'closed'
                    }
                    size="lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    disabled={busy || settings.is_online_queue_open}
                    onClick={() => handleToggleOnlineQueue(true)}
                    className="btn-success py-3.5"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{t('admin.openQueueBtn')}</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy || !settings.is_online_queue_open}
                    onClick={() => handleToggleOnlineQueue(false)}
                    className="btn-danger py-3.5"
                  >
                    <AlertTriangle className="w-5 h-5" />
                    <span>{t('admin.closeQueueBtn')}</span>
                  </button>
                </div>

                <div className="rounded-xl bg-salon-dark/70 border border-white/10 px-4 py-3 text-xs text-gray-300 flex items-center justify-between gap-2 flex-wrap">
                  <span>{t('admin.cutoffNote')}</span>
                  {onlineStatus?.onlineCutoffTime && (
                    <span className="font-bold text-salon-gold">
                      {formatTime12h(onlineStatus.onlineCutoffTime)}
                    </span>
                  )}
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="salon-card p-5 sm:p-6 space-y-5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-salon-gold" />
                  <span>{t('admin.queueHeader')}</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      {t('admin.openingTimeLabel')}
                    </label>
                    <input
                      type="time"
                      value={settingsForm.opening_time}
                      onChange={(e) =>
                        setSettingsForm((f) => ({ ...f, opening_time: e.target.value }))
                      }
                      className="salon-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      {t('admin.closingTimeLabel')}
                    </label>
                    <input
                      type="time"
                      value={settingsForm.closing_time}
                      onChange={(e) =>
                        setSettingsForm((f) => ({ ...f, closing_time: e.target.value }))
                      }
                      className="salon-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      {t('admin.salonNameEnLabel')}
                    </label>
                    <input
                      type="text"
                      value={settingsForm.salon_name_en}
                      onChange={(e) =>
                        setSettingsForm((f) => ({ ...f, salon_name_en: e.target.value }))
                      }
                      className="salon-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      {t('admin.salonNameGuLabel')}
                    </label>
                    <input
                      type="text"
                      value={settingsForm.salon_name_gu}
                      onChange={(e) =>
                        setSettingsForm((f) => ({ ...f, salon_name_gu: e.target.value }))
                      }
                      className="salon-input"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="submit" disabled={busy} className="btn-gold">
                    {busy ? '...' : t('admin.saveSettingsBtn')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECTION D: DAILY STATISTICS */}
          {activeTab === 'stats' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="salon-card p-5">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{t('admin.totalServed')}</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 text-3xl font-black text-emerald-400">
                    {stats.total_served_today}
                  </div>
                </div>

                <div className="salon-card p-5">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{t('admin.currentWaiting')}</span>
                    <Users className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="mt-2 text-3xl font-black text-white">
                    {stats.current_waiting}
                  </div>
                </div>

                <div className="salon-card p-5">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{t('admin.avgWaitTime')}</span>
                    <Clock className="w-4 h-4 text-salon-gold" />
                  </div>
                  <div className="mt-2 text-3xl font-black text-salon-gold">
                    {stats.average_wait_minutes}{' '}
                    <span className="text-sm font-semibold text-gray-400">{t('app.minutes')}</span>
                  </div>
                </div>

                <div className="salon-card p-5">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{t('admin.noShows')}</span>
                    <UserX className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="mt-2 text-3xl font-black text-red-400">
                    {stats.no_shows_today}
                  </div>
                </div>

                <div className="salon-card p-5">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{t('admin.cancelledToday')}</span>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="mt-2 text-3xl font-black text-gray-200">
                    {stats.cancelled_today}
                  </div>
                </div>

                <div className="salon-card-gold p-5">
                  <div className="flex items-center justify-between text-xs text-gray-300">
                    <span>{t('admin.revenueToday')}</span>
                    <IndianRupee className="w-4 h-4 text-salon-gold" />
                  </div>
                  <div className="mt-2 text-3xl font-black text-salon-gold">
                    {t('app.currency')}
                    {stats.total_revenue_today}
                  </div>
                </div>
              </div>

              {/* Chart 1: Customers Served by Each Barber */}
              <div className="salon-card p-5 sm:p-6 space-y-4">
                <h3 className="text-base font-bold text-white">
                  {t('admin.servedByBarberTitle')}
                </h3>
                {(stats.served_by_barber || []).length === 0 ? (
                  <p className="text-sm text-gray-400">{t('admin.noDataYet')}</p>
                ) : (
                  <div className="space-y-4">
                    {stats.served_by_barber.map((row) => {
                      const pct = Math.round((Number(row.served_count || 0) / maxBarberServed) * 100);
                      return (
                        <div key={row.barber_id} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-bold text-white">{row.barber_name}</span>
                            <span className="text-xs text-gray-300">
                              <strong className="text-salon-gold text-sm">{row.served_count}</strong>{' '}
                              • {t('app.currency')}
                              {row.revenue || 0}
                            </span>
                          </div>
                          <div className="w-full h-3.5 rounded-full bg-salon-dark overflow-hidden border border-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-salon-goldDark to-salon-goldLight transition-all duration-500"
                              style={{ width: `${Math.max(row.served_count > 0 ? 6 : 0, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Chart 2: Daily Outcome Distribution */}
              <div className="salon-card p-5 sm:p-6 space-y-4">
                <h3 className="text-base font-bold text-white">
                  {t('admin.outcomeBreakdownTitle')}
                </h3>
                {totalOutcomes === 0 ? (
                  <p className="text-sm text-gray-400">{t('admin.noDataYet')}</p>
                ) : (
                  <>
                    <div className="w-full h-5 rounded-full overflow-hidden flex bg-salon-dark border border-white/10">
                      <div
                        className="bg-emerald-500 h-full transition-all"
                        style={{ width: `${(stats.total_served_today / totalOutcomes) * 100}%` }}
                      />
                      <div
                        className="bg-salon-gold h-full transition-all"
                        style={{
                          width: `${
                            ((stats.current_waiting + stats.currently_serving) / totalOutcomes) *
                            100
                          }%`,
                        }}
                      />
                      <div
                        className="bg-red-500 h-full transition-all"
                        style={{ width: `${(stats.no_shows_today / totalOutcomes) * 100}%` }}
                      />
                      <div
                        className="bg-gray-500 h-full transition-all"
                        style={{ width: `${(stats.cancelled_today / totalOutcomes) * 100}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-300">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        {t('status.Done')}: {stats.total_served_today}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-salon-gold" />
                        {t('status.Waiting')} / {t('status.In Chair')}:{' '}
                        {stats.current_waiting + stats.currently_serving}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-red-500" />
                        {t('status.No-show')}: {stats.no_shows_today}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-gray-500" />
                        {t('status.Cancelled')}: {stats.cancelled_today}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Add / Edit Service Modal */}
      {serviceModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="salon-card-gold w-full max-w-md p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {serviceModal.editing ? t('admin.editServiceTitle') : t('admin.addServiceTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setServiceModal({ open: false, editing: null })}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveService} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  {t('admin.serviceNameEn')} *
                </label>
                <input
                  type="text"
                  required
                  value={svcForm.name_en}
                  onChange={(e) => setSvcForm((f) => ({ ...f, name_en: e.target.value }))}
                  className="salon-input py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  {t('admin.serviceNameGu')} *
                </label>
                <input
                  type="text"
                  required
                  value={svcForm.name_gu}
                  onChange={(e) => setSvcForm((f) => ({ ...f, name_gu: e.target.value }))}
                  className="salon-input py-2.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    {t('admin.durationLabel')} *
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="240"
                    required
                    value={svcForm.duration_minutes}
                    onChange={(e) =>
                      setSvcForm((f) => ({ ...f, duration_minutes: e.target.value }))
                    }
                    className="salon-input py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    {t('admin.priceLabel')} *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={svcForm.price}
                    onChange={(e) => setSvcForm((f) => ({ ...f, price: e.target.value }))}
                    className="salon-input py-2.5 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setServiceModal({ open: false, editing: null })}
                  className="btn-secondary text-sm"
                >
                  {t('app.cancel')}
                </button>
                <button type="submit" disabled={busy} className="btn-gold text-sm">
                  {busy ? '...' : t('app.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Barber Modal */}
      {barberModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="salon-card-gold w-full max-w-md p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {barberModal.editing ? t('admin.editBarberTitle') : t('admin.addBarberTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setBarberModal({ open: false, editing: null })}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveBarber} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  {t('admin.barberNameLabel')} *
                </label>
                <input
                  type="text"
                  required
                  value={barberForm.name}
                  onChange={(e) => setBarberForm((f) => ({ ...f, name: e.target.value }))}
                  className="salon-input py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  {t('admin.specialtyEnLabel')}
                </label>
                <input
                  type="text"
                  value={barberForm.specialty_en}
                  onChange={(e) => setBarberForm((f) => ({ ...f, specialty_en: e.target.value }))}
                  className="salon-input py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  {t('admin.specialtyGuLabel')}
                </label>
                <input
                  type="text"
                  value={barberForm.specialty_gu}
                  onChange={(e) => setBarberForm((f) => ({ ...f, specialty_gu: e.target.value }))}
                  className="salon-input py-2.5 text-sm"
                />
              </div>
              <label className="flex items-center gap-2.5 text-sm text-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={barberForm.is_working_today}
                  onChange={(e) =>
                    setBarberForm((f) => ({ ...f, is_working_today: e.target.checked }))
                  }
                  className="w-4 h-4 accent-salon-gold rounded"
                />
                <span>{t('admin.workingToday')}</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBarberModal({ open: false, editing: null })}
                  className="btn-secondary text-sm"
                >
                  {t('app.cancel')}
                </button>
                <button type="submit" disabled={busy} className="btn-gold text-sm">
                  {busy ? '...' : t('app.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Service */}
      <ConfirmDialog
        open={Boolean(deleteSvcTarget)}
        title={t('app.delete')}
        message={
          deleteSvcTarget
            ? t('admin.deleteServiceConfirm', { name: getLocalized(deleteSvcTarget, 'name') })
            : ''
        }
        confirmLabel={t('app.delete')}
        loading={busy}
        onConfirm={handleConfirmDeleteService}
        onCancel={() => setDeleteSvcTarget(null)}
      />

      {/* Confirm Delete Barber */}
      <ConfirmDialog
        open={Boolean(deleteBarberTarget)}
        title={t('app.delete')}
        message={
          deleteBarberTarget
            ? t('admin.deleteBarberConfirm', { name: deleteBarberTarget.name })
            : ''
        }
        confirmLabel={t('app.delete')}
        loading={busy}
        onConfirm={handleConfirmDeleteBarber}
        onCancel={() => setDeleteBarberTarget(null)}
      />
    </main>
  );
}

export default function AdminPage() {
  return (
    <PinGate requiredRole="owner">
      <AdminDashboardContent />
    </PinGate>
  );
}
