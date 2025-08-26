import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Appointments from './components/Appointments';
import Clients from './components/Clients';
import MarketingAI from './components/MarketingAI';
import Services from './components/ServicesImproved';
import Finance from './components/Finance';
import Availability from './components/Availability';
import Profile from './components/Profile';
import Reports from './components/Reports';
import HelpCenter from './components/HelpCenter';
import Settings from './components/SettingsPage';
import Subscription from './components/Subscription';
import { Menu, X } from './components/Icons';
import { useAuth } from './contexts/AuthContext';
import AuthPage from './components/AuthPage';
import VerifyEmail from './components/VerifyEmail';
import LockedFeature from './components/LockedFeature';
import { ModalProvider } from './components/ModalManager';
import TrialEndingBanner from './components/TrialEndingBanner';
import { ErrorProvider } from './components/ErrorHandling';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';

type View = 'dashboard' | 'appointments' | 'clients' | 'marketing' | 'services' | 'finance' | 'availability' | 'profile' | 'reports' | 'help-center' | 'settings' | 'subscription';

const App: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { plan, hasAccess, user, loading, logout } = useAuth();

  // We'll render inside a Router below; use a small wrapper to access location/navigate
  const RouterWrapper: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // derive currentView from pathname for sidebar highlighting
    const path = location.pathname;
    const pathnameToView = (p: string): View => {
      if (p.startsWith('/appointments')) return 'appointments';
      if (p.startsWith('/clients')) return 'clients';
      if (p.startsWith('/marketing')) return 'marketing';
      if (p.startsWith('/services')) return 'services';
      if (p.startsWith('/finance')) return 'finance';
      if (p.startsWith('/availability')) return 'availability';
      if (p.startsWith('/profile')) return 'profile';
      if (p.startsWith('/reports')) return 'reports';
      if (p.startsWith('/help-center')) return 'help-center';
      if (p.startsWith('/settings')) return 'settings';
      if (p.startsWith('/subscription')) return 'subscription';
      return 'dashboard';
    };

    const currentView = pathnameToView(path);

    // handler used by Sidebar to change views; also closes mobile sidebar
    const handleSetView = (view: View) => {
      // access control
      if (view === 'reports' && !hasAccess('reports.view')) {
        navigate('/subscription');
        setSidebarOpen(false);
        return;
      }
      if (view === 'marketing' && !hasAccess('marketing.view')) {
        navigate('/subscription');
        setSidebarOpen(false);
        return;
      }
      const map: Record<View, string> = {
        dashboard: '/',
        appointments: '/appointments',
        clients: '/clients',
        marketing: '/marketing',
        services: '/services',
        finance: '/finance',
        availability: '/availability',
        profile: '/profile',
        reports: '/reports',
        'help-center': '/help-center',
        settings: '/settings',
        subscription: '/subscription'
      };
      navigate(map[view]);
      setSidebarOpen(false);
    };

    // global navigation hook
    React.useEffect(() => {
      const handler = (e: Event) => {
        try {
          const ce = e as CustomEvent;
          const view = ce.detail?.view as View | undefined;
          if (view) handleSetView(view);
        } catch (err) {}
      };
      window.addEventListener('app:navigate', handler as EventListener);
      return () => window.removeEventListener('app:navigate', handler as EventListener);
    }, []);

    return (
      <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
        {/* Static Sidebar for larger screens */}
        <div className="hidden lg:flex">
          <Sidebar currentView={currentView} setCurrentView={handleSetView} />
        </div>

        {/* Mobile Sidebar overlay */}
        <div
          className={`fixed inset-0 z-30 bg-black bg-opacity-50 transition-opacity lg:hidden ${
            isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setSidebarOpen(false)}
        ></div>
        <div
          className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out lg:hidden ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar 
            currentView={currentView}
            setCurrentView={(view) => { handleSetView(view); setSidebarOpen(false); }}
          />
        </div>

        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 lg:justify-end">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 dark:text-gray-400 focus:outline-none lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-4">
              <span className="px-3 py-1 text-sm font-bold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300">
                Plano: {plan}
              </span>
              <span className="font-semibold text-sm truncate max-w-[40vw] sm:max-w-none">
                Olá, {user?.displayName || user?.email || 'Usuário'}
              </span>
              <img
                className="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                src={user?.photoURL || 'https://api.dicebear.com/9.x/initials/svg?seed=' + encodeURIComponent(user?.displayName || user?.email || 'U')}
                alt="User avatar"
                referrerPolicy="no-referrer"
              />
              <button
                onClick={() => logout()}
                className="text-xs px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                title="Sair"
              >
                Sair
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">
            <TrialEndingBanner />
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/marketing" element={hasAccess('marketing.view') ? <MarketingAI /> : <LockedFeature featureName="Marketing com IA" />} />
              <Route path="/services" element={<Services />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/availability" element={<Availability />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/reports" element={hasAccess('reports.view') ? <Reports /> : <LockedFeature featureName="Relatórios Avançados" />} />
              <Route path="/help-center" element={<HelpCenter />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/subscription" element={<Subscription />} />
              {/* Fallback to dashboard */}
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </div>
        </main>
      </div>
    );
  };


  // legacy renderView removed — RouterWrapper handles routing and rendering

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
        <div className="animate-pulse text-sm text-gray-500">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (user && !user.emailVerified) {
    return <VerifyEmail />;
  }

  return (
    <BrowserRouter>
      <ErrorProvider>
        <ModalProvider>
          <RouterWrapper />
        </ModalProvider>
      </ErrorProvider>
    </BrowserRouter>
  );
};

export default App;