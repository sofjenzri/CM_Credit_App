import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  CalendarDays,
  Landmark,
  LineChart,
  Briefcase,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { clearAuthStorage } from '../services/oauth';

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const portalLabel = (location.pathname === '/submissions' || location.pathname.startsWith('/cases/')) ? 'Portail Analyste Crédit' : 'Portail Conseiller';

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
    { path: '/submissions', icon: FileText, label: 'Mes dossiers en cours' },
    { path: '/priority-queue', icon: CalendarDays, label: 'Mon agenda' },
    { path: '/portfolio', icon: Briefcase, label: 'Mon portefeuille' },
    { path: '/reports', icon: LineChart, label: 'Rapports' },
    { path: '/agents', icon: Landmark, label: 'Espace agence' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-6 left-6 z-50 p-3 bg-brand-500 text-white rounded-lg shadow-lg hover:bg-brand-600 transition-all duration-250 hover:shadow-xl"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`${
          isOpen ? 'w-72' : 'w-0'
        } hidden md:flex bg-[#102330] text-white transition-all duration-300 flex-col overflow-hidden h-full rounded-2xl z-30 shadow-2xl shrink-0`}
      >
        {/* Logo Section */}
        <div className="h-20 flex items-center px-5 border-b border-[#1e3a4a] bg-[#0d1b26]">
          <Link to="/dashboard" className="flex items-center gap-3 w-full hover:opacity-80 transition-opacity" style={{ paddingLeft: '8px' }}>
            <div className="w-10 h-10 bg-gradient-to-br from-[#1fa3b3] to-[#157a99] rounded-xl flex items-center justify-center font-bold text-base text-white shadow-lg">
              Ui
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base leading-tight">UiBank</span>
              <span className="text-xs text-[#9dc6d3] font-medium">{portalLabel}</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-hide flex flex-col" style={{ padding: '16px 12px', gap: '6px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{ padding: '11px 16px' }}
                className={`flex items-center gap-3 rounded-xl transition-all duration-250 group relative ${
                  active
                    ? 'bg-[#1fa3b3]/20 text-[#8de6f1] shadow-lg border border-[#1fa3b3]/40'
                    : 'text-[#c8e0e8] hover:text-white hover:bg-[#1e3a4a]/70'
                }`}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#1fa3b3] rounded-r-full" />
                )}
                <Icon size={18} className="flex-shrink-0 ml-1" />
                <span className="font-medium text-[14px] leading-5 flex-1">{item.label}</span>
                {active && (
                  <div className="w-1.5 h-1.5 bg-[#1fa3b3] rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="h-px bg-[#1e3a4a] mx-4" />

        {/* Footer Section */}
        <div className="flex flex-col" style={{ padding: '12px 16px', gap: '8px' }}>
          <Link
            to="/settings"
            className="flex items-center gap-3.5 rounded-lg transition-all duration-250 group text-[#c8e0e8] hover:text-white hover:bg-[#1e3a4a]/70"
            style={{ padding: '10px 20px' }}
          >
            <Settings size={20} className="group-hover:text-[#1fa3b3] transition-colors" />
            <span className="font-medium text-[15px]">Paramètres</span>
          </Link>
          <button
            onClick={() => {
              clearAuthStorage();
              navigate('/login');
            }}
            className="w-full flex items-center gap-3.5 rounded-lg transition-all duration-250 group text-[#c8e0e8] hover:text-red-300 hover:bg-red-500/10"
            style={{ padding: '10px 20px' }}
          >
            <LogOut size={20} className="group-hover:text-red-300 transition-colors" />
            <span className="font-medium text-[15px]">Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
