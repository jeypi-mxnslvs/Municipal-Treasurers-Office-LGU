import { Property, User } from './types';

export const CURRENT_YEAR = 2026;
export const BASE_TAX_RATE = 0.02; // 2%
export const PENALTY_RATE_PER_MONTH = 0.02; // 2%
export const MAX_PENALTY_MONTHS = 36; // 72% cap

export const HISTORICAL_BASELINE_YEAR = 1971; // Statutory baseline floor (1971 / 1973 under PD 464 / RA 7160)

export interface PeriodBracketDefinition {
  label: string;
  startYear: number;
  endYear: number;
  quarterSpan?: string;
  quarters?: [number, number];
  isAdvance?: boolean;
}

/**
 * Canonical Municipal Assessment Eras & Delinquency Brackets
 * Codified from Santa Rosa Treasury Section 254 Notice of Delinquency Roll (RA 7160 Sec. 254/255)
 * Shared single source of truth across tax engine, SOA, and statutory reports.
 */
export const CANONICAL_MUNICIPAL_BRACKETS: PeriodBracketDefinition[] = [
  { label: '1971-72', startYear: 1971, endYear: 1972 },
  { label: '1973-79', startYear: 1973, endYear: 1979 },
  { label: '1980-85', startYear: 1980, endYear: 1985 },
  { label: '1986', startYear: 1986, endYear: 1986 },
  { label: '1987-1991', startYear: 1987, endYear: 1991 },
  { label: '1992-1993', startYear: 1992, endYear: 1993 },
  { label: '1994-2005', startYear: 1994, endYear: 2005 },
  { label: '2006-11', startYear: 2006, endYear: 2011 },
  // Modern Era (2012 - 2025): Annual individual rolls
  { label: '2012', startYear: 2012, endYear: 2012 },
  { label: '2013', startYear: 2013, endYear: 2013 },
  { label: '2014', startYear: 2014, endYear: 2014 },
  { label: '2015', startYear: 2015, endYear: 2015 },
  { label: '2016', startYear: 2016, endYear: 2016 },
  { label: '2017', startYear: 2017, endYear: 2017 },
  { label: '2018', startYear: 2018, endYear: 2018 },
  { label: '2019', startYear: 2019, endYear: 2019 },
  { label: '2020', startYear: 2020, endYear: 2020 },
  { label: '2021', startYear: 2021, endYear: 2021 },
  { label: '2022', startYear: 2022, endYear: 2022 },
  { label: '2023', startYear: 2023, endYear: 2023 },
  { label: '2024', startYear: 2024, endYear: 2024 },
  { label: '2025', startYear: 2025, endYear: 2025 },
];

export const MOCK_USER: User = {
  id: 'USR-2026-02',
  name: 'Juan Reyes',
  role: 'Assessor',
  stationId: 'Assessor-Desk-02'
};

export const BARANGAYS = [
  'Rizal (Poblacion)',
  'Aguinaldo',
  'Berang',
  'Burgos',
  'Cojuangco (Poblacion)',
  'Del Pilar',
  'Gomez',
  'Inspector',
  'Isla',
  'La Fuente',
  'Liwayway',
  'Lourdes',
  'Luna',
  'Mabini',
  'Malacañang',
  'Maliolio',
  'Mapalad',
  'Rajal Centro',
  'Rajal Norte',
  'Rajal Sur',
  'San Gregorio',
  'San Isidro',
  'San Joseph',
  'San Mariano',
  'San Pedro',
  'Santa Teresita',
  'Santo Rosario',
  'Sapsap',
  'Soledad',
  'Tagpos',
  'Tramo',
  'Valenzuela (Poblacion)',
  'Zamora (Poblacion)'
];

export const PROPERTY_CLASSES = [
  'Agricultural',
  'Dwell House',
  'Industrial',
  'Machinery',
  'Residential'
];

export const MOCK_PROPERTIES: Property[] = [
  {
    id: '1',
    tdNumber: 'TD-99-001-2234',
    previousTdNumber: 'TD-92-001-1100',
    ownerName: 'Juan Dela Cruz',
    address: 'Lot 4 Blk 5, Acacia St.',
    barangay: 'Acacia',
    assessedValue: 500000,
    lastPaidYear: 2023,
    propertyClass: 'Residential',
    isShellRecord: false
  },
  {
    id: '2',
    tdNumber: 'TD-99-002-5567',
    previousTdNumber: 'TD-85-004-9922',
    ownerName: 'Clara Batumbakal',
    address: 'KM 5 National Highway',
    barangay: 'San Jose',
    assessedValue: 1200000,
    lastPaidYear: 2025,
    propertyClass: 'Commercial',
    isShellRecord: false
  },
  {
    id: 'shell-1',
    tdNumber: 'TD-CSV-888',
    previousTdNumber: '',
    ownerName: 'Prospective Taxpayer Inc.',
    address: 'Block 2, Industrial Zone',
    barangay: 'Industrial Zone',
    assessedValue: 0,
    lastPaidYear: 2020,
    propertyClass: 'Industrial',
    isShellRecord: true
  },
  {
    id: '4',
    tdNumber: 'TD-99-004-9901',
    previousTdNumber: 'TD-91-001-0001',
    ownerName: 'Ricardo Dalisay',
    address: 'Poblacion Proper',
    barangay: 'Poblacion',
    assessedValue: 350000,
    lastPaidYear: 2024,
    propertyClass: 'Residential',
    isShellRecord: false
  }
];