import React from 'react';
import { UserCircle, LogOut, Users, BookOpen, WifiOff, RefreshCw, FileSpreadsheet, FileText } from 'lucide-react';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { offlineSyncService } from '@/services/offline/OfflineSyncService';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onOpenUserManagement: () => void;
  onOpenBooklets?: () => void;
  onOpenBlgfForm3?: () => void;
  onOpenBatchNotices?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onOpenUserManagement,
  onOpenBooklets,
  onOpenBlgfForm3,
  onOpenBatchNotices,
}) => {
  const [isOnline, setIsOnline] = React.useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = React.useState<number>(0);
  const [isSyncing, setIsSyncing] = React.useState<boolean>(false);

  React.useEffect(() => {
    offlineSyncService.getPendingCount().then(setPendingCount).catch(() => {});

    const unsubscribe = offlineSyncService.subscribe((event) => {
      if (event.type === 'ONLINE') setIsOnline(true);
      if (event.type === 'OFFLINE') setIsOnline(false);
      if (event.type === 'SYNC_START') setIsSyncing(true);
      if (event.type === 'SYNC_COMPLETE') {
        setIsSyncing(false);
        offlineSyncService.getPendingCount().then(setPendingCount).catch(() => {});
      }
      if (event.type === 'SYNC_PROGRESS') {
        setPendingCount(event.pendingCount);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSyncNow = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await offlineSyncService.sync();
    } catch (err) {
      console.error('Manual sync failed:', err);
    } finally {
      setIsSyncing(false);
      const count = await offlineSyncService.getPendingCount().catch(() => 0);
      setPendingCount(count);
    }
  };

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
              className="bg-emerald-800/30 hover:bg-emerald-700 text-emerald-200 hover:text-white border-emerald-600/40 text-xs font-bold gap-1.5"
            >
              <Users size={14} />
              <span className="hidden md:inline">Register Staff</span>
            </Button>
          )}

          {/* AF-51 Booklet Register Button */}
          {user.role !== 'Viewer' && onOpenBooklets && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenBooklets}
              className="bg-emerald-800/30 hover:bg-emerald-700 text-emerald-200 hover:text-white border-emerald-600/40 text-xs font-bold gap-1.5"
              title="View Accountable Form 51 Serial Custody Register"
            >
              <BookOpen size={14} />
              <span className="hidden md:inline">AF-51 Register</span>
            </Button>
          )}

          {/* BLGF Form 3 Report Button */}
          {user.role !== 'Viewer' && onOpenBlgfForm3 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenBlgfForm3}
              className="bg-emerald-800/30 hover:bg-emerald-700 text-emerald-200 hover:text-white border-emerald-600/40 text-xs font-bold gap-1.5"
              title="Bureau of Local Government Finance (BLGF) Form 3 Monthly Collections Report"
            >
              <FileSpreadsheet size={14} />
              <span className="hidden lg:inline">BLGF Form 3</span>
            </Button>
          )}

          {/* Batch Delinquency Notices Button */}
          {user.role !== 'Viewer' && onOpenBatchNotices && (
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

          {/* Offline Caravan & Sync Indicator */}
          {(!isOnline || pendingCount > 0) && (
            <div className="flex items-center gap-1.5">
              {!isOnline && (
                <Badge
                  variant="outline"
                  className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[11px] font-bold px-2 py-1 flex items-center gap-1"
                  title="Operating in Field Caravan Mode (Offline Outbox Active)"
                >
                  <WifiOff size={13} className="shrink-0 animate-pulse text-amber-400" />
                  <span className="hidden sm:inline">Offline Caravan</span>
                </Badge>
              )}
              {pendingCount > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSyncNow}
                  disabled={!isOnline || isSyncing}
                  className="bg-amber-800/40 hover:bg-amber-700/60 text-amber-200 hover:text-white border-amber-600/50 text-xs font-bold gap-1.5 h-8"
                  title="Replay pending offline collection receipts to central database"
                >
                  <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                  <span>Sync ({pendingCount})</span>
                </Button>
              )}
            </div>
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