import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { Building2, KeyRound, ShieldAlert, ShieldCheck, ArrowRight, UserCircle2, ArrowLeft, Lock } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

const PRESET_ACCOUNTS = [
  {
    username: 'juan.assessor',
    role: 'Assessor',
    name: 'Juan Reyes',
    station: 'Assessor-Desk-02',
    desc: 'Property appraisal, RPTAR masterlist & sequential dues clearance',
    border: 'border-blue-200 hover:border-blue-400 bg-blue-50/50 hover:bg-blue-50 text-blue-900'
  },
  {
    username: 'admin',
    role: 'Admin',
    name: 'System Administrator',
    station: 'Main-HQ',
    desc: 'Full system control, masterlist CRUD, staff management & DB backup',
    border: 'border-purple-200 hover:border-purple-400 bg-purple-50/50 hover:bg-purple-50 text-purple-900'
  },
  {
    username: 'mayor.office',
    role: 'Viewer',
    name: 'Hon. Mayor Office',
    station: 'Executive-Desk',
    desc: 'Read-only executive access to collection KPIs & revenue analytics',
    border: 'border-amber-200 hover:border-amber-400 bg-amber-50/50 hover:bg-amber-50 text-amber-900'
  }
];

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  // Step 1: Username / Staff Profile Selection; Step 2: Password Entry
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState('juan.assessor');
  const [password, setPassword] = useState('admin123');
  const [identifiedUser, setIdentifiedUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Lookup and verify staff username (Active Directory / Domain identification)
  const handleProceedToPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const user = await api.lookupUser(username.trim());
      if (user) {
        setIdentifiedUser(user);
        setStep(2);
      } else {
        // Fallback for preset matches
        const preset = PRESET_ACCOUNTS.find(p => p.username.toLowerCase() === username.trim().toLowerCase());
        if (preset) {
          setIdentifiedUser({
            id: preset.username,
            name: preset.name,
            username: preset.username,
            role: preset.role as any,
            stationId: preset.station
          });
          setStep(2);
        } else {
          setError(`Staff account "${username}" not found in municipal directory.`);
        }
      }
    } catch {
      setError('Unable to verify staff username.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Authenticate password
  const handleFinalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.login(username, password);
      localStorage.setItem('lgu_token', res.token);
      localStorage.setItem('lgu_user', JSON.stringify(res.user));
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid password. (Default test password is "admin123")');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = (preset: typeof PRESET_ACCOUNTS[0]) => {
    setUsername(preset.username);
    setPassword('admin123');
    setIdentifiedUser({
      id: preset.username,
      name: preset.name,
      username: preset.username,
      role: preset.role as any,
      stationId: preset.station
    });
    setError(null);
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between text-slate-800 font-sans">
      {/* Top Banner */}
      <header className="border-b border-slate-100 py-4 px-6 sm:px-12 flex justify-between items-center bg-white shadow-xs">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-sm">
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-slate-900 tracking-tight leading-tight">
              Municipal Treasurer's Office
            </h1>
            {/* <p className="text-xs text-slate-500 font-medium">Real Property Tax Administration & Compliance (RA 7160)</p> */}
          </div>
        </div>

        {/* <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span>Active Directory Municipal Domain</span>
        </div> */}
      </header>

      {/* Main Login Content */}
      <main className="flex-grow container mx-auto px-4 py-8 sm:py-12 max-w-5xl flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

          {/* Left Column: Active Directory-Style 2-Step Form */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight">
                {step === 1 ? 'Identify Staff Account' : 'Enter Terminal Password'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {step === 1
                  ? 'Enter your municipal username or select your counter profile below.'
                  : 'Confirm your credentials to unlock the municipal property ledger.'}
              </p>
            </div>

            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                <ShieldAlert size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: Enter Username */}
            {step === 1 ? (
              <form onSubmit={handleProceedToPassword} className="space-y-4 animate-fade-in-up">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Municipal Staff Username
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-slate-800 font-mono"
                      placeholder="e.g. juan.assessor"
                      required
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Enter username to detect assigned counter and permissions.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 text-sm"
                >
                  <UserCircle2 size={16} />
                  {isLoading ? 'Verifying Account...' : 'Next: Verify Credentials'}
                </button>
              </form>
            ) : (
              /* STEP 2: Active Directory Detected Profile & Password */
              <form onSubmit={handleFinalLogin} className="space-y-4 animate-fade-in-up">
                {/* Detected Staff Badge */}
                {identifiedUser && (
                  <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        {identifiedUser.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 leading-tight">
                          {identifiedUser.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          <span className="font-semibold text-blue-700">{identifiedUser.role}</span>
                          <span>•</span>
                          <span className="font-mono text-[11px]">{identifiedUser.stationId}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-1"
                    >
                      <ArrowLeft size={12} />
                      Switch
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Account Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono text-slate-800"
                    placeholder="••••••••"
                    required
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Default test password: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono font-bold">admin123</code>
                  </p>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    Back
                  </button>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-grow py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 text-sm"
                  >
                    <Lock size={16} />
                    {isLoading ? 'Unlocking Workspace...' : 'Sign In & Open Workspace'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right Column: 1-Click Role Profiles */}
          <div className="lg:col-span-6 bg-slate-50 p-6 sm:p-8 rounded-3xl border border-slate-200 space-y-4">
            <div>
              <h3 className="font-extrabold text-base text-slate-800">
                1-Click Quick Login by Counter
              </h3>
              <p className="text-xs text-slate-500">
                Select a municipal profile below to auto-detect identity and test permissions:
              </p>
            </div>

            <div className="space-y-3">
              {PRESET_ACCOUNTS.map((preset) => (
                <button
                  key={preset.username}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group ${preset.border}`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm uppercase tracking-wide">
                        {preset.role}
                      </span>
                      <span className="text-[10px] font-mono opacity-70 bg-white/70 px-1.5 py-0.2 rounded border border-current">
                        {preset.station}
                      </span>
                    </div>
                    <p className="text-xs font-bold">{preset.name}</p>
                    <p className="text-[11px] opacity-80 leading-tight">{preset.desc}</p>
                  </div>
                  <ArrowRight size={18} className="opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-4 px-6 text-center text-xs text-slate-400">
        <p>Republic of the Philippines • Local Government Unit • Real Property Tax Administration System</p>
      </footer>
    </div>
  );
};

export default LoginPage;
