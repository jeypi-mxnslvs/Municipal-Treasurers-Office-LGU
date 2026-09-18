import { Property } from '../types';
import type { FieldFailureDetail } from '@/components/common/BreakdownAlertModal';

export interface PropertyCompleteness {
  isShellRecord: boolean;
  reasons: string[];
  fieldFailures: FieldFailureDetail[];
}

/** Single parcel-completeness rule shared by verification, import, SOA, and dashboard. */
export function getPropertyCompleteness(property: Pick<Property, 'isShellRecord' | 'pin' | 'assessedValue'>): PropertyCompleteness {
  const reasons: string[] = [];
  const fieldFailures: FieldFailureDetail[] = [];

  if (property.isShellRecord) {
    reasons.push('Explicit shell-record flag is active.');
    fieldFailures.push({
      field: 'Property Assessment Status',
      currentValue: 'is_shell_record = true',
      requirement: 'Parcel must be formally surveyed, assessed, and promoted by the Municipal Assessor.',
      ruleBasis: 'SSOT §2.8 & AGENTS.md §4.3 (Shell Record Verification Prohibition)',
    });
  }

  if (!property.pin?.trim()) {
    reasons.push('Verified PIN is missing.');
    fieldFailures.push({
      field: 'Property Identification Number (PIN)',
      currentValue: '[Missing / Empty]',
      requirement: 'Must be assigned a verified Cadastral PIN (standard Santa Rosa format: 024-XX-XXX-XX-XXX).',
      ruleBasis: 'Republic Act No. 7160 Sec. 219 (Cadastral Mapping & PIN Assignment)',
    });
  }

  if (!Number.isFinite(property.assessedValue) || property.assessedValue <= 0) {
    reasons.push('Positive assessed value is missing.');
    fieldFailures.push({
      field: 'Assessed Value (₱)',
      currentValue: property.assessedValue !== undefined ? `₱${property.assessedValue.toLocaleString()}` : '[Unassigned]',
      requirement: 'Must have a positive taxable assessed valuation greater than ₱0.00.',
      ruleBasis: 'Republic Act No. 7160 Sec. 218 & Santa Rosa Schedule of Market Values (SFMV)',
    });
  }

  return { isShellRecord: reasons.length > 0, reasons, fieldFailures };
}
