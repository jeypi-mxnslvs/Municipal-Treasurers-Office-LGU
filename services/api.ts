import { Property, CalculationResult, OfficialReceipt, DashboardStatsData, User, RptarAuditLog, SyncStatusData } from '../types';
import { MOCK_PROPERTIES, MOCK_USER } from '../constants';
import { calculateTaxLiability as localCalculateTaxLiability } from '../utils/taxLogic';

const API_BASE_URL = 'http://localhost:5000/api';

// Helper for fetch with fallback
async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('lgu_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
  }
  return response.json();
}

export const api = {
  // Properties
  async getProperties(search?: string, barangay?: string): Promise<Property[]> {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (barangay && barangay !== 'All') params.append('barangay', barangay);

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      return await fetchJson<Property[]>(`${API_BASE_URL}/properties${queryStr}`);
    } catch (err) {
      console.warn('API unavailable, using local mock data:', err);
      let filtered = [...MOCK_PROPERTIES];
      if (barangay && barangay !== 'All') {
        filtered = filtered.filter(p => p.barangay === barangay);
      }
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(p =>
          p.ownerName.toLowerCase().includes(s) ||
          p.tdNumber.toLowerCase().includes(s)
        );
      }
      return filtered;
    }
  },

  async getPropertyAssessment(propertyId: string, fallbackProp?: Property): Promise<CalculationResult> {
    try {
      const data = await fetchJson<any>(`${API_BASE_URL}/properties/${propertyId}/assessment`);
      return {
        propertyId: data.propertyId,
        currentTd: data.currentTd,
        ownerName: data.ownerName,
        assessedValue: data.assessedValue,
        records: data.records || [],
        summary: data.summary,
        grandTotal: data.summary?.grandTotal ?? 0
      };
    } catch (err) {
      console.warn('API unavailable, using local calculation:', err);
      if (fallbackProp) {
        return localCalculateTaxLiability(fallbackProp);
      }
      return { records: [], grandTotal: 0 };
    }
  },

  async saveProperty(propertyData: Partial<Property>): Promise<Property> {
    try {
      if (propertyData.id) {
        return await fetchJson<Property>(`${API_BASE_URL}/properties/${propertyData.id}`, {
          method: 'PUT',
          body: JSON.stringify(propertyData)
        });
      } else {
        return await fetchJson<Property>(`${API_BASE_URL}/properties`, {
          method: 'POST',
          body: JSON.stringify(propertyData)
        });
      }
    } catch (err) {
      console.warn('API error, saving locally:', err);
      return propertyData as Property;
    }
  },

  async deleteProperty(propertyId: string): Promise<void> {
    try {
      await fetchJson(`${API_BASE_URL}/properties/${propertyId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('API error deleting property:', err);
    }
  },

  // Payments & Receipts
  async postPayment(payload: {
    propertyId: string | number;
    paidRecords: any[];
    tenderType: string;
    tenderReference?: string;
    postedBy: string;
  }): Promise<OfficialReceipt> {
    try {
      return await fetchJson<OfficialReceipt>(`${API_BASE_URL}/payments`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('API error, generating local receipt:', err);
      const totalPaid = payload.paidRecords.reduce((sum, r) => sum + (r.totalDue || 0), 0);
      return {
        receiptNo: `AF51-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        date: new Date().toISOString(),
        property: {
          id: payload.propertyId,
          tdNumber: 'TD-PROT-001',
          ownerName: 'Taxpayer',
          address: 'Local LGU',
          barangay: 'Poblacion',
          assessedValue: 100000,
          propertyClass: 'Residential'
        },
        itemizedRecords: payload.paidRecords,
        summary: {
          basicTax: totalPaid * 0.5,
          sefTax: totalPaid * 0.5,
          baseTaxTotal: totalPaid,
          penalty: 0,
          discount: 0,
          totalPaid
        },
        tenderType: (payload.tenderType as any) || 'CASH',
        tenderReference: payload.tenderReference,
        postedBy: payload.postedBy
      };
    }
  },

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStatsData> {
    try {
      return await fetchJson<DashboardStatsData>(`${API_BASE_URL}/dashboard/stats`);
    } catch (err) {
      console.warn('API error fetching stats, using mock:', err);
      return {
        totalProperties: 5,
        clearedCount: 1,
        delinquentCount: 3,
        partialCount: 1,
        shellRecordsCount: 1,
        totalCollected: 0,
        todayCollected: 0,
        totalDelinquentDebt: 340329,
        collectionEfficiency: 20,
        monthlyTrend: [
          { month: 'Jan', collections: 125000, target: 150000 },
          { month: 'Feb', collections: 98000, target: 120000 },
          { month: 'Mar', collections: 240000, target: 200000 },
          { month: 'Apr', collections: 85000, target: 100000 },
          { month: 'May', collections: 67000, target: 90000 },
          { month: 'Jun', collections: 180000, target: 160000 },
          { month: 'Jul', collections: 72000, target: 80000 },
          { month: 'Aug', collections: 65000, target: 80000 }
        ],
        barangayBreakdown: [
          { barangay: 'Acacia', properties: 1, outstandingDebt: 7550 },
          { barangay: 'San Jose', properties: 1, outstandingDebt: 17730 },
          { barangay: 'Industrial Zone', properties: 1, outstandingDebt: 311850 },
          { barangay: 'Poblacion', properties: 1, outstandingDebt: 3199 },
          { barangay: 'Bukid', properties: 1, outstandingDebt: 0 }
        ]
      };
    }
  },

  // SFMV
  async lookupSfmv(barangay: string, propertyClass: string): Promise<{ base_rate_sqm: number; assessment_level: number }> {
    try {
      return await fetchJson<{ base_rate_sqm: number; assessment_level: number }>(
        `${API_BASE_URL}/sfmv/lookup?barangay=${encodeURIComponent(barangay)}&propertyClass=${encodeURIComponent(propertyClass)}`
      );
    } catch {
      return { base_rate_sqm: 2000, assessment_level: 0.20 };
    }
  },

  // Users & Auth
  async getUsers(): Promise<User[]> {
    try {
      return await fetchJson<User[]>(`${API_BASE_URL}/auth/users`);
    } catch {
      return [MOCK_USER];
    }
  },

  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    try {
      return await fetchJson<{ token: string; user: User }>(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
    } catch (err) {
      console.warn('Backend server unreachable, logging in via offline demo mode: ', err);

      if (password !== 'admin123') {
        throw new Error('Invalid password. (Use "admin123" for demo accounts)');
      }

      const u = username.toLowerCase();
      if (u === 'admin') {
        return {
          token: 'demo-token-admin',
          user: { id: 'admin', name: 'System Administrator', username: 'admin', role: 'Admin', stationId: 'Main-HQ' }
        };
      } else if (u === 'mayor.office') {
        return {
          token: 'demo-token-viewew',
          user: { id: 'mayor.office', name: 'Hon. Mayor Office', username: 'mayor.office', role: 'Viewer', stationId: 'Executive-Desk' }
        };
      } else {
        return {
          token: 'demo-token-viewer',
          user: { id: 'juan.assessor', name: 'Juan Reyes', username: 'juan.assessor', role: 'Assessor', stationId: 'AD-02' }
        };
      }
    }
  },
  async registerUser(userData: {
    username: string;
    password: string;
    fullName: string;
    role: string;
    stationId: string;
  }): Promise<{ message: string; user: User }> {
    return await fetchJson<{ message: string; user: User }>(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  async lookupUser(username: string): Promise<User | null> {
    try {
      return await fetchJson<User>(`${API_BASE_URL}/auth/lookup/${encodeURIComponent(username)}`);
    } catch {
      return null;
    }
  },

  async deleteUser(id: string | number): Promise<{ message: string }> {
    return await fetchJson<{ message: string }>(`${API_BASE_URL}/auth/users/${id}`, {
      method: 'DELETE'
    });
  },

  async resetUserPassword(id: string | number, newPassword: string): Promise<{ message: string }> {
    return await fetchJson<{ message: string }>(`${API_BASE_URL}/auth/users/${id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword })
    });
  },

  // Admin Backup
  getBackupDownloadUrl(): string {
    return `${API_BASE_URL}/admin/backup`;
  },

  // Audit Logs (Attribution & Traceability)
  async getPropertyAudit(propertyId: string | number): Promise<RptarAuditLog[]> {
    try {
      return await fetchJson<RptarAuditLog[]>(`${API_BASE_URL}/properties/${propertyId}/audit`);
    } catch {
      return [];
    }
  },

  async getAllAuditLogs(): Promise<RptarAuditLog[]> {
    try {
      return await fetchJson<RptarAuditLog[]>(`${API_BASE_URL}/properties/audit/all`);
    } catch {
      return [];
    }
  },

  // Live Multi-Assessor Sync
  async getSyncStatus(): Promise<SyncStatusData> {
    try {
      return await fetchJson<SyncStatusData>(`${API_BASE_URL}/sync/status`);
    } catch {
      return {
        latestMutation: null,
        serverTime: new Date().toISOString()
      };
    }
  },

  // Bulk CSV / Excel Import
  async bulkImportProperties(properties: any[], assessorName = 'Juan Reyes', stationId = 'Assessor-Desk-02'): Promise<{ message: string; insertedCount: number; skippedCount: number; errors: any[] }> {
    return await fetchJson<{ message: string; insertedCount: number; skippedCount: number; errors: any[] }>(`${API_BASE_URL}/properties/bulk-import`, {
      method: 'POST',
      body: JSON.stringify({ properties, assessorName, stationId })
    });
  }
};
