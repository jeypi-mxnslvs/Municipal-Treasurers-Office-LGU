import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { Lock, UserCheck, X, ShieldAlert, KeyRound, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

const PRESET_ACCOUNTS = [
  { username: 'maria.cashier', role: 'Cashier', name: 'Maria Santos', station: 'Window-04', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { username: 'juan.assessor', role: 'Assessor', name: 'Juan Reyes', station: 'Assessor-Desk-02', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { username: 'admin', role: 'Admin', name: 'System Administrator', station: 'Main-HQ', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { username: 'mayor.office', role: 'Viewer', name: 'Hon. Mayor Office', station: 'Executive-Desk', color: 'bg-amber-50 text-amber-700 border-amber-200' }
];

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [username, setUsername] = useState('maria.cashier');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.login(username, password);
      localStorage.setItem('lgu_token', res.token);
      onLoginSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials. Password is "admin123"');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = (preset: typeof PRESET_ACCOUNTS[0]) => {
    setUsername(preset.username);
    setPassword('admin123');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <Lock size={18} className="text-white" />
            </div>
            <h2 className="font-bold text-base">Sign In to LGU Treasury Connect</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* Quick Profile Selector for easy demoing */}
          <div>
            <label className="block font-bold text-slate-500 uppercase tracking-wider mb-2">
              Quick Switch Demo Profiles (1-Click)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => handleSelectPreset(acc)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${acc.color} ${
                    username === acc.username ? 'ring-2 ring-blue-500 font-bold shadow-sm' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  <p className="font-bold text-xs leading-tight">{acc.role}</p>
                  <p className="text-[11px] truncate opacity-90">{acc.name}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-slate-400 font-semibold text-[10px] uppercase">
              Or Enter Credentials
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 font-medium">
              <ShieldAlert size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800 text-xs"
                placeholder="e.g. maria.cashier"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-slate-800 text-xs"
                placeholder="••••••••"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">Default test password is: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">admin123</code></p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 text-xs"
            >
              <KeyRound size={14} />
              {isLoading ? 'Authenticating...' : 'Sign In & Access Terminal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
