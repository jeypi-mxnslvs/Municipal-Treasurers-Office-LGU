import React from 'react';
import { Building2, UserCircle, LogOut, Users } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onOpenUserManagement: () => void;
}

const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onOpenUserManagement
}) => {
  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 no-print">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center max-w-7xl">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-inner flex items-center justify-center">
            <Building2 size={22} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight leading-tight">
                Municipal Treasurer's Office
              </h1>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Real Property Tax Administration & Compliance (RA 7160)</p>
          </div>
        </div>

        {/* User Card, Admin Tools & Logout */}
        <div className="flex items-center gap-2.5">
          {/* Admin User Management Button */}
          {user.role === 'Admin' && (
            <button
              onClick={onOpenUserManagement}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 rounded-xl text-xs font-bold transition-all"
            >
              <Users size={14} />
              <span className="hidden md:inline">Register Staff</span>
            </button>
          )}

          {/* User Account / Role Card */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <UserCircle size={24} className="text-blue-400 flex-shrink-0" />
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-200 leading-tight">{user.name}</p>
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-slate-400">{user.stationId}</span>
                <span className="text-slate-600">•</span>
                <span className={`font-bold uppercase ${user.role === 'Admin' ? 'text-purple-400' :
                  user.role === 'Assessor' ? 'text-blue-400' :
                    user.role === 'Cashier' ? 'text-emerald-400' :
                      'text-amber-400'
                  }`}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 rounded-xl text-xs font-semibold transition-all"
            title="Log Out and return to Sign-In screen"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;