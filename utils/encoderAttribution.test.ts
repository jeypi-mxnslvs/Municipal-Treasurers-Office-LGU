import { describe, it, expect } from 'vitest';
import {
  mergeEncoderLabel,
  sortPropertiesWithManualFirst,
  parseEncoderChain,
  isManualProperty,
} from './encoderAttribution';
import { Property } from '@/types';

describe('Assessor Provenance Attribution & Manual Priority Engine', () => {
  describe('mergeEncoderLabel', () => {
    it('creates initial attribution label for single assessor CSV import', () => {
      const label = mergeEncoderLabel('', 'Juan Reyes', false);
      expect(label).toBe('Juan Reyes');
    });

    it('appends second assessor when matching property data is imported from a new CSV', () => {
      const label1 = mergeEncoderLabel('', 'Assessor 1', false);
      expect(label1).toBe('Assessor 1');

      const label2 = mergeEncoderLabel(label1, 'Assessor 2', false);
      expect(label2).toBe('Assessor 1, Assessor 2');
    });

    it('chains third assessor chronologically as newest importer', () => {
      const label = mergeEncoderLabel('Assessor 1, Assessor 2', 'Assessor 3', false);
      expect(label).toBe('Assessor 1, Assessor 2, Assessor 3');
    });

    it('deduplicates re-imports by existing assessor, positioning them as latest active', () => {
      const initial = 'Assessor 1, Assessor 2';
      // Assessor 1 imports again
      const updated = mergeEncoderLabel(initial, 'Assessor 1', false);
      expect(updated).toBe('Assessor 2, Assessor 1');
    });

    it('does not duplicate consecutive identical assessor names', () => {
      const initial = 'Assessor 1, Assessor 2';
      const updated = mergeEncoderLabel(initial, 'Assessor 2', false);
      expect(updated).toBe('Assessor 1, Assessor 2');
    });

    it('places manual encoder in the 1st position with (Manual) tag for new properties', () => {
      const label = mergeEncoderLabel('', 'Juan Reyes', true);
      expect(label).toBe('Juan Reyes (Manual)');
    });

    it('places manual encoder in the 1st position even if property previously had CSV importers', () => {
      const existingCsvLabel = 'Assessor 1, Assessor 2';
      const label = mergeEncoderLabel(existingCsvLabel, 'Assessor 3', true);
      expect(label).toBe('Assessor 3 (Manual), Assessor 1, Assessor 2');
    });

    it('preserves manual encoder in 1st position when subsequent CSV imports match the parcel', () => {
      const manualLabel = 'Juan Reyes (Manual), Assessor 1';
      const updated = mergeEncoderLabel(manualLabel, 'Assessor 2', false);
      expect(updated).toBe('Juan Reyes (Manual), Assessor 1, Assessor 2');
    });

    it('promotes existing CSV assessor to 1st position if they subsequently manually edit the record', () => {
      const initial = 'Assessor 1, Assessor 2';
      const updated = mergeEncoderLabel(initial, 'Assessor 2', true);
      expect(updated).toBe('Assessor 2 (Manual), Assessor 1');
    });

    it('handles empty or whitespace assessor names gracefully', () => {
      expect(mergeEncoderLabel('Assessor 1', '   ', false)).toBe('Assessor 1');
      expect(mergeEncoderLabel('', '   ', false)).toBe('');
    });
  });

  describe('sortPropertiesWithManualFirst', () => {
    const createProp = (
      id: string,
      td: string,
      entryType?: 'MANUAL' | 'CSV_IMPORT',
      encoderLabel?: string,
      updatedAt?: string
    ): Property => ({
      id,
      tdNumber: td,
      previousTdNumber: '',
      ownerName: `Owner ${td}`,
      address: 'Santa Rosa',
      barangay: 'Poblacion',
      propertyClass: 'Residential',
      assessedValue: 50000,
      lastPaidYear: 2024,
      isShellRecord: false,
      entryType,
      encoderLabel,
      updatedAt,
    });

    it('places manually encoded properties at the 1st position ahead of bulk CSV rows', () => {
      const pCsv1 = createProp('1', 'TD-CSV-001', 'CSV_IMPORT', 'Assessor 1');
      const pCsv2 = createProp('2', 'TD-CSV-002', 'CSV_IMPORT', 'Assessor 2');
      const pManual = createProp('3', 'TD-MANUAL-001', 'MANUAL', 'Assessor 3 (Manual)');
      const pCsv3 = createProp('4', 'TD-CSV-003', 'CSV_IMPORT', 'Assessor 1');

      const sorted = sortPropertiesWithManualFirst([pCsv1, pCsv2, pManual, pCsv3]);

      // Manual entry must be strictly at index 0 (#1)
      expect(sorted[0].tdNumber).toBe('TD-MANUAL-001');
      expect(sorted[0].id).toBe('3');
      expect(sorted.slice(1).map((p) => p.tdNumber)).toEqual([
        'TD-CSV-001',
        'TD-CSV-002',
        'TD-CSV-003',
      ]);
    });

    it('sorts multiple manual properties newest-first at the top', () => {
      const pCsv = createProp('10', 'TD-CSV-010', 'CSV_IMPORT');
      const pManualOld = createProp(
        '1',
        'TD-MAN-OLD',
        'MANUAL',
        'Assessor 1 (Manual)',
        '2026-01-01T10:00:00Z'
      );
      const pManualNew = createProp(
        '2',
        'TD-MAN-NEW',
        'MANUAL',
        'Assessor 2 (Manual)',
        '2026-03-01T12:00:00Z'
      );

      const sorted = sortPropertiesWithManualFirst([pCsv, pManualOld, pManualNew]);

      expect(sorted[0].tdNumber).toBe('TD-MAN-NEW');
      expect(sorted[1].tdNumber).toBe('TD-MAN-OLD');
      expect(sorted[2].tdNumber).toBe('TD-CSV-010');
    });

    it('detects manual status from encoderLabel containing (Manual) even if entryType is missing', () => {
      const pCsv = createProp('1', 'TD-CSV', undefined, 'Assessor 1');
      const pManual = createProp('2', 'TD-MAN', undefined, 'Assessor 2 (Manual)');

      expect(isManualProperty(pManual)).toBe(true);
      expect(isManualProperty(pCsv)).toBe(false);

      const sorted = sortPropertiesWithManualFirst([pCsv, pManual]);
      expect(sorted[0].tdNumber).toBe('TD-MAN');
    });
  });

  describe('parseEncoderChain', () => {
    it('correctly parses multi-assessor chain details', () => {
      const parsed = parseEncoderChain('Assessor 1 (Manual), Assessor 2, Assessor 3');
      expect(parsed.primary).toBe('Assessor 1 (Manual)');
      expect(parsed.isManual).toBe(true);
      expect(parsed.latest).toBe('Assessor 3');
      expect(parsed.chain).toEqual(['Assessor 1 (Manual)', 'Assessor 2', 'Assessor 3']);
    });

    it('handles empty or undefined labels', () => {
      const parsed = parseEncoderChain(undefined);
      expect(parsed.primary).toBe('Unspecified');
      expect(parsed.isManual).toBe(false);
      expect(parsed.chain).toEqual([]);
    });
  });
});
