import React from 'react';
import { UserCircle, LogOut, Users, FileText } from 'lucide-react';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onOpenUserManagement: () => void;
  onOpenBatchNotices?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onOpenUserManagement,
  onOpenBatchNotices,
}) => {
  const getRoleBadgeVariant = (role: 'Admin' | 'Assessor') => {
    switch (role) {
      case 'Admin':
        return 'default';
      case 'Assessor':
      default:
        return 'secondary';
    }
  };

  return (
    <header className="bg-[#04261f] text-white shadow-md border-b border-emerald-900/60 no-print select-none">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center max-w-7xl">
        {/* Brand with Santa Rosa Official Seal */}
        <div className="flex items-center gap-3">
          <div className="p-1 rounded-xl bg-emerald-950/70 border border-emerald-500/20 shadow-xs flex items-center justify-center shrink-0">
            <img
              src="/santa-rosa-seal.png"
              alt="Official Seal of Santa Rosa, Nueva Ecija"
              className="w-9 h-9 object-contain drop-shadow-sm transition-transform hover:scale-105"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight leading-tight text-white">
                Municipal Treasurer's Office
              </h1>
            </div>
            <p className="text-xs text-emerald-200/70 hidden sm:block font-normal">
              Real Property Tax Delinquency Verification & Statements (RA 7160)
            </p>
          </div>
        </div>

        {/* User Card, Admin Tools & Logout */}
        <div className="flex items-center gap-2.5">
          {/* Admin User Management Button */}
          {user.role === 'Admin' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenUserManagement}
              className="bg-emerald-800/30 hover:bg-emerald-700 text-emerald-200 hover:text-white border-emerald-600/40 text-xs font-bold gap-1.5"
            >
              <Users size={14} />
              <span className="hidden md:inline">Register Staff</span>
            </Button>
          )}

          {/* Batch Delinquency Notices Button */}
          {onOpenBatchNotices && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenBatchNotices}
              className="bg-amber-900/30 hover:bg-amber-800 text-amber-200 hover:text-white border-amber-600/40 text-xs font-bold gap-1.5"
              title="Batch Notice of Delinquency Generator (RA 7160 Sec. 254)"
            >
              <FileText size={14} />
              <span className="hidden lg:inline">Demand Notices</span>
            </Button>
          )}

          {/* User Account / Role Card */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/40 rounded-xl border border-emerald-800/40">
            <UserCircle size={24} className="text-emerald-400 shrink-0" />
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-100 leading-tight">{user.name}</p>
              <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                <span className="text-emerald-300/80 font-mono">{user.stationId}</span>
                <span className="text-emerald-700">•</span>
                <Badge
                  variant={getRoleBadgeVariant(user.role)}
                  className="text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                >
                  {user.role}
                </Badge>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="bg-emerald-950/80 hover:bg-rose-950/60 text-emerald-200 hover:text-rose-200 border-emerald-800/60 hover:border-rose-700/60 text-xs font-semibold gap-1.5"
            title="Log Out and return to Sign-In screen"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;