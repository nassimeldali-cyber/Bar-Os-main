import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Beer, Eye, EyeOff, Mail, Lock } from 'lucide-react';

interface LoginPageProps {
  onSwitchToSignup: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToSignup }) => {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('manager@zoobar.tn');
  const [password, setPassword] = useState('Manager123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await login(email, password);
    if (!success) {
      setError('Email ou mot de passe incorrect');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center mx-auto mb-4 shadow-md shadow-amber-500/20">
              <Beer className="w-8 h-8 text-slate-950" />
            </div>
            <h1 className="text-2xl font-extrabold text-white">BarLounge</h1>
            <p className="text-sm text-slate-400 mt-1">Connexion au tableau de bord</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
                  placeholder="email@exemple.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-bold rounded-xl hover:from-amber-400 hover:to-amber-500 transition disabled:opacity-50 text-sm"
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              Pas de compte ?{' '}
              <button
                onClick={onSwitchToSignup}
                className="text-amber-400 hover:text-amber-300 font-medium"
              >
                Créer un compte
              </button>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-[10px] text-slate-600 text-center mb-2">Comptes de démonstration</p>
            <div className="space-y-1.5 text-center">
              <div className="text-[10px] text-slate-600">
                <span className="font-medium">Manager:</span> manager@zoobar.tn / Manager123!
              </div>
              <div className="text-[10px] text-slate-600">
                <span className="font-medium">Serveur:</span> karim@zoobar.tn / Server123!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
