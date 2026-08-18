import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { UserPlus, Users, X, CheckCircle2, ShieldAlert, KeyRound, Trash2, Download, Database } from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('admin123');
  const [role, setRole] = useState<'Assessor' | 'Admin' | 'Viewer'>('Assessor');
  const [stationId, setStationId] = useState('Assessor-Desk-03');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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

  if (!isOpen) return null;

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
        stationId
      });

      setStatusMessage({ type: 'success', text: `Account for ${fullName} (${role}) registered successfully!` });
      setFullName('');
      setUsername('');
      setPassword('admin123');
      await fetchUsersList();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create user account' });
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

    if (confirm(`Are you sure you want to permanently delete the staff account "${userToDelete.name}" (${userToDelete.username})?`)) {
      try {
        await api.deleteUser(userToDelete.id);
        setStatusMessage({ type: 'success', text: `Account "${userToDelete.name}" deleted successfully.` });
        await fetchUsersList();
      } catch (err) {
        setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete user' });
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
      setStatusMessage({ type: 'success', text: `Password for "${resetTargetUser.name}" has been updated.` });
      setResetTargetUser(null);
      setNewPasswordInput('');
    } catch (err) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update password' });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-purple-600 rounded-lg">
              <Users size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Admin Staff Administration & Database Backup</h2>
              <p className="text-xs text-slate-400">Register, manage staff accounts, reset passwords & export backups</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Database Backup Button */}
            <button
              onClick={handleDownloadBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 rounded-xl text-xs font-bold transition-all"
              title="Download SQLite Database Backup File"
            >
              <Download size={14} />
              <span>Export DB Backup</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div className={`px-6 py-3 flex items-center gap-2 text-xs font-bold ${
            statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Section 1: Staff Registration Form */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
              <UserPlus size={16} className="text-purple-600" />
              Register New Municipal Counter Staff
            </h3>
            <p className="text-xs text-slate-500">
              Create an operational counter profile for assessors, cashiers, or executive viewers.
            </p>

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-600 uppercase text-[10px] mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase text-[10px] mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. maria.assessor"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase text-[10px] mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase text-[10px] mb-1">Role Assignment *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-semibold text-slate-800"
                >
                  <option value="Assessor">Assessor (RPTAR & Dues Clearance)</option>
                  <option value="Admin">Admin (Full System Administration)</option>
                  <option value="Viewer">Viewer (Read-Only Analytics)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase text-[10px] mb-1">Assigned Station / Counter</label>
                <input
                  type="text"
                  value={stationId}
                  onChange={(e) => setStationId(e.target.value)}
                  placeholder="e.g. Assessor-Desk-03"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono text-slate-800"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <UserPlus size={15} />
                  <span>{isSubmitting ? 'Registering...' : 'Register Account'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Password Reset Sub-Form */}
          {resetTargetUser && (
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                  <KeyRound size={15} />
                  Reset Password for: <span className="underline">{resetTargetUser.name}</span> ({resetTargetUser.username})
                </h4>
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="text-xs text-amber-700 hover:text-amber-900 font-semibold"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleExecutePasswordReset} className="flex gap-2 items-center">
                <input
                  type="password"
                  required
                  placeholder="Enter new password for staff"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono flex-grow focus:ring-2 focus:ring-amber-500 outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs transition-all shadow-xs"
                >
                  Confirm Reset
                </button>
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
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-100/75">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase">Staff Name</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase">Username</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase">Role</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase">Station ID</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-bold text-slate-500 uppercase">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {users.map((u) => {
                    const isSelf = currentUser && String(currentUser.id) === String(u.id);
                    const isAdminRoot = u.username === 'admin';

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-800">
                          {u.name}
                          {isSelf && <span className="ml-2 px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] rounded font-semibold">You</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600">
                          {u.username}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.role === 'Admin' ? 'bg-purple-100 text-purple-800' :
                            u.role === 'Assessor' ? 'bg-blue-100 text-blue-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-500">
                          {u.stationId || 'Main-HQ'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleOpenPasswordReset(u)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors"
                            title="Reset Staff Password"
                          >
                            Reset Password
                          </button>

                          {!isAdminRoot && !isSelf && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-semibold transition-colors"
                              title="Delete Staff Account"
                            >
                              <Trash2 size={12} className="inline mr-1" />
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserManagementModal;
