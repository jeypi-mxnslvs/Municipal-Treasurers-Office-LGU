import React from 'react';
import { Building2, UserCircle, LogOut, Users } from 'lucide-react';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onOpenUserManagement: () => void;
}

const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onOpenUserManagement,
}) => {
  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'default';
      case 'Assessor':
        return 'secondary';
      case 'Cashier':
        return 'success';
      case 'Viewer':
      default:
        return 'warning';
    }
  };

  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 no-print">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center max-w-7xl">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-inner flex items-center justify-center shrink-0">
            <Building2 size={22} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight leading-tight">
                Municipal Treasurer's Office
              </h1>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Real Property Tax Administration & Compliance (RA 7160)
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
              className="bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border-purple-500/40 text-xs font-bold gap-1.5"
            >
              <Users size={14} />
              <span className="hidden md:inline">Register Staff</span>
            </Button>
          )}

          {/* User Account / Role Card */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <UserCircle size={24} className="text-blue-400 shrink-0" />
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-200 leading-tight">{user.name}</p>
              <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                <span className="text-slate-400">{user.stationId}</span>
                <span className="text-slate-600">•</span>
                <Badge
                  variant={getRoleBadgeVariant(user.role)}
                  className="text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider"
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
            className="bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 border-slate-700 hover:border-rose-500/40 text-xs font-semibold gap-1.5"
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