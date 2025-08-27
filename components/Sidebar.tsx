import React from 'react';
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
        relative flex items-center p-3 my-1 rounded-lg transition-colors duration-200 ease-in-out
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
      {/* active left indicator */}
      {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-1 rounded-r-md bg-emerald-600" />}
      <div className={`flex items-center ${isActive ? 'opacity-100' : 'opacity-95'}`}>
        <div className={`p-1 rounded-md ${isActive ? 'bg-white/10' : 'bg-transparent'}`}>{icon}</div>
        <span className="ml-3 font-medium">{label}</span>
      </div>
      {isLocked && <Lock className="h-4 w-4 ml-auto text-gray-400 dark:text-gray-500" />}
    </li>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  const { hasAccess } = useAuth();

  const navItems: { id: View; label: string; icon: React.ReactNode; isLocked?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { id: 'availability', label: 'Minha Agenda', icon: <Clock className="h-5 w-5" /> },
    { id: 'appointments', label: 'Agendamentos', icon: <Calendar className="h-5 w-5" /> },
    { id: 'clients', label: 'Clientes', icon: <Users className="h-5 w-5" /> },
  { id: 'services', label: 'Serviços', icon: <Wrench className="h-5 w-5" /> },
    { id: 'marketing', label: 'Marketing com IA', icon: <Megaphone className="h-5 w-5" />, isLocked: !hasAccess('marketing.view') },
    { id: 'finance', label: 'Financeiro', icon: <DollarSign className="h-5 w-5" /> },
    { id: 'reports', label: 'Relatórios Avançados', icon: <BarChart4 className="h-5 w-5" />, isLocked: !hasAccess('reports.view') },
    { id: 'help-center', label: 'Central de Ajuda', icon: <LifeBuoy className="h-5 w-5" /> },
  { id: 'profile', label: 'Perfil Profissional', icon: <IdCard className="h-5 w-5" /> },
  { id: 'subscription', label: 'Planos e Assinatura', icon: <CreditCard className="h-5 w-5" /> },
  { id: 'settings', label: 'Configurações', icon: <Wrench className="h-5 w-5" /> },
  ];

  const goAdmin = () => { window.location.href = '/admin'; };

  return (
    <>
      <div className="hidden md:flex md:flex-col w-64 bg-gray-50 h-screen">
        <aside className="w-64 h-full bg-emerald-100 dark:bg-slate-900 flex flex-col border-r border-emerald-200 dark:border-gray-700">
          <div className="flex items-center justify-center h-20 border-b border-emerald-200 dark:border-gray-700">
            <img src="/logo.png" alt="Agendiia" className="h-12 w-auto" />
          </div>
          <nav className="flex-1 px-4 py-4">
            <ul>
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
            <div className="my-4 border-t border-gray-200 dark:border-gray-700"></div>
            <ul>
              
            </ul>
          </nav>
        </aside>
      </div>

      {/* Mobile: optional top/bottom nav or hamburger - keep layout stable */}
      <div className="md:hidden">
        {/* You can add a small bottom nav or hamburger toggle here */}
      </div>
    </>
  );
};

export default Sidebar;