import { Property } from '@/types';

/**
 * Normalizes an assessor name by trimming whitespace.
 */
export const normalizeAssessorName = (name: string): string => {
  return (name || '').trim().replace(/\s+/g, ' ');
};

/**
 * Checks whether an entry is marked as manual.
 */
export const isManualProperty = (property: Property): boolean => {
  if (property.entryType === 'MANUAL') return true;
  if (property.encoderLabel && property.encoderLabel.includes('(Manual)')) return true;
  return false;
};

/**
 * Merges and chains an assessor's name into the provenance attribution label.
 *
 * Requirements:
 * 1. CSV Import:
 *    - Single import: "Assessor 1"
 *    - Subsequent matching import: appends the 2nd assessor chronologically (e.g. "Assessor 1, Assessor 2").
 *    - Re-import by existing assessor: moves to latest position without duplicate entries.
 * 2. Manual Encoding:
 *    - When an assessor manually encodes a property, they are placed in the 1st position
 *      (e.g., "Assessor 1 (Manual), Assessor 2").
 *    - Manual encoder status always retains index 0 / 1st-place precedence.
 */
export const mergeEncoderLabel = (
  existingLabel: string | undefined | null,
  newAssessor: string,
  isManual = false
): string => {
  const cleanAssessor = normalizeAssessorName(newAssessor);
  if (!cleanAssessor) {
    return existingLabel ? existingLabel.trim() : '';
  }

  // If no previous label exists
  if (!existingLabel || !existingLabel.trim()) {
    return isManual ? `${cleanAssessor} (Manual)` : cleanAssessor;
  }

  // Parse existing names
  const tokens = existingLabel
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  if (isManual) {
    const manualTag = cleanAssessor.includes('(Manual)')
      ? cleanAssessor
      : `${cleanAssessor} (Manual)`;

    // Filter out any previous occurrences of this assessor (with or without (Manual))
    const others = tokens.filter(
      (t) =>
        t.toLowerCase() !== manualTag.toLowerCase() &&
        t.toLowerCase() !== cleanAssessor.toLowerCase() &&
        t.toLowerCase() !== `${cleanAssessor} (manual)`.toLowerCase()
    );

    // Place manual encoder in the 1st position
    return [manualTag, ...others].join(', ');
  }

  // CSV Import Chaining
  // Identify if any existing entry has a (Manual) tag
  const manualIndex = tokens.findIndex((t) => t.toLowerCase().includes('(manual)'));
  const manualToken = manualIndex >= 0 ? tokens[manualIndex] : null;

  // Filter out any prior occurrences of cleanAssessor and the manual token from non-manual list
  const nonManualTokens = tokens.filter((t, idx) => {
    if (idx === manualIndex) return false;
    const cleanToken = t.replace(/\s*\(manual\)/i, '').trim();
    return cleanToken.toLowerCase() !== cleanAssessor.toLowerCase();
  });

  // Append newAssessor as the newest importer
  nonManualTokens.push(cleanAssessor);

  // If there was a manual encoder, keep them in the 1st position
  if (manualToken) {
    return [manualToken, ...nonManualTokens].join(', ');
  }

  return nonManualTokens.join(', ');
};

/**
 * Sorts properties prioritizing manually encoded properties to the 1st (#1) position.
 *
 * Within manual properties: sorts newest-first (by updatedAt, createdAt, or id).
 * Non-manual properties follow, preserving their order.
 */
export const sortPropertiesWithManualFirst = (properties: Property[]): Property[] => {
  return [...properties].sort((a, b) => {
    const aManual = isManualProperty(a);
    const bManual = isManualProperty(b);

    // 1. Manual entries take #1 precedence over CSV imports
    if (aManual && !bManual) return -1;
    if (!aManual && bManual) return 1;

    // 2. If both are manual: sort newest first
    if (aManual && bManual) {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;

      // Fallback numeric or string ID comparison (descending for newer IDs)
      const aNum = Number(a.id);
      const bNum = Number(b.id);
      if (!isNaN(aNum) && !isNaN(bNum)) return bNum - aNum;
      return String(b.id).localeCompare(String(a.id));
    }

    // 3. For bulk CSV records: preserve stable order
    return 0;
  });
};

/**
 * Parses an attribution label into structured segments for UI rendering.
 */
export const parseEncoderChain = (
  label: string | undefined | null
): {
  primary: string;
  isManual: boolean;
  chain: string[];
  latest: string;
} => {
  if (!label || !label.trim()) {
    return { primary: 'Unspecified', isManual: false, chain: [], latest: 'Unspecified' };
  }

  const chain = label
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const primary = chain[0] || 'Unspecified';
  const isManual = primary.includes('(Manual)') || label.includes('(Manual)');
  const latest = chain[chain.length - 1] || primary;

  return { primary, isManual, chain, latest };
};
