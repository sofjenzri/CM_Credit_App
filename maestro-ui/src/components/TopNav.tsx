import React from 'react';
import { Bell, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clearAuthStorage, getAuthenticatedUser } from '../services/oauth';

const TopNav: React.FC = () => {
  const navigate = useNavigate();
  const user = getAuthenticatedUser();
  const displayName = user?.name ?? 'Utilisateur';
  const initials = user?.initials ?? 'UT';

  return (
    <header className="portal-topnav bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      {/* Left: Title */}
      <div className="portal-topnav-left flex items-center space-x-4">
        <span className="text-sm text-slate-500 hidden md:block">Portail conseiller</span>
      </div>

      {/* Right: Actions */}
      <div className="portal-topnav-right">
        {/* Search */}
        <div className="portal-topnav-search hidden md:flex items-center bg-slate-100 focus-within:ring-2 focus-within:ring-[#1fa3b3] focus-within:bg-white transition-all">
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un client ou dossier..."
            className="bg-transparent ml-2 flex-1 outline-none text-sm text-slate-900 placeholder-slate-400"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-250">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ff4d14] rounded-full animate-pulse" />
        </button>

        {/* Divider */}
        <div className="portal-topnav-divider" />

        {/* User Menu */}
        <div className="portal-topnav-user">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="text-xs text-slate-500">Conseiller bancaire</p>
          </div>
          <button
            onClick={() => {
              clearAuthStorage();
              navigate('/login');
            }}
            className="portal-topnav-avatar bg-gradient-to-br from-[#1fa3b3] to-[#157a99] flex items-center justify-center text-white font-bold text-lg hover:shadow-lg transition-all duration-250 hover:scale-105"
          >
            {initials}
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopNav;
