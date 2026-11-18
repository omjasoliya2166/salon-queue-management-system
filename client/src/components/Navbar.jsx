import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Scissors,
  Menu,
  X,
  Home,
  UserPlus,
  ClipboardList,
  UserCheck,
  Tv,
  Settings,
  LogOut,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useQueue } from '../context/QueueContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import LanguageToggle from './LanguageToggle.jsx';

export default function Navbar() {
  const { t, getLocalized } = useLanguage();
  const { state, connected } = useQueue();
  const { role, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (location.pathname === '/display') return null;

  const salonName = getLocalized(state?.settings, 'salon_name') || 'Regal Crown Salon';

  const navItems = [
    { to: '/', label: t('nav.home'), icon: Home, end: true },
    { to: '/join', label: t('nav.join'), icon: UserPlus },
    { to: '/reception', label: t('nav.reception'), icon: ClipboardList },
    { to: '/barber', label: t('nav.barber'), icon: UserCheck },
    { to: '/display', label: t('nav.display'), icon: Tv },
    { to: '/admin', label: t('nav.admin'), icon: Settings },
  ];

  const linkClasses = ({ isActive }) =>
    `inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
      isActive
        ? 'bg-salon-gold/15 text-salon-gold border border-salon-gold/30'
        : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-salon-dark/90 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 min-w-0 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-salon-gold to-salon-goldDark flex items-center justify-center shadow-md shadow-salon-gold/20 shrink-0 group-hover:scale-105 transition-transform">
            <Scissors className="w-5 h-5 text-salon-dark" />
          </div>
          <div className="min-w-0">
            <div className="text-sm sm:text-base font-bold text-white truncate leading-tight">
              {salonName}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              {connected ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="text-emerald-400 truncate">{t('app.liveConnected')}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-amber-400 truncate">{t('app.reconnecting')}</span>
                </>
              )}
            </div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClasses}>
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <LanguageToggle />
          {role && (
            <button
              type="button"
              onClick={logout}
              title={t('nav.logout')}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium text-gray-300 bg-salon-card border border-white/10 hover:text-white hover:border-white/25 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t('nav.logout')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="lg:hidden p-2 rounded-xl bg-salon-card border border-white/10 text-gray-200 hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-white/10 bg-salon-dark px-4 py-3 space-y-1 animate-fade-in-up">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium ${
                  isActive
                    ? 'bg-salon-gold/15 text-salon-gold border border-salon-gold/30'
                    : 'text-gray-300 hover:bg-white/5'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </NavLink>
          ))}
          {role && (
            <button
              type="button"
              onClick={() => {
                logout();
                setMobileOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-300 hover:bg-red-500/10"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('nav.logout')}</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
}
