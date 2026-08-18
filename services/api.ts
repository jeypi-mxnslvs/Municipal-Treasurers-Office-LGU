import { supabase } from './supabase';
import { Property, CalculationResult, OfficialReceipt, DashboardStatsData, User, RptarAuditLog, SyncStatusData } from '../types';
import { calculateTaxLiability as localCalculateTaxLiability } from '../utils/taxLogic';

export const api = {
  // 1. Properties
  async getProperties(search?: string, barangay?: string): Promise<Property[]> {
    let query = supabase.from('properties').select('*');

    if (barangay && barangay !== 'All') {
      query = query.eq('barangay', barangay);
    }
    if (search) {
      query = query.or(`owner_name.ilike.%${search}%,td_number.ilike.%${search}%,previous_td_number.ilike.%${search}%`);
    }

    const { data, error } = await query.order('id', { ascending: true });
    if (error) throw error;

    return (data || []).map(row => ({
      id: String(row.id),
      tdNumber: row.td_number,
      previousTdNumber: row.previous_td_number || '',
      pin: row.pin,
      ownerName: row.owner_name,
      address: row.address,
      barangay: row.barangay,
      propertyClass: row.property_class,
      lotAreaSqm: Number(row.lot_area_sqm) || 0,
      marketValue: Number(row.market_value) || 0,
      assessedValue: Number(row.assessed_value) || 0,
      lastPaidYear: Number(row.last_paid_year) || 2025,
      isShellRecord: Boolean(row.is_shell_record)
    }));
  },

  async getPropertyAssessment(propertyId: string, fallbackProp?: Property): Promise<CalculationResult> {
    if (fallbackProp) {
      return localCalculateTaxLiability(fallbackProp);
    }
    const { data } = await supabase.from('properties').select('*').eq('id', propertyId).single();
    if (data) {
      const prop: Property = {
        id: String(data.id),
        tdNumber: data.td_number,
        previousTdNumber: data.previous_td_number,
        ownerName: data.owner_name,
        address: data.address,
        barangay: data.barangay,
        assessedValue: Number(data.assessed_value),
        lastPaidYear: Number(data.last_paid_year),
        propertyClass: data.property_class,
        isShellRecord: Boolean(data.is_shell_record)
      };
      return localCalculateTaxLiability(prop);
    }
    return { records: [], grandTotal: 0 };
  },

  async saveProperty(propertyData: Partial<Property>): Promise<Property> {
    const row = {
      td_number: propertyData.tdNumber,
      previous_td_number: propertyData.previousTdNumber,
      pin: propertyData.pin,
      owner_name: propertyData.ownerName,
      address: propertyData.address,
      barangay: propertyData.barangay,
      property_class: propertyData.propertyClass,
      assessed_value: propertyData.assessedValue,
      last_paid_year: propertyData.lastPaidYear,
      is_shell_record: propertyData.isShellRecord,
      updated_at: new Date().toISOString()
    };

    let resultData;
    if (propertyData.id && !String(propertyData.id).startsWith('csv-') && !String(propertyData.id).startsWith('prop-')) {
      const { data, error } = await supabase
        .from('properties')
        .update(row)
        .eq('id', propertyData.id)
        .select()
        .single();
      if (error) throw error;
      resultData = data;
    } else {
      const { data, error } = await supabase
        .from('properties')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      resultData = data;
    }

    // Log audit
    await supabase.from('rptar_audit_logs').insert({
      property_id: resultData.id,
      td_number: resultData.td_number,
      action_type: propertyData.id ? 'UPDATED' : 'CREATED',
      assessor_name: 'Juan Reyes',
      station_id: 'Assessor-Desk-02',
      details: `Saved property ${resultData.td_number} (${resultData.owner_name})`
    });

    return {
      id: String(resultData.id),
      tdNumber: resultData.td_number,
      previousTdNumber: resultData.previous_td_number,
      ownerName: resultData.owner_name,
      address: resultData.address,
      barangay: resultData.barangay,
      propertyClass: resultData.property_class,
      assessedValue: Number(resultData.assessed_value),
      lastPaidYear: Number(resultData.last_paid_year),
      isShellRecord: Boolean(resultData.is_shell_record)
    };
  },

  async deleteProperty(propertyId: string): Promise<void> {
    const { data: target } = await supabase.from('properties').select('*').eq('id', propertyId).single();
    await supabase.from('properties').delete().eq('id', propertyId);

    if (target) {
      await supabase.from('rptar_audit_logs').insert({
        td_number: target.td_number,
        action_type: 'DELETED',
        assessor_name: 'Juan Reyes',
        station_id: 'Assessor-Desk-02',
        details: `Deleted property record ${target.td_number}`
      });
    }
  },

  // 2. Payments & Receipts
  async postPayment(payload: {
    propertyId: string | number;
    paidRecords: any[];
    tenderType: string;
    tenderReference?: string;
    postedBy: string;
  }): Promise<OfficialReceipt> {
    const totalPaid = payload.paidRecords.reduce((sum, r) => sum + (r.totalDue || 0), 0);
    const receiptNo = `AF51-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Advance last paid year in properties
    if (payload.paidRecords.length > 0) {
      const highestYear = Math.max(...payload.paidRecords.map(r => r.year || 0));
      await supabase
        .from('properties')
        .update({ last_paid_year: highestYear, updated_at: new Date().toISOString() })
        .eq('id', payload.propertyId);
    }

    // 2. Save payment record
    await supabase.from('payment_postings').insert({
      receipt_no: receiptNo,
      property_id: payload.propertyId,
      paid_records: payload.paidRecords,
      total_paid: totalPaid,
      tender_type: payload.tenderType,
      tender_reference: payload.tenderReference,
      posted_by: payload.postedBy
    });

    const { data: prop } = await supabase.from('properties').select('*').eq('id', payload.propertyId).single();

    // 3. Log audit
    await supabase.from('rptar_audit_logs').insert({
      property_id: typeof payload.propertyId === 'number' ? payload.propertyId : undefined,
      td_number: prop?.td_number || 'N/A',
      action_type: 'CLEARED',
      assessor_name: payload.postedBy,
      station_id: 'Assessor-Desk-02',
      details: `Issued Official Receipt ${receiptNo} for PHP ${totalPaid.toLocaleString()}`
    });

    return {
      receiptNo,
      date: new Date().toISOString(),
      property: {
        id: prop ? String(prop.id) : String(payload.propertyId),
        tdNumber: prop?.td_number || 'TD-PROT-001',
        ownerName: prop?.owner_name || 'Taxpayer',
        address: prop?.address || 'Local LGU',
        barangay: prop?.barangay || 'Poblacion',
        assessedValue: Number(prop?.assessed_value) || 100000,
        propertyClass: prop?.property_class || 'Residential'
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
  },

  // 3. Dashboard Statistics
  async getDashboardStats(): Promise<DashboardStatsData> {
    const { data: props } = await supabase.from('properties').select('*');
    const list = props || [];

    const totalProperties = list.length;
    const shellRecordsCount = list.filter(p => p.is_shell_record).length;
    const clearedCount = list.filter(p => !p.is_shell_record && (p.last_paid_year || 0) >= 2026).length;
    const delinquentCount = list.filter(p => !p.is_shell_record && (p.last_paid_year || 0) < 2026).length;

    return {
      totalProperties,
      clearedCount,
      delinquentCount,
      partialCount: 0,
      shellRecordsCount,
      totalCollected: 125000,
      todayCollected: 18500,
      totalDelinquentDebt: 340329,
      collectionEfficiency: totalProperties > 0 ? Math.round((clearedCount / totalProperties) * 100) : 0,
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
        { barangay: 'Acacia', properties: list.filter(p => p.barangay === 'Acacia').length, outstandingDebt: 7550 },
        { barangay: 'San Jose', properties: list.filter(p => p.barangay === 'San Jose').length, outstandingDebt: 17730 },
        { barangay: 'Industrial Zone', properties: list.filter(p => p.barangay === 'Industrial Zone').length, outstandingDebt: 311850 },
        { barangay: 'Poblacion', properties: list.filter(p => p.barangay?.includes('Poblacion')).length, outstandingDebt: 3199 }
      ]
    };
  },

  // 4. SFMV Lookup
  async lookupSfmv(barangay: string, propertyClass: string): Promise<{ base_rate_sqm: number; assessment_level: number }> {
    const { data } = await supabase
      .from('schedule_of_market_values')
      .select('*')
      .eq('barangay', barangay)
      .eq('property_class', propertyClass)
      .single();

    if (data) {
      return { base_rate_sqm: Number(data.base_rate_sqm), assessment_level: Number(data.assessment_level) };
    }
    return { base_rate_sqm: 2000, assessment_level: 0.20 };
  },

  // 5. User Management & Auth
  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase.from('users').select('id, full_name, username, role, station_id');
    if (error) throw error;
    return (data || []).map(u => ({
      id: String(u.id),
      name: u.full_name,
      username: u.username,
      role: u.role,
      stationId: u.station_id
    }));
  },

  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.trim().toLowerCase())
      .single();

    if (error || !user || user.password !== password) {
      throw new Error('Invalid credentials. (Default password is "admin123")');
    }

    return {
      token: `supabase-token-${user.id}`,
      user: {
        id: String(user.id),
        name: user.full_name,
        username: user.username,
        role: user.role,
        stationId: user.station_id
      }
    };
  },

  async registerUser(userData: {
    username: string;
    password: string;
    fullName: string;
    role: string;
    stationId: string;
  }): Promise<{ message: string; user: User }> {
    const { data, error } = await supabase
      .from('users')
      .insert({
        username: userData.username.trim().toLowerCase(),
        password: userData.password,
        full_name: userData.fullName,
        role: userData.role,
        station_id: userData.stationId
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      message: 'User registered successfully',
      user: {
        id: String(data.id),
        name: data.full_name,
        username: data.username,
        role: data.role,
        stationId: data.station_id
      }
    };
  },

  async lookupUser(username: string): Promise<User | null> {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, username, role, station_id')
      .eq('username', username.trim().toLowerCase())
      .single();

    if (!data) return null;
    return {
      id: String(data.id),
      name: data.full_name,
      username: data.username,
      role: data.role,
      stationId: data.station_id
    };
  },

  async deleteUser(id: string | number): Promise<{ message: string }> {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    return { message: 'User deleted successfully' };
  },

  async resetUserPassword(id: string | number, newPassword: string): Promise<{ message: string }> {
    const { error } = await supabase.from('users').update({ password: newPassword }).eq('id', id);
    if (error) throw error;
    return { message: 'Password reset successfully' };
  },

  // 6. Audit Logs
  async getPropertyAudit(propertyId: string | number): Promise<RptarAuditLog[]> {
    const { data } = await supabase
      .from('rptar_audit_logs')
      .select('*')
      .eq('property_id', propertyId)
      .order('timestamp', { ascending: false });

    return data || [];
  },

  async getAllAuditLogs(): Promise<RptarAuditLog[]> {
    const { data } = await supabase
      .from('rptar_audit_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    return data || [];
  },

  // 7. Live Multi-Assessor Sync (Query latest audit timestamp)
  async getSyncStatus(): Promise<SyncStatusData> {
    const { data } = await supabase
      .from('rptar_audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    return {
      latestMutation: data ? {
        timestamp: data.timestamp,
        author: data.assessor_name,
        action: data.action_type,
        tdNumber: data.td_number
      } : null,
      serverTime: new Date().toISOString()
    };
  },

  // 8. Bulk CSV / Excel Import
  async bulkImportProperties(properties: any[], assessorName = 'Juan Reyes', stationId = 'Assessor-Desk-02'): Promise<{ message: string; insertedCount: number; skippedCount: number; errors: any[] }> {
    const rows = properties
      .filter(p => p.tdNumber)
      .map(p => ({
        td_number: p.tdNumber,
        previous_td_number: p.previousTdNumber || '',
        owner_name: p.ownerName || 'Unnamed Taxpayer',
        address: p.address || '',
        barangay: p.barangay || 'Poblacion',
        assessed_value: Number(p.assessedValue) || 0,
        last_paid_year: Number(p.lastPaidYear) || 2020,
        property_class: p.propertyClass || 'Residential',
        is_shell_record: Boolean(p.isShellRecord)
      }));

    const { data, error } = await supabase.from('properties').insert(rows).select();
    if (error) throw error;

    await supabase.from('rptar_audit_logs').insert({
      td_number: 'BULK-IMPORT',
      action_type: 'CREATED',
      assessor_name: assessorName,
      station_id: stationId,
      details: `Bulk imported ${rows.length} properties via CSV`
    });

    return { message: 'Import successful', insertedCount: rows.length, skippedCount: 0, errors: [] };
  },

  getBackupDownloadUrl(): string {
    return '#';
  }
};
