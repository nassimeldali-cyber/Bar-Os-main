/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RealtimeProvider, useRealtime } from './context/RealtimeContext';
import { Navbar } from './components/common/Navbar';
import { ClientView } from './components/client/ClientView';
import { ServerView } from './components/server/ServerView';
import { ManagerView } from './components/manager/ManagerView';
import { LoginPage } from './components/auth/LoginPage';
import { SignupPage } from './components/auth/SignupPage';
import { dbEngine } from './lib/dbEngine';
import { Bell, X } from 'lucide-react';

function MainApp() {
  const { currentUser, isLoading } = useAuth();
  const { latestBanner, clearBanner } = useRealtime();

  const [currentView, setCurrentView] = useState<'CLIENT' | 'SERVER' | 'MANAGER'>('CLIENT');
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [clientRestaurantId, setClientRestaurantId] = useState<string>(
    dbEngine.getAllRestaurants()[0]?.id || ''
  );
  const [clientTableId, setClientTableId] = useState<string>(
    dbEngine.getTables(dbEngine.getAllRestaurants()[0]?.id || '')[0]?.id || ''
  );

  const handleSwitchAuthMode = (mode: 'LOGIN' | 'SIGNUP') => {
    setAuthMode(mode);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTable = urlParams.get('table');
      const urlRestaurant = urlParams.get('restaurant');

      if (urlTable && urlRestaurant) {
        setClientTableId(urlTable);
        setClientRestaurantId(urlRestaurant);
        setCurrentView('CLIENT');
      } else {
        const tables = dbEngine.getTables(clientRestaurantId);
        if (tables.length > 0) {
          setClientTableId(tables[0].id);
        }
      }
    }
  }, [clientRestaurantId]);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'MANAGER' && currentView === 'CLIENT') {
        setCurrentView('MANAGER');
      } else if (currentUser.role === 'SERVER' && currentView === 'CLIENT') {
        setCurrentView('SERVER');
      }
    }
  }, [currentUser]);

  const handleNavigate = (
    view: 'CLIENT' | 'SERVER' | 'MANAGER',
    params?: { tableId?: string; restaurantId?: string }
  ) => {
    if (params?.tableId) setClientTableId(params.tableId);
    if (params?.restaurantId) setClientRestaurantId(params.restaurantId);
    setCurrentView(view);
  };

  const handleOpenTableClient = (restaurantId: string, tableId: string) => {
    setClientRestaurantId(restaurantId);
    setClientTableId(tableId);
    setCurrentView('CLIENT');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Chargement...</div>
      </div>
    );
  }

  const needsAuth = (currentView === 'SERVER' || currentView === 'MANAGER') && !currentUser;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      {!needsAuth ? (
        <>
          <Navbar currentView={currentView} onNavigate={handleNavigate} onSwitchAuthMode={handleSwitchAuthMode} />

          {latestBanner && (
            <div className="fixed top-20 right-4 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700 animate-in slide-in-from-top-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-bold mt-0.5">
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-xs text-amber-300">{latestBanner.title}</h4>
                <p className="text-xs text-slate-200 mt-0.5 leading-snug">{latestBanner.message}</p>
              </div>
              <button
                onClick={clearBanner}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex-1">
            {currentView === 'CLIENT' && (
              <ClientView
                restaurantId={clientRestaurantId}
                tableId={clientTableId}
                onSwitchTable={(newId) => setClientTableId(newId)}
              />
            )}

            {currentView === 'SERVER' && (
              <ServerView onOpenTableClient={handleOpenTableClient} />
            )}

            {currentView === 'MANAGER' && (
              <ManagerView onOpenTableClient={handleOpenTableClient} />
            )}
          </div>
        </>
      ) : authMode === 'LOGIN' ? (
        <LoginPage onSwitchToSignup={() => setAuthMode('SIGNUP')} />
      ) : (
        <SignupPage onSwitchToLogin={() => setAuthMode('LOGIN')} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <MainApp />
      </RealtimeProvider>
    </AuthProvider>
  );
}
