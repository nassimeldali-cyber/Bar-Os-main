import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { NotificationDropdown } from './NotificationDropdown';
import {
  Beer,
  Bell,
  Volume2,
  Users,
  ShieldCheck,
  QrCode,
  LogOut,
  ChevronDown
} from 'lucide-react';

interface NavbarProps {
  currentView: 'CLIENT' | 'SERVER' | 'MANAGER';
  onNavigate: (view: 'CLIENT' | 'SERVER' | 'MANAGER', params?: { tableId?: string; restaurantId?: string }) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const { currentUser, currentRestaurant, switchUser, logout } = useAuth();
  const { unreadCount, playChime } = useRealtime();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const staffProfiles = [
    { id: 'b0000000-0000-0000-0000-000000000001', label: 'Gérant (Manager)', role: 'MANAGER', username: 'MANAGER_01' },
    { id: 'b0000000-0000-0000-0000-000000000873', label: 'Karim (Serveur U873)', role: 'SERVER', username: 'U873' },
    { id: 'b0000000-0000-0000-0000-000000000874', label: 'Sarra (Serveuse U874)', role: 'SERVER', username: 'U874' }
  ];

  const handleSelectStaff = (profileId: string, role: string) => {
    switchUser(profileId);
    setShowRoleMenu(false);
    if (role === 'MANAGER') {
      onNavigate('MANAGER');
    } else {
      onNavigate('SERVER');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand & Restaurant */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
            <Beer className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-base sm:text-lg bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
                BarLounge
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-amber-500/30">
                Démo locale
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              {currentRestaurant?.name || 'Zoo Bar'}
            </p>
          </div>
        </div>

        {/* View Switchers */}
        <div className="flex items-center gap-1 sm:gap-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onNavigate('CLIENT')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              currentView === 'CLIENT'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Client</span> QR
          </button>

          <button
            onClick={() => {
              if (currentUser?.role !== 'SERVER') {
                switchUser('b0000000-0000-0000-0000-000000000873');
              }
              onNavigate('SERVER');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              currentView === 'SERVER'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Espace</span> Serveur
          </button>

          <button
            onClick={() => {
              if (currentUser?.role !== 'MANAGER') {
                switchUser('b0000000-0000-0000-0000-000000000001');
              }
              onNavigate('MANAGER');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              currentView === 'MANAGER'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Gérant
          </button>
        </div>

        {/* Right side: Sound, Notifications, User Profile */}
        <div className="flex items-center gap-2">
          {/* Sound test button */}
          <button
            onClick={playChime}
            title="Tester le carillon sonore des notifications"
            className="p-2 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition"
          >
            <Volume2 className="w-4 h-4" />
          </button>

          {/* Notifications button */}
          <div className="relative">
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 relative transition"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
              )}
            </button>
            <NotificationDropdown
              isOpen={showNotifs}
              onClose={() => setShowNotifs(false)}
            />
          </div>

          {/* Role / User Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 transition"
            >
              <div className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold text-xs">
                {currentUser ? currentUser.username.slice(0, 2) : 'CL'}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold leading-tight">
                  {currentUser ? currentUser.username : 'Mode Client'}
                </p>
                <p className="text-[10px] text-slate-400 leading-tight">
                  {currentUser?.role === 'MANAGER' ? 'Gérant' : currentUser?.role === 'SERVER' ? 'Serveur' : 'Table 01'}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showRoleMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowRoleMenu(false)} />
                <div className="absolute right-0 top-12 w-60 bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-100 z-50 p-2 animate-in fade-in duration-150">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5">
                    Changer de compte (Démo)
                  </p>
                  {staffProfiles.map((staff) => (
                    <button
                      key={staff.id}
                      onClick={() => handleSelectStaff(staff.id, staff.role)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition ${
                        currentUser?.id === staff.id
                          ? 'bg-amber-100 text-amber-900 font-semibold'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div>
                        <div>{staff.label}</div>
                        <div className="text-[10px] text-slate-400">{staff.username}</div>
                      </div>
                      {currentUser?.id === staff.id && (
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                      )}
                    </button>
                  ))}
                  <div className="border-t border-slate-100 my-1 pt-1">
                    <button
                      onClick={() => {
                        logout();
                        setShowRoleMenu(false);
                        onNavigate('CLIENT');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Déconnexion (Vue Client)
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
