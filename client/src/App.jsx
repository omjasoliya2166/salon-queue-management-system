import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { QueueProvider } from './context/QueueContext.jsx';
import Navbar from './components/Navbar.jsx';
import HomePage from './pages/HomePage.jsx';
import JoinQueuePage from './pages/JoinQueuePage.jsx';
import MyStatusPage from './pages/MyStatusPage.jsx';
import ReceptionPage from './pages/ReceptionPage.jsx';
import BarberPage from './pages/BarberPage.jsx';
import DisplayPage from './pages/DisplayPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import { EmptyState } from './components/FeedbackStates.jsx';

function NotFoundPage() {
  const { t } = useLanguage();
  return (
    <main className="max-w-lg mx-auto px-4 py-16">
      <EmptyState
        title={t('app.notFoundTitle')}
        description={t('app.notFoundDesc')}
        action={
          <Link to="/" className="btn-gold">
            {t('app.backHome')}
          </Link>
        }
      />
    </main>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <QueueProvider>
          <BrowserRouter>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <div className="flex-1">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/join" element={<JoinQueuePage />} />
                  <Route path="/status/:id" element={<MyStatusPage />} />
                  <Route path="/reception" element={<ReceptionPage />} />
                  <Route path="/barber" element={<BarberPage />} />
                  <Route path="/barber/:name" element={<BarberPage />} />
                  <Route path="/display" element={<DisplayPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </div>
            </div>
          </BrowserRouter>
        </QueueProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
