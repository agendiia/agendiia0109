import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, Megaphone, Wrench, DollarSign, Clock, CheckSquare, IdCard, CreditCard, BarChart4, LifeBuoy, Shield, Lock } from './Icons';
import { useAuth } from '../contexts/AuthContext';

type View = 'dashboard' | 'appointments' | 'clients' | 'marketing' | 'services' | 'finance' | 'availability' | 'profile' | 'subscription' | 'reports' | 'help-center' | 'settings';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  isLocked?: boolean;
}> = ({ icon, label, isActive, onClick, isLocked }) => {
  return (
    <li
      onClick={!isLocked ? onClick : undefined}
      className={`
        relative flex items-center p-1.5 my-0.5 rounded-lg transition-colors duration-200 ease-in-out
        ${
          isLocked
            ? 'cursor-not-allowed text-gray-400 dark:text-gray-500'
            : isActive
            ? 'bg-emerald-700 text-white shadow-md'
            : 'text-gray-900 dark:text-gray-100 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
        }
      `}
      title={isLocked ? 'Disponível no Plano Avançado' : ''}
    >
      {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-md bg-emerald-600" />}
      <div className={`flex items-center ${isActive ? 'opacity-100' : 'opacity-95'}`}>
        <div className={`p-1 rounded-md ${isActive ? 'bg-white/10' : 'bg-transparent'}`}>{icon}</div>
        <span className="ml-2 font-medium text-sm">{label}</span>
      </div>
      {isLocked && <Lock className="h-4 w-4 ml-auto text-gray-400 dark:text-gray-500" />}
    </li>
  );
};

const SidebarMenu: React.FC<{ onNavigate?: () => void; setCurrentView?: (v: any) => void }> = ({ onNavigate, setCurrentView }) => {
  const onClick = (view?: any) => {
    if (onNavigate) onNavigate();
    if (setCurrentView && view) setCurrentView(view);
  };

  return (
    <nav className="flex flex-col space-y-1">
      <button onClick={() => onClick('dashboard')} className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors">
        <div className="flex items-center">
          <LayoutDashboard className="h-4 w-4 mr-3" />
          Dashboard
        </div>
      </button>
      <button onClick={() => onClick('availability')} className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors">
        <div className="flex items-center">
          <Clock className="h-4 w-4 mr-3" />
          Minha Agenda
        </div>
      </button>
      <button onClick={() => onClick('appointments')} className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors">
        <div className="flex items-center">
          <Calendar className="h-4 w-4 mr-3" />
          Agendamentos
        </div>
      </button>
      <button onClick={() => onClick('clients')} className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors">
        <div className="flex items-center">
          <Users className="h-4 w-4 mr-3" />
          Clientes
        </div>
      </button>
      <button onClick={() => onClick('services')} className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors">
        <div className="flex items-center">
          <Wrench className="h-4 w-4 mr-3" />
          Serviços
        </div>
      </button>
      <button onClick={() => onClick('profile')} className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors">
        <div className="flex items-center">
          <IdCard className="h-4 w-4 mr-3" />
          Perfil Profissional
        </div>
      </button>
      <button onClick={() => onClick('marketing')} className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors">
        <div className="flex items-center">
          <Megaphone className="h-4 w-4 mr-3" />
          Marketing com IA
        </div>
      </button>
      <button onClick={() => onClick('finance')} className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors">
        <div className="flex items-center">
          <DollarSign className="h-4 w-4 mr-3" />
          Financeiro
        </div>
      </button>
      <button onClick={() => onClick('reports')} className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors">
        <div className="flex items-center">
          <BarChart4 className="h-4 w-4 mr-3" />
          Relatórios Avançados
        </div>
      </button>
      <button onClick={() => onClick('help-center')} className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors">
        <div className="flex items-center">
          <LifeBuoy className="h-4 w-4 mr-3" />
          Central de Ajuda
        </div>
      </button>
      <button onClick={() => onClick('subscription')} className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors">
        <div className="flex items-center">
          <CreditCard className="h-4 w-4 mr-3" />
          Planos e Assinatura
        </div>
      </button>
      <button onClick={() => onClick('settings')} className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors">
        <div className="flex items-center">
          <Wrench className="h-4 w-4 mr-3" />
          Configurações
        </div>
      </button>
    </nav>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  const { hasAccess } = useAuth();
  const [open, setOpen] = useState(false);
  const scrollYRef = useRef<number>(0);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);

  // Lock body scroll while mobile drawer is open and restore without jump.
  useEffect(() => {
    if (open) {
      scrollYRef.current = window.scrollY || window.pageYOffset || 0;
      // prevent layout shift: fix body in place
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollYRef.current}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
    } else {
      // restore
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      // restore scroll
      window.scrollTo(0, scrollYRef.current || 0);
    }

    return () => {
      // cleanup in case component unmounts
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
    };
  }, [open]);

  // Open handler that prevents one-time jump/scroll by "pinning" scroll position
  const handleOpenImmediate = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Blur any focused element (prevents browser auto-scroll to focused control/anchor)
    try {
      const active = document.activeElement as HTMLElement | null;
      if (active && typeof active.blur === 'function') active.blur();
    } catch (err) {
      /* ignore */
    }

    // Pin current scroll and open drawer (body fixed avoids layout jump)
    const current = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${current}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';

    setOpen(true);

    // Short timeout to restore any transient scroll effects and remove focus from hamburger
    window.setTimeout(() => {
      if (hamburgerRef.current) hamburgerRef.current.blur();
      // ensure page stays at same position while drawer is open
      window.scrollTo(0, current);
    }, 50);
  };

  const navItems: { id: View; label: string; icon: React.ReactNode; isLocked?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { id: 'availability', label: 'Minha Agenda', icon: <Clock className="h-5 w-5" /> },
    { id: 'appointments', label: 'Agendamentos', icon: <Calendar className="h-5 w-5" /> },
    { id: 'clients', label: 'Clientes', icon: <Users className="h-5 w-5" /> },
    { id: 'services', label: 'Serviços', icon: <Wrench className="h-5 w-5" /> },
    { id: 'profile', label: 'Perfil Profissional', icon: <IdCard className="h-5 w-5" /> },
    { id: 'marketing', label: 'Marketing com IA', icon: <Megaphone className="h-5 w-5" />, isLocked: !hasAccess('marketing.view') },
    { id: 'finance', label: 'Financeiro', icon: <DollarSign className="h-5 w-5" /> },
    { id: 'reports', label: 'Relatórios Avançados', icon: <BarChart4 className="h-5 w-5" />, isLocked: !hasAccess('reports.view') },
    { id: 'help-center', label: 'Central de Ajuda', icon: <LifeBuoy className="h-5 w-5" /> },
    { id: 'subscription', label: 'Planos e Assinatura', icon: <CreditCard className="h-5 w-5" /> },
    { id: 'settings', label: 'Configurações', icon: <Wrench className="h-5 w-5" /> },
  ];

  const goAdmin = () => { window.location.href = '/admin'; };

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-col w-64 bg-emerald-100 dark:bg-slate-900 h-screen">
        <aside className="w-64 h-full bg-emerald-100 dark:bg-slate-900 flex flex-col border-r border-emerald-200 dark:border-gray-700">
          <div className="flex items-center justify-center h-16 border-b border-emerald-200 dark:border-gray-700">
            <img src="/logo.png" alt="Agendiia" className="h-10 w-auto" />
          </div>
          <nav className="flex-1 px-3 py-2">
            <ul className="space-y-0.5">
              {navItems.map((item) => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  isActive={currentView === item.id}
                  onClick={() => setCurrentView(item.id)}
                  isLocked={item.isLocked}
                />
              ))}
            </ul>
          </nav>
        </aside>
      </div>

      {/* Mobile: hamburger button — use pointerdown to open immediately */}
      <button
        ref={hamburgerRef}
        type="button"
        onPointerDown={handleOpenImmediate}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        aria-label="Abrir menu"
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white shadow text-gray-700 hover:bg-gray-50 transition-colors"
        style={{ touchAction: 'manipulation' }}
      >
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile drawer */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onPointerDown={(e) => {
              // close on backdrop pointerdown (more responsive than click)
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div className="fixed left-0 top-0 bottom-0 w-80 max-w-sm bg-white z-50 shadow-xl overflow-auto">
            <div className="flex items-center justify-between px-4 h-16 border-b bg-emerald-50">
              <img src="/logo.png" alt="Agendiia" className="h-8 w-auto" />
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                }}
                aria-label="Fechar menu"
                className="p-2 rounded-md hover:bg-emerald-100 transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-3">
              <SidebarMenu
                onNavigate={() => setOpen(false)}
                setCurrentView={(v: View) => {
                  setCurrentView(v);
                  setOpen(false);
                }}
              />
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={goAdmin}
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 transition-colors text-gray-600"
                >
                  Ir para Admin
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Sidebar;