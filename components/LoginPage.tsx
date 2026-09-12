import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { Building2, ShieldAlert, ArrowRight, UserCircle2, ArrowLeft, Lock } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

const PRESET_ACCOUNTS: Array<{
  username: string;
  role: 'Admin' | 'Assessor' | 'Viewer';
  name: string;
  station: string;
  desc: string;
}> = [
  {
    username: 'juan.assessor',
    role: 'Assessor',
    name: 'Juan Reyes',
    station: 'Assessor-Desk-02',
    desc: 'Property appraisal, RPTAR masterlist & sequential dues clearance',
  },
  {
    username: 'admin',
    role: 'Admin',
    name: 'System Administrator',
    station: 'Main-HQ',
    desc: 'Full system control, masterlist CRUD, staff management & DB backup',
  },
  {
    username: 'mayor.office',
    role: 'Viewer',
    name: 'Hon. Mayor Office',
    station: 'Executive-Desk',
    desc: 'Read-only executive access to collection KPIs & revenue analytics',
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

  // Step 1: Lookup and verify staff username
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
            role: preset.role,
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
      role: preset.role,
      stationId: preset.station
    });
    setError(null);
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col justify-between text-slate-800 font-sans">
      {/* Top Banner */}
      <header className="border-b border-slate-200/80 py-4 px-6 sm:px-12 flex justify-between items-center bg-white shadow-xs">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2.5 rounded-xl text-white shadow-sm">
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-slate-900 tracking-tight leading-tight">
              Municipal Treasurer's Office
            </h1>
            <p className="text-xs text-slate-500 font-medium">Municipality of Santa Rosa, Nueva Ecija</p>
          </div>
        </div>
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
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Municipal Staff Username
                  </label>
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="font-mono text-sm h-11 rounded-xl"
                    placeholder="e.g. juan.assessor"
                    required
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400">
                    Enter username to detect assigned counter and permissions.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl font-bold gap-2 text-sm shadow-sm"
                >
                  <UserCircle2 size={16} />
                  {isLoading ? 'Verifying Account...' : 'Next: Verify Credentials'}
                </Button>
              </form>
            ) : (
              /* STEP 2: Active Directory Detected Profile & Password */
              <form onSubmit={handleFinalLogin} className="space-y-4 animate-fade-in-up">
                {/* Detected Staff Card */}
                {identifiedUser && (
                  <Card className="border-slate-200 bg-slate-50/60 shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                          {identifiedUser.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 leading-tight">
                            {identifiedUser.name}
                          </h4>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <Badge variant="secondary" className="font-semibold text-emerald-700 bg-emerald-50 border-emerald-200 py-0">
                              {identifiedUser.role}
                            </Badge>
                            <span>•</span>
                            <span className="font-mono text-[11px]">{identifiedUser.stationId}</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setStep(1)}
                        className="text-xs text-emerald-700 hover:text-emerald-800 gap-1 h-8"
                      >
                        <ArrowLeft size={12} />
                        Switch
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Account Password
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="font-mono text-sm h-11 rounded-xl"
                    placeholder="••••••••"
                    required
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400">
                    Default test password: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono font-bold">admin123</code>
                  </p>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="h-11 rounded-xl font-bold text-xs px-5"
                  >
                    Back
                  </Button>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-grow h-11 rounded-xl font-bold gap-2 text-sm shadow-sm"
                  >
                    <Lock size={16} />
                    {isLoading ? 'Unlocking Workspace...' : 'Sign In & Open Workspace'}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Right Column: 1-Click Role Profiles */}
          <div className="lg:col-span-6">
            <Card className="border-slate-200 bg-slate-50/70 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-extrabold text-slate-800">
                  1-Click Quick Login by Counter
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Select a municipal profile below to auto-detect identity and test permissions:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {PRESET_ACCOUNTS.map((preset) => (
                  <button
                    key={preset.username}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className="w-full p-4 rounded-xl border border-slate-200 hover:border-emerald-400 bg-white hover:bg-emerald-50/30 text-left transition-all flex items-center justify-between group shadow-2xs hover:shadow-sm cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-extrabold text-xs uppercase tracking-wide border-slate-300">
                          {preset.role}
                        </Badge>
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {preset.station}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800">{preset.name}</p>
                      <p className="text-[11px] text-slate-500 leading-tight">{preset.desc}</p>
                    </div>
                    <ArrowRight size={18} className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-4 px-6 text-center text-xs text-slate-400">
        <p>Republic of the Philippines • Local Government Unit of Santa Rosa, Nueva Ecija • Real Property Tax Administration System</p>
      </footer>
    </div>
  );
};

export default LoginPage;
