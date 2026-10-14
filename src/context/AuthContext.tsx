/**
 * AuthContext - BarLounge SaaS
 * Provides user state, role guards, and authentication methods
 * Uses Supabase Auth for authentication and profile management.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, Restaurant, UserRole } from '../types/database';
import { dbEngine } from '../lib/dbEngine';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface AuthContextType {
  currentUser: Profile | null;
  currentRestaurant: Restaurant | null;
  role: UserRole | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchUser: (profileId: string) => void;
  signUp: (email: string, password: string, fullName: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentRestaurant, setCurrentRestaurant] = useState<Restaurant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      // Listen for auth state changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const client = supabase;
          if (client) {
            const { data: profile, error } = await client
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profile && !error) {
              setCurrentUser(profile as Profile);

              // Get restaurant from restaurant_users
              const { data: restUsers } = await client
                .from('restaurant_users')
                .select('restaurant_id')
                .eq('user_id', profile.id)
                .limit(1);

              const restId = restUsers?.[0]?.restaurant_id;
              if (restId) {
                dbEngine.setRestaurant(restId);
                const restaurant = dbEngine.getAllRestaurants().find((r) => r.id === restId);
                if (restaurant) {
                  setCurrentRestaurant(restaurant);
                }
              }
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setCurrentRestaurant(null);
        }
      });

      // Check for existing session on mount
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const client = supabase;
          if (client) {
            client
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()
              .then(({ data: profile, error }) => {
                if (profile && !error) {
                  setCurrentUser(profile as Profile);
                }
                const restaurant = dbEngine.getAllRestaurants()[0];
                if (restaurant) {
                  setCurrentRestaurant(restaurant);
                }
              });
          }
        }
        setIsLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      const defaultRest = dbEngine.getAllRestaurants()[0];
      setCurrentRestaurant(defaultRest || null);
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase) {
      // Fallback: look up profile in local cache
       const profile = dbEngine.getProfileByEmail(email) || dbEngine.getProfileByUsername(email);
      if (profile && profile.is_active) {
        setCurrentUser(profile);
        const rest = dbEngine.getAllRestaurants()[0];
        if (rest) {
          setCurrentRestaurant(rest);
          dbEngine.setRestaurant(rest.id);
        }
        void dbEngine.syncToSupabase();
        return true;
      }
      return false;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase!.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        setIsLoading(false);
        return false;
      }

      const { data: profile, error: profErr } = await supabase!
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profErr || !profile) {
        setIsLoading(false);
        return false;
      }

      setCurrentUser(profile as Profile);

      const { data: restUsers } = await supabase!
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', profile.id)
        .limit(1);

      const restId = restUsers?.[0]?.restaurant_id;
      if (restId) {
        dbEngine.setRestaurant(restId);
        const rest = dbEngine.getAllRestaurants().find((r) => r.id === restId);
        if (rest) {
          setCurrentRestaurant(rest);
        } else {
          const { data: restaurant } = await supabase!
            .from('restaurants')
            .select('*')
            .eq('id', restId)
            .single();
          if (restaurant) {
            setCurrentRestaurant(restaurant as Restaurant);
          }
        }
      }

      setIsLoading(false);
      return true;
    } catch (e) {
      console.error('Login error', e);
      setIsLoading(false);
      return false;
    }
  };

  const signUp = async (email: string, password: string, fullName: string): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase) {
      return false;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error || !data.user) {
        setIsLoading(false);
        return false;
      }

      // Profile creation is handled by the database trigger
      // Wait a moment for the trigger to execute, then fetch the profile
      setTimeout(async () => {
        const { data: profile } = await supabase!
          .from('profiles')
          .select('*')
          .eq('id', data.user!.id)
          .single();
        if (profile) {
          setCurrentUser(profile as Profile);
        }
      }, 1000);

      setIsLoading(false);
      return true;
    } catch (e) {
      console.error('Signup error', e);
      setIsLoading(false);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
    setCurrentRestaurant(null);
  };

  const switchUser = (profileId: string) => {
    const prof = dbEngine.getProfileById(profileId);
    if (prof) {
      setCurrentUser(prof);

      const restUsers = dbEngine.getState().restaurantUsers.filter((ru) => ru.user_id === prof.id);
      const restId = restUsers[0]?.restaurant_id;
      if (restId) {
        dbEngine.setRestaurant(restId);
        const rest = dbEngine.getAllRestaurants().find((r) => r.id === restId);
        if (rest) {
          setCurrentRestaurant(rest);
        }
      }
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
        switchUser,
        signUp,
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
