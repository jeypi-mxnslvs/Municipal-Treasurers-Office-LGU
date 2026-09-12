import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldAlert, Lock, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';

interface PasswordConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  username: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  destructiveActionLabel?: string;
}

export const PasswordConfirmationModal: React.FC<PasswordConfirmationModalProps> = ({
  isOpen,
  title,
  description,
  username,
  onConfirm,
  onClose,
  destructiveActionLabel = 'Confirm Action',
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Password is required.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const isValid = await api.verifyPassword(username, password);
      if (!isValid) {
        await api.logSecurityEvent({
          eventType: 'ACCESS_DENIED',
          username,
          details: `Failed authorization check for: ${title}`,
        });
        setError('Incorrect password. Authorization rejected.');
        return;
      }

      await onConfirm();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authorization failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError(null);
    setIsLoading(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md p-6 bg-white rounded-2xl shadow-2xl border-slate-200">
        <DialogHeader className="space-y-2">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-1">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900">{title}</DialogTitle>
          <DialogDescription className="text-sm text-slate-500 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
              Enter Password to Authorize
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Account password"
                className="pl-9 text-sm"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Staff: <span className="font-semibold text-slate-600">{username}</span>
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isLoading || !password.trim()}
            >
              {isLoading ? 'Verifying...' : destructiveActionLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordConfirmationModal;
