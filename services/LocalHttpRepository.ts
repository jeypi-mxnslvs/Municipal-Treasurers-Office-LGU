import { ITreasuryRepository } from './ITreasuryRepository';
import {
  Property,
  CalculationResult,
  OfficialReceipt,
  DashboardStatsData,
  User,
  RptarAuditLog,
  SyncStatusData,
  SecurityAuditLog,
  AccountableFormBooklet,
  TaxYearRecord,
  MunicipalTaxSettings,
  CsvImportBatch
} from '@/types';
import { calculateTaxLiability } from '@/utils/taxLogic';

/**
 * LocalHttpRepository
 * 
 * On-Premise Municipal Hall REST API Driver.
 * Interacts with the in-house air-gapped PostgreSQL backend via standard HTTP REST calls,
 * allowing full treasury functionality inside the Santa Rosa Municipal Hall without cloud dependence.
 * 
 * Reference: ROADMAP_AND_PHASES.md Phase 4 & SSOT.md Section 6.2
 */
export class LocalHttpRepository implements ITreasuryRepository {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8000/api/v1') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('lgu_token') : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || errorBody.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // 1. Properties & Assessment
  async getProperties(search?: string, barangay?: string): Promise<Property[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (barangay && barangay !== 'All') params.append('barangay', barangay);
    return this.request<Property[]>(`/properties?${params.toString()}`);
  }

  async getPropertyAssessment(propertyId: string, fallbackProp?: Property, customSettings?: MunicipalTaxSettings): Promise<CalculationResult> {
    try {
      return await this.request<CalculationResult>(`/properties/${propertyId}/assessment`);
    } catch {
      // Client-side pure calculation fallback
      let property = fallbackProp;
      if (!property) {
        property = await this.request<Property>(`/properties/${propertyId}`);
      }
      return calculateTaxLiability(property, { settings: customSettings });
    }
  }

  async getPropertyCompletedRecords(propertyId: string | number, _property?: Property): Promise<TaxYearRecord[]> {
    try {
      return await this.request<TaxYearRecord[]>(`/properties/${propertyId}/completed-records`);
    } catch {
      return [];
    }
  }

  async saveProperty(propertyData: Partial<Property>): Promise<Property> {
    if (propertyData.id) {
      return this.request<Property>(`/properties/${propertyData.id}`, {
        method: 'PUT',
        body: JSON.stringify(propertyData)
      });
    }
    return this.request<Property>('/properties', {
      method: 'POST',
      body: JSON.stringify(propertyData)
    });
  }

  async deleteProperty(propertyId: string): Promise<void> {
    await this.request(`/properties/${propertyId}`, { method: 'DELETE' });
  }

  async lookupSfmv(barangay: string, propertyClass: string): Promise<{ base_rate_sqm: number; assessment_level: number }> {
    const params = new URLSearchParams({ barangay, property_class: propertyClass });
    return this.request<{ base_rate_sqm: number; assessment_level: number }>(`/sfmv?${params.toString()}`);
  }

  // 2. Collections & Receipts (COA AF-51)
  async postPayment(payload: {
    propertyId: string | number;
    paidRecords: TaxYearRecord[];
    tenderType: string;
    tenderReference?: string;
    postedBy: string;
    stationId?: string;
    userId?: number;
  }): Promise<OfficialReceipt> {
    return this.request<OfficialReceipt>('/collections/payments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async voidReceipt(payload: {
    receiptNo: string;
    reason: string;
    authorizedBy: string;
    stationId?: string;
  }): Promise<{ message: string; receiptNo: string }> {
    return this.request<{ message: string; receiptNo: string }>(`/collections/void`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // 3. Accountable Forms (AF-51 Sequential Stubs)
  async getActiveBooklet(username?: string): Promise<AccountableFormBooklet | null> {
    const params = new URLSearchParams();
    if (username) params.append('username', username);
    return this.request<AccountableFormBooklet | null>(`/accountable-forms/active?${params.toString()}`);
  }

  async getBooklets(): Promise<AccountableFormBooklet[]> {
    return this.request<AccountableFormBooklet[]>('/accountable-forms');
  }

  async assignBooklet(bookletId: string, username: string, userId?: number): Promise<void> {
    await this.request(`/accountable-forms/${bookletId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ username, userId })
    });
  }

  // 4. Reporting, Analytics & Live Multi-Assessor Sync
  async getDashboardStats(): Promise<DashboardStatsData> {
    return this.request<DashboardStatsData>('/dashboard/stats');
  }

  async getSyncStatus(): Promise<SyncStatusData> {
    return this.request<SyncStatusData>('/sync/status');
  }

  subscribeToMutations(onMutation: (mutation: { timestamp: string; author: string; action: string; tdNumber?: string }) => void): () => void {
    // Standard Server-Sent Events (SSE) / WebSocket listener on local HTTP server
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`${this.baseUrl}/sync/stream`);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMutation(data);
        } catch {
          // Ignore parse errors
        }
      };
    } catch {
      // SSE not supported in current environment
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }

  // 5. User Management & Authentication
  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/users');
  }

  async lookupUser(username: string): Promise<User | null> {
    return this.request<User | null>(`/users/lookup?username=${encodeURIComponent(username)}`);
  }

  async login(username: string, password: string, stationId?: string): Promise<{ token: string; user: User }> {
    return this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, stationId })
    });
  }

  async verifyPassword(username: string, password: string): Promise<boolean> {
    const res = await this.request<{ valid: boolean }>('/auth/verify-password', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    return res.valid;
  }

  async registerUser(userData: {
    username: string;
    password: string;
    fullName: string;
    role: string;
    stationId: string;
  }): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>('/users/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async deleteUser(id: string | number, adminUsername?: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/users/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ adminUsername })
    });
  }

  async resetUserPassword(id: string | number, newPassword: string, adminUsername?: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/users/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword, adminUsername })
    });
  }

  // 6. Audit Logs & Forensic History
  async getPropertyAudit(propertyId: string | number): Promise<RptarAuditLog[]> {
    return this.request<RptarAuditLog[]>(`/audit/properties/${propertyId}`);
  }

  async getAllAuditLogs(): Promise<RptarAuditLog[]> {
    return this.request<RptarAuditLog[]>('/audit/logs');
  }

  async logSecurityEvent(event: {
    eventType: SecurityAuditLog['event_type'];
    username: string;
    userId?: number;
    stationId?: string;
    details?: string;
  }): Promise<void> {
    await this.request('/audit/security', {
      method: 'POST',
      body: JSON.stringify(event)
    });
  }

  async getSecurityAuditLogs(): Promise<SecurityAuditLog[]> {
    return this.request<SecurityAuditLog[]>('/audit/security');
  }

  async logFieldOverrideAudit(entry: {
    propertyId?: number | string;
    tdNumber: string;
    taxYear: number;
    fieldChanged: 'BASIC_TAX' | 'SEF_TAX' | 'DISCOUNT_RATE' | string;
    originalValue: number;
    newValue: number;
    reason: string;
    assessorName: string;
    stationId?: string;
    userId?: number;
    userRole?: string;
  }): Promise<void> {
    await this.request('/audit/overrides', {
      method: 'POST',
      body: JSON.stringify(entry)
    });
  }

  // 7. Municipal Tax Settings & Ordinances
  async getMunicipalTaxSettings(): Promise<MunicipalTaxSettings> {
    return this.request<MunicipalTaxSettings>('/settings/tax');
  }

  async updateMunicipalTaxSettings(settings: Partial<MunicipalTaxSettings>, updatedBy?: string): Promise<MunicipalTaxSettings> {
    return this.request<MunicipalTaxSettings>('/settings/tax', {
      method: 'PUT',
      body: JSON.stringify({ settings, updatedBy })
    });
  }

  // 8. Assessor Import Center & Smart Upsert
  async getImportBatches(barangay?: string): Promise<CsvImportBatch[]> {
    const params = new URLSearchParams();
    if (barangay && barangay !== 'All') params.append('barangay', barangay);
    return this.request<CsvImportBatch[]>(`/imports/batches?${params.toString()}`);
  }

  async bulkImportProperties(
    properties: Array<Partial<Property> & Record<string, unknown>>,
    assessorName?: string,
    stationId?: string,
    batchMetadata?: { filename?: string; barangay?: string }
  ): Promise<{
    message: string;
    insertedCount: number;
    updatedCount: number;
    unchangedCount: number;
    batchId?: number;
    errors: unknown[];
  }> {
    return this.request('/imports/bulk', {
      method: 'POST',
      body: JSON.stringify({ properties, assessorName, stationId, batchMetadata })
    });
  }

  // 9. Utilities
  getBackupDownloadUrl(): string {
    return `${this.baseUrl}/admin/backup`;
  }
}
