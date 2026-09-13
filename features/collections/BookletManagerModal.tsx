import React, { useState, useEffect } from 'react';
import { AccountableFormBooklet, User } from '@/types';
import { api } from '@/services/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { BookOpen, UserCheck, AlertCircle, RefreshCw } from 'lucide-react';

interface BookletManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
}

export const BookletManagerModal: React.FC<BookletManagerModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [booklets, setBooklets] = useState<AccountableFormBooklet[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBookletId, setSelectedBookletId] = useState<string | null>(null);
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [bookletsList, usersList] = await Promise.all([
        api.getBooklets(),
        api.getUsers(),
      ]);
      setBooklets(bookletsList);
      setUsers(usersList.filter((u) => u.role === 'Cashier' || u.role === 'Assessor' || u.role === 'Admin'));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setStatusMessage(null);
      setSelectedBookletId(null);
    }
  }, [isOpen]);

  const handleAssign = async (bookletId: string) => {
    if (!selectedUsername) return;
    try {
      await api.assignBooklet(bookletId, selectedUsername);
      setStatusMessage(`Booklet ${bookletId} assigned to ${selectedUsername}.`);
      setSelectedBookletId(null);
      setSelectedUsername('');
      await loadData();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Assignment failed.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success" className="text-[10px] font-mono">ACTIVE</Badge>;
      case 'EXHAUSTED':
        return <Badge variant="secondary" className="text-[10px] font-mono">EXHAUSTED</Badge>;
      case 'REVOKED':
        return <Badge variant="destructive" className="text-[10px] font-mono">REVOKED</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] font-mono">{status}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 flex flex-col overflow-hidden gap-0 border-slate-200 shadow-2xl">
        {/* Header */}
        <DialogHeader className="bg-slate-900 px-6 py-4 flex flex-row items-center justify-between text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 rounded-lg shrink-0">
              <BookOpen size={18} className="text-white" />
            </div>
            <div>
              <DialogTitle className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                Accountable Form 51 (AF-51) Booklet Register
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Official Commission on Audit (COA) Sequential Booklet Custody & Serial Tracking
              </DialogDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="text-slate-300 hover:text-white mr-6"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </DialogHeader>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {statusMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Booklets Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-bold">Booklet ID</TableHead>
                  <TableHead className="text-xs font-bold">Series Range</TableHead>
                  <TableHead className="text-xs font-bold">Current Serial</TableHead>
                  <TableHead className="text-xs font-bold">Remaining</TableHead>
                  <TableHead className="text-xs font-bold">Assigned Teller</TableHead>
                  <TableHead className="text-xs font-bold text-center">Status</TableHead>
                  {currentUser?.role === 'Admin' && <TableHead className="text-xs font-bold text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {booklets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-xs text-slate-400">
                      No booklets registered in system.
                    </TableCell>
                  </TableRow>
                ) : (
                  booklets.map((b) => {
                    const remaining = b.status === 'EXHAUSTED' ? 0 : Math.max(0, b.seriesEnd - b.currentSerial + 1);
                    return (
                      <TableRow key={b.id} className="hover:bg-slate-50/80">
                        <TableCell className="font-mono text-xs font-bold text-slate-900">
                          {b.bookletId}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">
                          {b.seriesStart} - {b.seriesEnd}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-blue-900">
                          #{b.currentSerial}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-700">
                          <span className={`font-bold ${remaining < 10 ? 'text-amber-600' : 'text-emerald-700'}`}>
                            {remaining}
                          </span>{' '}
                          / 50
                        </TableCell>
                        <TableCell className="text-xs text-slate-800">
                          {selectedBookletId === b.bookletId ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                value={selectedUsername}
                                onChange={(e) => setSelectedUsername(e.target.value)}
                                className="text-xs border border-slate-300 rounded-lg p-1 bg-white"
                              >
                                <option value="">Select Staff...</option>
                                {users.map((u) => (
                                  <option key={u.id} value={u.username}>
                                    {u.name} ({u.role})
                                  </option>
                                ))}
                              </select>
                              <Button
                                size="sm"
                                onClick={() => handleAssign(b.bookletId)}
                                disabled={!selectedUsername}
                                className="h-6 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-500"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedBookletId(null)}
                                className="h-6 px-1.5 text-[11px]"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <span className="font-medium text-slate-700">
                              {b.assignedToUsername || <span className="text-slate-400 italic">Unassigned</span>}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(b.status)}
                        </TableCell>
                        {currentUser?.role === 'Admin' && (
                          <TableCell className="text-right">
                            {selectedBookletId !== b.bookletId && b.status === 'ACTIVE' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedBookletId(b.bookletId);
                                  setSelectedUsername(b.assignedToUsername || '');
                                }}
                                className="text-[11px] h-7 px-2 gap-1 text-slate-700"
                              >
                                <UserCheck size={12} />
                                Reassign
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-end shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl text-xs font-semibold"
          >
            Close Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BookletManagerModal;
