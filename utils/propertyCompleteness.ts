import { Property } from '../types';

export interface PropertyCompleteness {
  isShellRecord: boolean;
  reasons: string[];
}

/** Single parcel-completeness rule shared by verification, import, SOA, and dashboard. */
export function getPropertyCompleteness(property: Pick<Property, 'isShellRecord' | 'pin' | 'assessedValue'>): PropertyCompleteness {
  const reasons: string[] = [];

  if (property.isShellRecord) reasons.push('Explicit shell-record flag is active.');
  if (!property.pin?.trim()) reasons.push('Verified PIN is missing.');
  if (!Number.isFinite(property.assessedValue) || property.assessedValue <= 0) {
    reasons.push('Positive assessed value is missing.');
  }

  return { isShellRecord: reasons.length > 0, reasons };
}
