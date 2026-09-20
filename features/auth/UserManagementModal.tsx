import { User } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
}

export default function UserManagementModal({ isOpen, onClose, currentUser }: UserManagementModalProps) {
  return (
    <Dialog open={isOpen && currentUser?.role === 'Admin'} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Staff accounts</DialogTitle>
          <DialogDescription>
            An authorized Supabase Auth administrator manages staff accounts, passwords, and role claims
            in Authentication → Users. App roles must be assigned in trusted app metadata.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
