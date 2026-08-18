import { Property, User } from './types';

export const CURRENT_YEAR = 2026;
export const BASE_TAX_RATE = 0.02; // 2%
export const PENALTY_RATE_PER_MONTH = 0.02; // 2%
export const MAX_PENALTY_MONTHS = 36; // 72% cap

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