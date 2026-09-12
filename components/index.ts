export { default as Header } from './Header';
export * from './ui';

// Re-exports from domain feature slices for backward compatibility
export { LoginPage, UserManagementModal } from '@/features/auth';
export { DashboardTable, PropertyCard, RptarModal, BulkImportModal } from '@/features/properties';
export { DelinquencyTable } from '@/features/assessment';
export { OfficialReceiptModal } from '@/features/collections';
export { DashboardStats } from '@/features/dashboard';
export { AuditLogModal } from '@/features/audit';
