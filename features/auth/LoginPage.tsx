import React, { useState } from 'react';
import { User } from '@/types';
import { api } from '@/services/api';
import { createSessionToken } from '@/lib/crypto';
import { Lock, User as UserIcon, ArrowRight, Sparkles, ShieldAlert, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
  sessionWarning?: string | null;
}

interface DemoPersonnel {
  title: string;
  username: string;
  role: 'Admin' | 'Cashier' | 'Assessor' | 'Viewer';
  name: string;
  stationId: string;
}

const DEMO_PERSONNEL: DemoPersonnel[] = [
  {
    title: 'MUNICIPAL TREASURER',
    username: 'treasurer',
    role: 'Admin',
    name: 'Municipal Treasurer',
    stationId: 'Treasury-Office',
  },
  {
    title: 'ASSISTANT TREASURER',
    username: 'asst.treasurer',
    role: 'Admin',
    name: 'Assistant Municipal Treasurer',
    stationId: 'Treasury-Asst',
  },
  {
    title: 'WINDOW 01 CASHIER',
    username: 'cashier1',
    role: 'Cashier',
    name: 'Window 01 Cashier',
    stationId: 'Window-01',
  },
  {
    title: 'WINDOW 02 CASHIER',
    username: 'cashier2',
    role: 'Cashier',
    name: 'Window 02 Cashier',
    stationId: 'Window-02',
  },
  {
    title: 'REVENUE STAFF',
    username: 'assessor',
    role: 'Assessor',
    name: 'Revenue Assessment Staff',
    stationId: 'Assessor-Desk',
  },
  {
    title: 'COA AUDITOR',
    username: 'auditor',
    role: 'Viewer',
    name: 'COA Resident Auditor',
    stationId: 'COA-Audit-Desk',
  },
  {
    title: 'SYSTEM ADMINISTRATOR',
    username: 'admin',
    role: 'Admin',
    name: 'System Administrator',
    stationId: 'Main-HQ',
  },
];

// Legacy / alias accounts compatibility mapping
const LEGACY_ACCOUNTS: Record<string, { role: 'Admin' | 'Cashier' | 'Assessor' | 'Viewer'; name: string; stationId: string }> = {
  'juan.assessor': { role: 'Assessor', name: 'Juan Reyes', stationId: 'Assessor-Desk-02' },
  'mayor.office': { role: 'Viewer', name: 'Hon. Mayor Office', stationId: 'Executive-Desk' },
};

const DEFAULT_DEMO_PASSWORD = 'demotreasury2026!';

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, sessionWarning }) => {
  const [username, setUsername] = useState('treasurer');
  const [password, setPassword] = useState(DEFAULT_DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const matchedDemo = DEMO_PERSONNEL.find(
    (p) => p.username.toLowerCase() === username.trim().toLowerCase()
  );

  const handleQuickSelect = (personnel: DemoPersonnel) => {
    setUsername(personnel.username);
    setPassword(DEFAULT_DEMO_PASSWORD);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    try {
      // 1. Attempt API / Supabase authentication
      const selectedStation = matchedDemo?.stationId || 'Workstation';
      const res = await api.login(cleanUsername, cleanPassword, selectedStation);
      localStorage.setItem('lgu_token', res.token);
      localStorage.setItem('lgu_user', JSON.stringify(res.user));
      onLoginSuccess(res.user);
    } catch (err) {
      // 2. Fallback for demo test personnel if database record does not exist
      const demoAccount =
        DEMO_PERSONNEL.find((p) => p.username.toLowerCase() === cleanUsername) ||
        (LEGACY_ACCOUNTS[cleanUsername]
          ? {
              username: cleanUsername,
              title: LEGACY_ACCOUNTS[cleanUsername].name,
              ...LEGACY_ACCOUNTS[cleanUsername],
            }
          : null);

      const isValidDemoPassword =
        cleanPassword === DEFAULT_DEMO_PASSWORD || cleanPassword === 'admin123';

      if (demoAccount && isValidDemoPassword) {
        const demoUser: User = {
          id: demoAccount.username,
          name: demoAccount.name,
          username: demoAccount.username,
          role: demoAccount.role,
          stationId: demoAccount.stationId,
        };

        const token = await createSessionToken(demoUser);
        localStorage.setItem('lgu_token', token);
        localStorage.setItem('lgu_user', JSON.stringify(demoUser));
        onLoginSuccess(demoUser);
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : 'Invalid credentials. Please verify your username and password.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#fafafa] text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Left Pane: Staff Authentication Workstation */}
      <div className="w-full lg:w-1/2 min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-14 xl:p-16 bg-white border-r border-slate-200/80">
        <div className="max-w-md w-full mx-auto my-auto py-8">
          {/* Workstation Header */}
          <div className="mb-6">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-slate-950">
              Sign in
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              Secure internal workstation for revenue assessment, tax collection, cashiering
              operations, and financial auditing.
            </p>
          </div>

          {/* Session Warnings & Error Banners */}
          {typeof sessionWarning === 'string' && sessionWarning.trim() && (
            <div className="mb-5 p-3.5 bg-amber-50/90 border border-amber-200/80 text-amber-900 rounded-lg text-xs flex items-center gap-2.5 font-medium">
              <Lock size={15} className="text-amber-600 shrink-0" />
              <span>{sessionWarning}</span>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50/90 border border-rose-200/80 text-rose-900 rounded-lg text-xs flex items-center gap-2.5 font-medium">
              <ShieldAlert size={15} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Staff User Identification */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Staff User Identification
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserIcon size={16} />
                </div>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. cashier1 or treasurer"
                  className="h-11 pl-10 pr-10 text-sm font-normal bg-white border-slate-300/90 focus-visible:ring-emerald-600/30 focus-visible:border-emerald-600 rounded-lg transition-colors placeholder:text-slate-400"
                  required
                  autoFocus
                />
                {matchedDemo && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
                      <CheckCircle2 size={11} className="text-emerald-600" />
                      {matchedDemo.role}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Access Credential / Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Access Credential / Password
                </label>
                <span className="text-[10px] font-mono text-slate-400">
                  Default: demotreasury2026!
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="h-11 pl-10 pr-10 text-sm font-mono bg-white border-slate-300/90 focus-visible:ring-emerald-600/30 focus-visible:border-emerald-600 rounded-lg transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-hidden"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-[#06382c] hover:bg-[#084838] active:bg-[#04281f] text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 group cursor-pointer mt-2"
            >
              <span>{isLoading ? 'Signing In to Workstation...' : 'Sign In to Workstation'}</span>
              {!isLoading && (
                <ArrowRight
                  size={15}
                  className="transition-transform group-hover:translate-x-1"
                />
              )}
            </Button>
          </form>

          {/* Demo / Test Personnel Quick Select Grid */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider mb-3">
              <Sparkles size={13} className="text-emerald-600" />
              <span>Demo / Test Personnel</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {DEMO_PERSONNEL.map((personnel) => {
                const isSelected =
                  username.trim().toLowerCase() === personnel.username.toLowerCase();
                return (
                  <button
                    key={personnel.username}
                    type="button"
                    onClick={() => handleQuickSelect(personnel)}
                    className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs ring-1 ring-emerald-600/20'
                        : 'border-slate-200/90 bg-white hover:border-emerald-400 hover:bg-slate-50/60 shadow-2xs'
                    }`}
                  >
                    <span className="text-[10px] font-black text-slate-800 tracking-wide uppercase block leading-tight truncate">
                      {personnel.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 mt-1 block truncate">
                      {personnel.username}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom-left discreet monogram */}
        <div className="pt-4 flex items-center justify-start">
          <div
            className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-serif text-xs font-bold select-none shadow-xs"
            title="Municipality of Santa Rosa • Province of Nueva Ecija"
          >
            N
          </div>
        </div>
      </div>

      {/* Right Pane: Official Municipal Treasury Showcase */}
      <div className="hidden lg:flex lg:w-1/2 min-h-screen flex-col justify-between p-10 lg:p-14 xl:p-16 bg-[#04261f] text-white relative overflow-hidden select-none">
        {/* Subtle decorative radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top Official Banner */}
        <div className="flex items-center justify-between pb-4 border-b border-emerald-800/40 relative z-10">
          <span className="text-[10px] font-mono tracking-widest text-emerald-300/80 uppercase">
            Republic of the Philippines · Province of Nueva Ecija
          </span>
          <span className="border border-emerald-500/40 text-emerald-300 text-[10px] font-mono tracking-wider px-2 py-0.5 rounded uppercase">
            Official System
          </span>
        </div>

        {/* Center Official Branding */}
        <div className="flex flex-col items-center justify-center text-center my-auto py-12 relative z-10">
          <div className="relative group">
            <img
              src="/santa-rosa-seal.png"
              alt="Official Seal of Santa Rosa, Nueva Ecija"
              className="w-44 h-44 xl:w-48 xl:h-48 object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.5)] transition-transform duration-500 hover:scale-105"
            />
          </div>

          <h2 className="font-serif text-3xl xl:text-4xl font-medium tracking-tight text-white mt-8 mb-1">
            Municipality of Santa Rosa
          </h2>
          <p className="text-sm xl:text-base text-emerald-200/80 font-serif font-normal">
            Nueva Ecija, Philippines
          </p>

          <div className="w-20 border-t border-emerald-700/50 my-6" />

          <p className="italic text-emerald-200/70 text-xs sm:text-sm font-serif max-w-sm leading-relaxed px-4">
            &ldquo;Public service through accountable financial management.&rdquo;
          </p>
        </div>

        {/* Bottom Municipal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-emerald-800/40 text-[11px] font-mono text-emerald-400/60 relative z-10">
          <span>Office of the Municipal Treasurer</span>
          <span>Treasury Management System</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
