import React, { useState, useEffect } from 'react';
import { User } from '@/types';
import { api } from '@/services/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  UserPlus,
  Users,
  CheckCircle2,
  ShieldAlert,
  KeyRound,
  Trash2,
  Download,
} from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('admin123');
  const [role, setRole] = useState<'Assessor' | 'Admin' | 'Viewer'>('Assessor');
  const [stationId, setStationId] = useState('Assessor-Desk-03');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password Reset State
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const fetchUsersList = async () => {
    try {
      const list = await api.getUsers();
      setUsers(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsersList();
      setStatusMessage(null);
      setResetTargetUser(null);
    }
  }, [isOpen]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      await api.registerUser({
        fullName,
        username,
        password,
        role,
        stationId,
      });

      setStatusMessage({
        type: 'success',
        text: `Account for ${fullName} (${role}) registered successfully!`,
      });
      setFullName('');
      setUsername('');
      setPassword('admin123');
      await fetchUsersList();
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to create user account',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (userToDelete.username === 'admin') {
      alert('The primary System Administrator account cannot be deleted.');
      return;
    }

    if (currentUser && String(currentUser.id) === String(userToDelete.id)) {
      alert('You cannot delete your own active administrator account.');
      return;
    }

    if (
      confirm(
        `Are you sure you want to permanently delete the staff account "${userToDelete.name}" (${userToDelete.username})?`
      )
    ) {
      try {
        await api.deleteUser(userToDelete.id);
        setStatusMessage({
          type: 'success',
          text: `Account "${userToDelete.name}" deleted successfully.`,
        });
        await fetchUsersList();
      } catch (err) {
        setStatusMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to delete user',
        });
      }
    }
  };

  const handleOpenPasswordReset = (user: User) => {
    setResetTargetUser(user);
    setNewPasswordInput('');
  };

  const handleExecutePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !newPasswordInput) return;

    try {
      await api.resetUserPassword(resetTargetUser.id, newPasswordInput);
      setStatusMessage({
        type: 'success',
        text: `Password for "${resetTargetUser.name}" has been updated.`,
      });
      setResetTargetUser(null);
      setNewPasswordInput('');
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update password',
      });
    }
  };

  const handleDownloadBackup = () => {
    const url = api.getBackupDownloadUrl();
    const link = document.createElement('a');
    link.href = url;
    link.download = `lgu-treasury-backup-${new Date().toISOString().split('T')[0]}.sqlite`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatusMessage({ type: 'success', text: 'Database backup dump initiated successfully.' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] p-0 flex flex-col overflow-hidden gap-0 border-slate-200 shadow-2xl">
        {/* Modal Header */}
        <DialogHeader className="bg-slate-900 px-6 py-4 flex flex-row items-center justify-between text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600 rounded-lg shrink-0">
              <Users size={18} className="text-white" />
            </div>
            <div>
              <DialogTitle className="font-bold text-base leading-tight text-white">
                Admin Staff Administration & Database Backup
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                Register, manage staff accounts, reset passwords & export backups
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadBackup}
              className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border-emerald-500/40 text-xs font-bold gap-1.5"
              title="Download SQLite Database Backup File"
            >
              <Download size={14} />
              <span>Export DB Backup</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div
            className={`px-6 py-3 flex items-center gap-2 text-xs font-bold shrink-0 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={16} />
            ) : (
              <ShieldAlert size={16} />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {/* Section 1: Staff Registration Form */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
              <UserPlus size={16} className="text-purple-600" />
              Register New Municipal Counter Staff
            </h3>
            <p className="text-xs text-slate-500">
              Create an operational counter profile for assessors, cashiers, or executive viewers.
            </p>

            <form
              onSubmit={handleCreateUser}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
            >
              <div>
                <label className="block font-bold text-slate-600 uppercase text-[10px] mb-1">
                  Full Legal Name *
                </label>
                <Input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  className="bg-white font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase text-[10px] mb-1">
                  Username *
                </label>
                <Input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. maria.assessor"
                  className="bg-white font-mono font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase text-[10px] mb-1">
                  Initial Password *
                </label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-white font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase text-[10px] mb-1">
                  Role Assignment *
                </label>
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as 'Assessor' | 'Admin' | 'Viewer')
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-semibold text-slate-800"
                >
                  <option value="Assessor">Assessor (RPTAR & Dues Clearance)</option>
                  <option value="Admin">Admin (Full System Administration)</option>
                  <option value="Viewer">Viewer (Read-Only Analytics)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase text-[10px] mb-1">
                  Assigned Station / Counter
                </label>
                <Input
                  type="text"
                  value={stationId}
                  onChange={(e) => setStationId(e.target.value)}
                  placeholder="e.g. Assessor-Desk-03"
                  className="bg-white font-mono text-slate-800"
                />
              </div>

              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold gap-1.5 shadow-sm"
                >
                  <UserPlus size={15} />
                  <span>{isSubmitting ? 'Registering...' : 'Register Account'}</span>
                </Button>
              </div>
            </form>
          </div>

          {/* Section 2: Password Reset Sub-Form */}
          {resetTargetUser && (
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                  <KeyRound size={15} />
                  Reset Password for: <span className="underline">{resetTargetUser.name}</span> (
                  {resetTargetUser.username})
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setResetTargetUser(null)}
                  className="text-xs text-amber-700 hover:text-amber-900 h-auto p-1"
                >
                  Cancel
                </Button>
              </div>

              <form onSubmit={handleExecutePasswordReset} className="flex gap-2 items-center">
                <Input
                  type="password"
                  required
                  placeholder="Enter new password for staff"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="bg-white font-mono flex-1 border-amber-300"
                  autoFocus
                />
                <Button
                  type="submit"
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs"
                >
                  Confirm Reset
                </Button>
              </form>
            </div>
          )}

          {/* Section 3: Registered Staff Directory */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Users size={16} className="text-slate-600" />
                Active Municipal Staff Directory ({users.length} Accounts)
              </h3>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <Table>
                <TableHeader className="bg-slate-100/75 text-[10px] uppercase font-bold">
                  <TableRow>
                    <TableHead>Staff Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Station ID</TableHead>
                    <TableHead className="text-right">Admin Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white text-xs">
                  {users.map((u) => {
                    const isSelf = currentUser && String(currentUser.id) === String(u.id);
                    const isAdminRoot = u.username === 'admin';

                    return (
                      <TableRow key={u.id} className="hover:bg-slate-50/80">
                        <TableCell className="font-bold text-slate-800 whitespace-nowrap">
                          {u.name}
                          {isSelf && (
                            <Badge variant="outline" className="ml-2 text-[10px] bg-blue-50 text-blue-800 border-blue-200">
                              You
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-slate-600 whitespace-nowrap">
                          {u.username}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge
                            variant={
                              u.role === 'Admin'
                                ? 'default'
                                : u.role === 'Assessor'
                                ? 'secondary'
                                : 'warning'
                            }
                            className="text-[10px] font-bold uppercase"
                          >
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-slate-500 whitespace-nowrap">
                          {u.stationId || 'Main-HQ'}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPasswordReset(u)}
                            className="text-[11px] font-semibold h-7 px-2.5"
                            title="Reset Staff Password"
                          >
                            Reset Password
                          </Button>

                          {!isAdminRoot && !isSelf && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteUser(u)}
                              className="text-[11px] font-semibold h-7 px-2.5 gap-1"
                              title="Delete Staff Account"
                            >
                              <Trash2 size={12} />
                              Delete
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-end shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl text-xs font-semibold"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserManagementModal;
