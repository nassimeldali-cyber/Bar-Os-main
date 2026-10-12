/**
 * AuthContext - BarLounge SaaS
 * Provides user state, role guards, and authentication methods
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, Restaurant, UserRole } from '../types/database';
import { dbEngine } from '../lib/dbEngine';

interface AuthContextType {
  currentUser: Profile | null;
  currentRestaurant: Restaurant | null;
  role: UserRole | null;
  isLoading: boolean;
  login: (identifier: string, expectedRole?: UserRole) => Promise<boolean>;
  logout: () => void;
  switchUser: (profileId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'barlounge_auth_user_id';
const RESTAURANT_STORAGE_KEY = 'barlounge_auth_restaurant_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentRestaurant, setCurrentRestaurant] = useState<Restaurant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize default restaurant
    const defaultRest = dbEngine.getAllRestaurants()[0];
    setCurrentRestaurant(defaultRest || null);

    // Check stored user
    const savedUserId = localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedUserId) {
      const profile = dbEngine.getProfileById(savedUserId);
      if (profile && profile.is_active) {
        setCurrentUser(profile);
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (identifier: string, expectedRole?: UserRole): Promise<boolean> => {
    setIsLoading(true);
    try {
      const clean = identifier.trim();
      let profile = dbEngine.getProfileByUsername(clean);
      if (!profile) {
        profile = dbEngine.getProfileByEmail(clean);
      }

      if (!profile) {
        setIsLoading(false);
        return false;
      }

      if (expectedRole && profile.role !== expectedRole) {
        setIsLoading(false);
        return false;
      }

      if (!profile.is_active) {
        setIsLoading(false);
        return false;
      }

      setCurrentUser(profile);
      localStorage.setItem(AUTH_STORAGE_KEY, profile.id);

      // Default restaurant for demo
      const rest = dbEngine.getAllRestaurants()[0];
      if (rest) {
        setCurrentRestaurant(rest);
        localStorage.setItem(RESTAURANT_STORAGE_KEY, rest.id);
      }

      setIsLoading(false);
      return true;
    } catch (e) {
      console.error('Login error', e);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const switchUser = (profileId: string) => {
    const prof = dbEngine.getProfileById(profileId);
    if (prof) {
      setCurrentUser(prof);
      localStorage.setItem(AUTH_STORAGE_KEY, prof.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRestaurant,
        role: currentUser?.role || null,
        isLoading,
        login,
        logout,
        switchUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
