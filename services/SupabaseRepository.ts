import { supabase } from './supabase';
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
import { calculateTaxLiability as localCalculateTaxLiability } from '@/utils/taxLogic';
import { createSessionToken } from '@/lib/crypto';

/**
 * SupabaseRepository
 *
 * Implements ITreasuryRepository using Supabase PostgREST and PostgreSQL RPCs.
 * All direct queries to Supabase tables and stored procedures are quarantined here.
 */
export class SupabaseRepository implements ITreasuryRepository {
  // 1. Properties & Assessment
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
  }

  async getPropertyAssessment(propertyId: string, fallbackProp?: Property, customSettings?: MunicipalTaxSettings): Promise<CalculationResult> {
    const settings = customSettings || await this.getMunicipalTaxSettings();
    const completed = await this.getPropertyCompletedRecords(propertyId, fallbackProp);
    const completedPeriodLabels = completed.map(r => r.periodLabel).filter(Boolean) as string[];

    const calcOptions = {
      paymentDate: new Date(),
      settings,
      completedPeriodLabels,
      splitCurrentYearQuarters: true,
      split2024Quarters: true,
    };

    if (fallbackProp) {
      return localCalculateTaxLiability(fallbackProp, calcOptions);
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
      return localCalculateTaxLiability(prop, calcOptions);
    }
    return { records: [], grandTotal: 0 };
  }

  async getPropertyCompletedRecords(propertyId: string | number, property?: Property): Promise<TaxYearRecord[]> {
    const completedRecordsMap = new Map<string, TaxYearRecord>();

    // 1. Fetch digital payment postings
    try {
      const { data: postings } = await supabase
        .from('payment_postings')
        .select('*')
        .eq('property_id', propertyId)
        .eq('status', 'ISSUED')
        .order('posted_at', { ascending: false });

      if (postings && postings.length > 0) {
        for (const post of postings) {
          const paidRecords = (post.paid_records || []) as TaxYearRecord[];
          for (const r of paidRecords) {
            const key = r.periodLabel || String(r.year);
            if (!completedRecordsMap.has(key)) {
              completedRecordsMap.set(key, {
                ...r,
                status: 'Cleared',
                receiptNo: post.receipt_no,
                clearedAt: post.posted_at,
                clearedBy: post.posted_by,
                clearanceReference: `Official Receipt ${post.receipt_no}`,
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch payment postings for completed records:', e);
    }

    // 2. Fetch manual / offline delinquency completions
    try {
      const { data: completions } = await supabase
        .from('delinquency_year_completions')
        .select('*')
        .eq('property_id', propertyId)
        .eq('status', 'COMPLETED')
        .order('tax_year', { ascending: false });

      if (completions && completions.length > 0) {
        for (const comp of completions) {
          const compKey = comp.reference?.includes('Q') ? comp.reference : String(comp.tax_year);
          if (!completedRecordsMap.has(compKey)) {
            const baseTax = property ? Math.round(property.assessedValue * 0.02 * 100) / 100 : 0;
            completedRecordsMap.set(compKey, {
              year: comp.tax_year,
              periodLabel: comp.reference?.includes('Q') ? comp.reference : undefined,
              status: 'Cleared',
              baseTax,
              basicTax: baseTax / 2,
              sefTax: baseTax / 2,
              monthsDelayed: 0,
              penaltyRate: 0,
              penaltyAmount: 0,
              discountRate: 0,
              discountAmount: 0,
              totalDue: baseTax,
              clearedAt: comp.completed_at || comp.created_at,
              clearedBy: comp.completed_by,
              clearanceReference: comp.reference || 'Sequential Arrears Clearance',
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch delinquency completions:', e);
    }

    // 3. Fallback: if no records were found but property.lastPaidYear indicates settled history
    if (completedRecordsMap.size === 0 && property && property.lastPaidYear >= 1970) {
      const minYear = Math.max(property.lastPaidYear - 4, 1971);
      const baseTax = Math.round(property.assessedValue * 0.02 * 100) / 100;
      for (let y = minYear; y <= property.lastPaidYear; y++) {
        completedRecordsMap.set(String(y), {
          year: y,
          status: 'Cleared',
          baseTax,
          basicTax: baseTax / 2,
          sefTax: baseTax / 2,
          monthsDelayed: 0,
          penaltyRate: 0,
          penaltyAmount: 0,
          discountRate: 0,
          discountAmount: 0,
          totalDue: baseTax,
          clearanceReference: 'Settled per Masterlist Baseline',
          clearedBy: 'Historical RPTAR Record',
        });
      }
    }

    return Array.from(completedRecordsMap.values()).sort((a, b) => (a.year - b.year) || (a.periodLabel || '').localeCompare(b.periodLabel || ''));
  }

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
  }

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
  }

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
    const totalPaid = payload.paidRecords.reduce((sum, r) => sum + (r.totalDue || 0), 0);
    const basicTax = payload.paidRecords.reduce((sum, r) => sum + (r.basicTax ?? ((r.baseTax || 0) / 2)), 0);
    const sefTax = payload.paidRecords.reduce((sum, r) => sum + (r.sefTax ?? ((r.baseTax || 0) / 2)), 0);
    const penalty = payload.paidRecords.reduce((sum, r) => sum + (r.penaltyAmount || 0), 0);
    const discount = payload.paidRecords.reduce((sum, r) => sum + (r.discountAmount || 0), 0);

    let receiptNo = '';
    let status: 'ISSUED' | 'VOIDED' = 'ISSUED';
    let bookletId: string | undefined;

    // 1. Attempt Atomic PostgreSQL Stored Procedure (process_rpt_payment)
    try {
      const { data: rpcPosting, error: rpcError } = await supabase.rpc('process_rpt_payment', {
        p_property_id: Number(payload.propertyId),
        p_paid_records: payload.paidRecords,
        p_total_paid: totalPaid,
        p_tender_type: payload.tenderType || 'CASH',
        p_tender_reference: payload.tenderReference || null,
        p_posted_by: payload.postedBy,
        p_station_id: payload.stationId || 'Main-HQ',
        p_user_id: payload.userId || null
      });

      if (!rpcError && rpcPosting) {
        receiptNo = rpcPosting.receipt_no;
        status = rpcPosting.status || 'ISSUED';
        bookletId = rpcPosting.booklet_id;
      }
    } catch {
      // Fallback below
    }

    // 2. Sequential fallback if RPC is not registered
    if (!receiptNo) {
      const activeBooklet = await this.getActiveBooklet(payload.postedBy);
      let serialNumber = 4500001;

      if (activeBooklet) {
        serialNumber = activeBooklet.currentSerial;
        bookletId = activeBooklet.bookletId;
        const nextSerial = activeBooklet.currentSerial + 1;
        const isExhausted = nextSerial > activeBooklet.seriesEnd;

        await supabase
          .from('accountable_forms')
          .update({
            current_serial: isExhausted ? activeBooklet.seriesEnd : nextSerial,
            status: isExhausted ? 'EXHAUSTED' : 'ACTIVE'
          })
          .eq('id', activeBooklet.id);
      }

      receiptNo = `AF51-${String(serialNumber).padStart(7, '0')}`;

      // Advance property last paid year
      if (payload.paidRecords.length > 0) {
        const lastRec = payload.paidRecords[payload.paidRecords.length - 1];
        const isPartialFirstHalf = lastRec.quarterSpan === '1-2Q';
        const highestYear = isPartialFirstHalf 
          ? (lastRec.year - 1) 
          : Math.max(...payload.paidRecords.map(r => r.endYear || r.year || 0));
        await supabase
          .from('properties')
          .update({ last_paid_year: highestYear, updated_at: new Date().toISOString() })
          .eq('id', payload.propertyId);
      }

      // Save payment record with full immutable snapshot
      await supabase.from('payment_postings').insert({
        receipt_no: receiptNo,
        property_id: payload.propertyId,
        paid_records: payload.paidRecords,
        total_paid: totalPaid,
        basic_tax: basicTax,
        sef_tax: sefTax,
        penalty_amount: penalty,
        discount_amount: discount,
        discount_rate: payload.paidRecords[0]?.discountRate || 0,
        tender_type: payload.tenderType,
        tender_reference: payload.tenderReference,
        status: 'ISSUED',
        posted_by: payload.postedBy,
        booklet_id: bookletId
      });
    }

    const { data: prop } = await supabase.from('properties').select('*').eq('id', payload.propertyId).single();

    return {
      receiptNo,
      date: new Date().toISOString(),
      status,
      bookletId,
      property: {
        id: prop ? String(prop.id) : String(payload.propertyId),
        tdNumber: prop?.td_number || 'TD-PROT-001',
        pin: prop?.pin,
        ownerName: prop?.owner_name || 'Taxpayer',
        address: prop?.address || 'Santa Rosa, Nueva Ecija',
        barangay: prop?.barangay || 'Poblacion',
        assessedValue: Number(prop?.assessed_value) || 0,
        propertyClass: prop?.property_class || 'Residential'
      },
      itemizedRecords: payload.paidRecords,
      summary: {
        basicTax,
        sefTax,
        baseTaxTotal: basicTax + sefTax,
        penalty,
        discount,
        totalPaid
      },
      tenderType: (payload.tenderType as 'CASH' | 'CHECK' | 'ONLINE') || 'CASH',
      tenderReference: payload.tenderReference,
      postedBy: payload.postedBy
    };
  }

  async voidReceipt(payload: {
    receiptNo: string;
    reason: string;
    authorizedBy: string;
    stationId?: string;
  }): Promise<{ message: string; receiptNo: string }> {
    try {
      const { data, error } = await supabase.rpc('void_official_receipt', {
        p_receipt_no: payload.receiptNo,
        p_reason: payload.reason,
        p_authorized_by: payload.authorizedBy,
        p_station_id: payload.stationId || 'Main-HQ'
      });
      if (!error && data) {
        return { message: 'Official Receipt successfully voided', receiptNo: payload.receiptNo };
      }
    } catch {
      // Fallback
    }

    // Direct fallback
    const { data: posting, error: fetchErr } = await supabase
      .from('payment_postings')
      .select('*')
      .eq('receipt_no', payload.receiptNo)
      .single();

    if (fetchErr || !posting) throw new Error('Receipt not found');

    if (posting.previous_last_paid_year !== null && posting.previous_last_paid_year !== undefined) {
      await supabase
        .from('properties')
        .update({ last_paid_year: posting.previous_last_paid_year, updated_at: new Date().toISOString() })
        .eq('id', posting.property_id);
    }

    await supabase
      .from('payment_postings')
      .update({
        status: 'VOIDED',
        void_reason: payload.reason,
        voided_by: payload.authorizedBy,
        voided_at: new Date().toISOString()
      })
      .eq('receipt_no', payload.receiptNo);

    await supabase.from('rptar_audit_logs').insert({
      property_id: posting.property_id,
      td_number: 'N/A',
      action_type: 'RECEIPT_VOIDED',
      assessor_name: payload.authorizedBy,
      station_id: payload.stationId || 'Main-HQ',
      details: `COA VOID: Official Receipt ${payload.receiptNo} VOIDED by ${payload.authorizedBy}. Reason: ${payload.reason}`
    });

    return { message: 'Official Receipt successfully voided', receiptNo: payload.receiptNo };
  }

  // 3. Accountable Forms (AF-51)
  async getActiveBooklet(username?: string): Promise<AccountableFormBooklet | null> {
    const cleanUser = username?.trim().toLowerCase();

    // 1. Try matching specifically assigned active booklet for this user
    if (cleanUser) {
      // Clean up composite name if passed like "Name (Role • Station)"
      const simpleUser = cleanUser.includes('(') ? cleanUser.split('(')[0].trim() : cleanUser;

      const { data: userBooklet } = await supabase
        .from('accountable_forms')
        .select('*')
        .eq('status', 'ACTIVE')
        .ilike('assigned_to_username', `%${simpleUser}%`)
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (userBooklet) {
        return {
          id: userBooklet.id,
          bookletId: userBooklet.booklet_id,
          formType: userBooklet.form_type,
          seriesStart: userBooklet.series_start,
          seriesEnd: userBooklet.series_end,
          currentSerial: userBooklet.current_serial,
          assignedToUserId: userBooklet.assigned_to_user_id,
          assignedToUsername: userBooklet.assigned_to_username,
          status: userBooklet.status,
          createdAt: userBooklet.created_at
        };
      }
    }

    // 2. Fallback to unassigned active booklet or first active booklet
    const { data: unassignedBooklet } = await supabase
      .from('accountable_forms')
      .select('*')
      .eq('status', 'ACTIVE')
      .is('assigned_to_username', null)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    const data = unassignedBooklet || (await supabase
      .from('accountable_forms')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()
    ).data;

    if (!data) return null;
    return {
      id: data.id,
      bookletId: data.booklet_id,
      formType: data.form_type,
      seriesStart: data.series_start,
      seriesEnd: data.series_end,
      currentSerial: data.current_serial,
      assignedToUserId: data.assigned_to_user_id,
      assignedToUsername: data.assigned_to_username,
      status: data.status,
      createdAt: data.created_at
    };
  }

  async getBooklets(): Promise<AccountableFormBooklet[]> {
    const { data } = await supabase.from('accountable_forms').select('*').order('id', { ascending: true });
    return (data || []).map(b => ({
      id: b.id,
      bookletId: b.booklet_id,
      formType: b.form_type,
      seriesStart: b.series_start,
      seriesEnd: b.series_end,
      currentSerial: b.current_serial,
      assignedToUserId: b.assigned_to_user_id,
      assignedToUsername: b.assigned_to_username,
      status: b.status,
      createdAt: b.created_at
    }));
  }

  async assignBooklet(bookletId: string, username: string, userId?: number): Promise<void> {
    const { error } = await supabase
      .from('accountable_forms')
      .update({
        assigned_to_username: username,
        assigned_to_user_id: userId || null
      })
      .eq('booklet_id', bookletId);
    if (error) throw error;
  }

  // 4. Reporting, Analytics & Live Multi-Assessor Sync
  async getDashboardStats(): Promise<DashboardStatsData> {
    const { data: props } = await supabase.from('properties').select('*');
    const list = props || [];

    const totalProperties = list.length;
    const shellRecordsCount = list.filter(p => p.is_shell_record).length;
    const clearedCount = list.filter(p => !p.is_shell_record && (p.last_paid_year || 0) >= 2026).length;
    const delinquentCount = list.filter(p => !p.is_shell_record && (p.last_paid_year || 0) < 2026).length;

    let totalDelinquentDebt = 0;
    const barangayMap = new Map<string, { properties: number; outstandingDebt: number }>();

    for (const p of list) {
      const bgy = p.barangay || 'Unassigned';
      const isDelinquent = !p.is_shell_record && (p.last_paid_year || 0) < 2026;
      let debt = 0;

      if (!p.is_shell_record) {
        const mappedProperty: Property = {
          id: String(p.id),
          tdNumber: p.td_number,
          previousTdNumber: p.previous_td_number || '',
          pin: p.pin,
          ownerName: p.owner_name,
          address: p.address || '',
          barangay: p.barangay || '',
          propertyClass: p.property_class || 'Residential',
          assessedValue: Number(p.assessed_value) || 0,
          marketValue: Number(p.market_value) || 0,
          lastPaidYear: p.last_paid_year || 2020,
          isShellRecord: p.is_shell_record || false
        };
        debt = localCalculateTaxLiability(mappedProperty).grandTotal;
      }

      if (isDelinquent) {
        totalDelinquentDebt += debt;
      }

      const existing = barangayMap.get(bgy) || { properties: 0, outstandingDebt: 0 };
      barangayMap.set(bgy, {
        properties: existing.properties + 1,
        outstandingDebt: existing.outstandingDebt + (isDelinquent ? debt : 0)
      });
    }

    const { data: payments } = await supabase
      .from('payment_postings')
      .select('total_paid, posted_at');

    let totalCollected = 0;
    let todayCollected = 0;
    const monthlyCollections = new Map<string, number>();
    const todayDate = new Date().toDateString();

    if (payments && payments.length > 0) {
      for (const pay of payments) {
        const amount = Number(pay.total_paid) || 0;
        totalCollected += amount;

        const payDate = pay.posted_at ? new Date(pay.posted_at) : new Date();
        if (payDate.toDateString() === todayDate) {
          todayCollected += amount;
        }

        const monthShort = payDate.toLocaleString('en-US', { month: 'short' });
        monthlyCollections.set(monthShort, (monthlyCollections.get(monthShort) || 0) + amount);
      }
    }

    const standardMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIdx = new Date().getMonth();
    const monthsToShow = standardMonths.slice(0, Math.max(8, currentMonthIdx + 1));
    const targetSchedule = [150000, 120000, 200000, 100000, 90000, 160000, 80000, 80000, 120000, 100000, 90000, 150000];

    const monthlyTrend = monthsToShow.map((month, idx) => ({
      month,
      collections: monthlyCollections.get(month) || 0,
      target: targetSchedule[idx] || 100000
    }));

    const barangayBreakdown = Array.from(barangayMap.entries()).map(([barangay, data]) => ({
      barangay,
      properties: data.properties,
      outstandingDebt: Math.round(data.outstandingDebt)
    }));

    return {
      totalProperties,
      clearedCount,
      delinquentCount,
      partialCount: 0,
      shellRecordsCount,
      totalCollected: Math.round(totalCollected),
      todayCollected: Math.round(todayCollected),
      totalDelinquentDebt: Math.round(totalDelinquentDebt),
      collectionEfficiency: totalProperties > 0 ? Math.round((clearedCount / totalProperties) * 100) : 0,
      monthlyTrend,
      barangayBreakdown
    };
  }

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
  }

  // 5. User Management & Authentication (Isolated PostgREST / RPC implementation)
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
  }

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
  }

  async login(username: string, password: string, stationId = 'Workstation'): Promise<{ token: string; user: User }> {
    const cleanUsername = username.trim().toLowerCase();

    // 1. Attempt secure database stored procedure first (with automated security audit logging)
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('authenticate_user', {
          p_username: cleanUsername,
          p_password: password,
          p_station_id: stationId
        });

      if (!rpcError) {
        if (Array.isArray(rpcData) && rpcData.length > 0) {
          const match = rpcData[0];
          const verifiedUser: User = {
            id: String(match.id),
            name: match.full_name,
            username: match.username,
            role: match.role,
            stationId: match.station_id
          };

          const token = await createSessionToken(verifiedUser);
          return { token, user: verifiedUser };
        } else {
          // RPC executed, but credentials failed Bcrypt verification
          throw new Error('Invalid credentials. Please verify your username and password.');
        }
      }
    } catch (rpcCatchErr) {
      if (rpcCatchErr instanceof Error && rpcCatchErr.message.includes('Invalid credentials')) {
        throw rpcCatchErr;
      }
      // Fall through only if RPC itself failed to execute (e.g. unmigrated database)
    }

    // 2. Direct verification fallback (for environments without RPC installed)
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, username, role, station_id, password_hash')
      .eq('username', cleanUsername)
      .single();

    if (error || !user) {
      await this.logSecurityEvent({
        eventType: 'LOGIN_FAILURE',
        username: cleanUsername,
        stationId,
        details: 'Staff account not found'
      });
      throw new Error('Invalid credentials. Staff account not found.');
    }

    // Reject plaintext comparison if database hash is a salted Bcrypt hash ($2a/$2b)
    const isBcrypt = Boolean(user.password_hash && user.password_hash.startsWith('$2'));
    if (isBcrypt) {
      await this.logSecurityEvent({
        eventType: 'LOGIN_FAILURE',
        username: cleanUsername,
        userId: user.id,
        stationId,
        details: 'RPC authenticate_user unavailable for Bcrypt verification'
      });
      throw new Error('Authentication service temporarily unavailable. Please contact the administrator.');
    }

    const isValid = user.password_hash ? user.password_hash === password : false;
    if (!isValid) {
      await this.logSecurityEvent({
        eventType: 'LOGIN_FAILURE',
        username: cleanUsername,
        userId: user.id,
        stationId,
        details: 'Invalid password'
      });
      throw new Error('Invalid credentials. Please verify your username and password.');
    }

    const authenticatedUser: User = {
      id: String(user.id),
      name: user.full_name,
      username: user.username,
      role: user.role,
      stationId: user.station_id
    };

    await this.logSecurityEvent({
      eventType: 'LOGIN_SUCCESS',
      username: authenticatedUser.username || cleanUsername,
      userId: Number(authenticatedUser.id),
      stationId,
      details: 'Authenticated via legacy fallback'
    });

    const token = await createSessionToken(authenticatedUser);
    return { token, user: authenticatedUser };
  }

  async verifyPassword(username: string, password: string): Promise<boolean> {
    const cleanUsername = username.trim().toLowerCase();
    try {
      const { data, error } = await supabase.rpc('authenticate_user', {
        p_username: cleanUsername,
        p_password: password,
        p_station_id: 'Security-Reauth'
      });
      if (!error) {
        return Array.isArray(data) && data.length > 0;
      }
    } catch {
      // Fallback check
    }

    const { data: user } = await supabase
      .from('users')
      .select('password_hash')
      .eq('username', cleanUsername)
      .single();

    if (!user || !user.password_hash) return false;
    if (user.password_hash.startsWith('$2')) {
      return false;
    }
    return user.password_hash === password;
  }

  async registerUser(userData: {
    username: string;
    password: string;
    fullName: string;
    role: string;
    stationId: string;
  }): Promise<{ message: string; user: User }> {
    const cleanUsername = userData.username.trim().toLowerCase();
    const { data, error } = await supabase
      .from('users')
      .insert({
        username: cleanUsername,
        password_hash: userData.password,
        full_name: userData.fullName,
        role: userData.role,
        station_id: userData.stationId
      })
      .select('id, full_name, username, role, station_id')
      .single();

    if (error) throw new Error(error.message);

    await this.logSecurityEvent({
      eventType: 'USER_CREATED',
      username: cleanUsername,
      userId: data.id,
      stationId: userData.stationId,
      details: `Created staff account for ${userData.fullName} with role ${userData.role}`
    });

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
  }

  async deleteUser(id: string | number, adminUsername = 'admin'): Promise<{ message: string }> {
    const { data: targetUser } = await supabase.from('users').select('username, full_name').eq('id', id).single();
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;

    await this.logSecurityEvent({
      eventType: 'USER_DELETED',
      username: adminUsername,
      userId: typeof id === 'number' ? id : parseInt(id, 10),
      details: `Deleted account for ${targetUser?.full_name || id} (${targetUser?.username || 'unknown'})`
    });

    return { message: 'User deleted successfully' };
  }

  async resetUserPassword(id: string | number, newPassword: string, adminUsername = 'admin'): Promise<{ message: string }> {
    const { error } = await supabase
      .from('users')
      .update({ password_hash: newPassword })
      .eq('id', id);
    if (error) throw error;

    await this.logSecurityEvent({
      eventType: 'PASSWORD_RESET',
      username: adminUsername,
      userId: typeof id === 'number' ? id : parseInt(id, 10),
      details: `Password reset for user ID ${id}`
    });

    return { message: 'Password reset successfully' };
  }

  // 6. Audit Logs & Forensic History
  async getPropertyAudit(propertyId: string | number): Promise<RptarAuditLog[]> {
    const { data } = await supabase
      .from('rptar_audit_logs')
      .select('*')
      .eq('property_id', propertyId)
      .order('timestamp', { ascending: false });

    return data || [];
  }

  async getAllAuditLogs(): Promise<RptarAuditLog[]> {
    const { data } = await supabase
      .from('rptar_audit_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    return data || [];
  }

  async logSecurityEvent(event: {
    eventType: SecurityAuditLog['event_type'];
    username: string;
    userId?: number;
    stationId?: string;
    details?: string;
  }): Promise<void> {
    try {
      await supabase.from('security_audit_logs').insert({
        event_type: event.eventType,
        username: event.username,
        user_id: event.userId,
        station_id: event.stationId || 'Workstation',
        details: event.details || ''
      });
    } catch {
      // Non-blocking in offline / local development modes
    }
  }

  async getSecurityAuditLogs(): Promise<SecurityAuditLog[]> {
    const { data } = await supabase
      .from('security_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    return data || [];
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
    try {
      const difference = Math.round((entry.newValue - entry.originalValue) * 100) / 100;
      await supabase.from('rptar_audit_logs').insert({
        property_id: entry.propertyId ? Number(entry.propertyId) : null,
        td_number: entry.tdNumber,
        tax_year: entry.taxYear,
        action_type: 'FIELD_OVERRIDE',
        field_changed: entry.fieldChanged,
        original_value: entry.originalValue,
        new_value: entry.newValue,
        difference,
        reason: entry.reason,
        assessor_name: entry.assessorName,
        station_id: entry.stationId || 'Assessor-Desk-02',
        details: `Manually modified ${entry.fieldChanged} on Tax Year ${entry.taxYear} from ${entry.originalValue} to ${entry.newValue} (${difference > 0 ? '+' : ''}${difference}). Reason: ${entry.reason}`
      });
    } catch (err) {
      console.warn('Field override audit logging failed:', err);
    }
  }

  // 7. Municipal Tax Settings & Ordinances
  async getMunicipalTaxSettings(): Promise<MunicipalTaxSettings> {
    try {
      const { data, error } = await supabase
        .from('municipal_tax_settings')
        .select('*')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return {
          earlyPaymentDiscountRate: 0.20,
          earlyPaymentStartMonth: 1,
          earlyPaymentEndMonth: 3,
          regularPromptDiscountRate: 0.10,
          delinquentDiscountRate: 0.00,
          effectiveYear: 2026,
          updatedBy: 'System Default'
        };
      }

      return {
        id: data.id,
        earlyPaymentDiscountRate: Number(data.early_payment_discount_rate),
        earlyPaymentStartMonth: Number(data.early_payment_start_month),
        earlyPaymentEndMonth: Number(data.early_payment_end_month),
        regularPromptDiscountRate: Number(data.regular_prompt_discount_rate),
        delinquentDiscountRate: Number(data.delinquent_discount_rate),
        effectiveYear: Number(data.effective_year),
        updatedBy: data.updated_by,
        updatedAt: data.updated_at
      };
    } catch {
      return {
        earlyPaymentDiscountRate: 0.20,
        earlyPaymentStartMonth: 1,
        earlyPaymentEndMonth: 3,
        regularPromptDiscountRate: 0.10,
        delinquentDiscountRate: 0.00,
        effectiveYear: 2026,
        updatedBy: 'System Default'
      };
    }
  }

  async updateMunicipalTaxSettings(settings: Partial<MunicipalTaxSettings>, updatedBy = 'admin'): Promise<MunicipalTaxSettings> {
    const row = {
      early_payment_discount_rate: settings.earlyPaymentDiscountRate ?? 0.20,
      early_payment_start_month: settings.earlyPaymentStartMonth ?? 1,
      early_payment_end_month: settings.earlyPaymentEndMonth ?? 3,
      regular_prompt_discount_rate: settings.regularPromptDiscountRate ?? 0.10,
      delinquent_discount_rate: settings.delinquentDiscountRate ?? 0.00,
      effective_year: settings.effectiveYear || 2026,
      updated_by: updatedBy,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('municipal_tax_settings')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      earlyPaymentDiscountRate: Number(data.early_payment_discount_rate),
      earlyPaymentStartMonth: Number(data.early_payment_start_month),
      earlyPaymentEndMonth: Number(data.early_payment_end_month),
      regularPromptDiscountRate: Number(data.regular_prompt_discount_rate),
      delinquentDiscountRate: Number(data.delinquent_discount_rate),
      effectiveYear: Number(data.effective_year),
      updatedBy: data.updated_by,
      updatedAt: data.updated_at
    };
  }

  // 8. Assessor Import Center & Smart Upsert
  async getImportBatches(barangay?: string): Promise<CsvImportBatch[]> {
    try {
      let query = supabase.from('csv_import_batches').select('*').order('id', { ascending: false });
      if (barangay && barangay !== 'All') {
        query = query.eq('barangay', barangay);
      }
      const { data, error } = await query;
      if (error || !data) return [];
      return data.map(b => ({
        id: b.id,
        batchName: b.batch_name,
        barangay: b.barangay,
        filename: b.filename,
        totalRows: b.total_rows,
        insertedRows: b.inserted_rows,
        updatedRows: b.updated_rows,
        unchangedRows: b.unchanged_rows,
        importedBy: b.imported_by,
        createdAt: b.created_at
      }));
    } catch {
      return [];
    }
  }

  async bulkImportProperties(
    properties: Array<Partial<Property> & Record<string, unknown>>,
    assessorName = 'Juan Reyes',
    stationId = 'Assessor-Desk-02',
    batchMetadata?: { filename?: string; barangay?: string }
  ): Promise<{
    message: string;
    insertedCount: number;
    updatedCount: number;
    unchangedCount: number;
    batchId?: number;
    errors: unknown[];
  }> {
    const validRows = properties.filter(p => p.tdNumber);
    if (validRows.length === 0) {
      return { message: 'No valid rows to import', insertedCount: 0, updatedCount: 0, unchangedCount: 0, errors: [] };
    }

    const tdNumbers = validRows.map(p => String(p.tdNumber).trim());
    const { data: existingData } = await supabase
      .from('properties')
      .select('*')
      .in('td_number', tdNumbers);

    const existingMap = new Map<string, Record<string, unknown>>();
    (existingData || []).forEach(p => existingMap.set(p.td_number, p));

    let insertedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    const errors: unknown[] = [];

    const toInsert: Array<Record<string, unknown>> = [];

    for (const p of validRows) {
      const cleanTd = String(p.tdNumber).trim();
      const existing = existingMap.get(cleanTd);

      if (!existing) {
        toInsert.push({
          td_number: cleanTd,
          previous_td_number: p.previousTdNumber || '',
          pin: p.pin || '',
          owner_name: p.ownerName || 'Unnamed Taxpayer',
          address: p.address || 'Santa Rosa, Nueva Ecija',
          barangay: p.barangay || 'Poblacion',
          property_class: p.propertyClass || 'Residential',
          lot_area_sqm: Number(p.lotAreaSqm) || 100,
          market_value: Number(p.marketValue) || 0,
          assessed_value: Number(p.assessedValue) || 0,
          last_paid_year: Number(p.lastPaidYear) || 2025,
          is_shell_record: Boolean(p.isShellRecord),
          updated_at: new Date().toISOString()
        });
        insertedCount++;
      } else {
        const isIdentical =
          String(existing.owner_name).trim() === String(p.ownerName || '').trim() &&
          String(existing.address).trim() === String(p.address || '').trim() &&
          String(existing.barangay).trim() === String(p.barangay || '').trim() &&
          String(existing.property_class).trim() === String(p.propertyClass || '').trim() &&
          Number(existing.assessed_value) === Number(p.assessedValue || 0) &&
          Number(existing.market_value) === Number(p.marketValue || 0);

        if (isIdentical) {
          unchangedCount++;
        } else {
          try {
            await supabase
              .from('properties')
              .update({
                previous_td_number: p.previousTdNumber || existing.previous_td_number,
                pin: p.pin || existing.pin,
                owner_name: p.ownerName || existing.owner_name,
                address: p.address || existing.address,
                barangay: p.barangay || existing.barangay,
                property_class: p.propertyClass || existing.property_class,
                lot_area_sqm: p.lotAreaSqm !== undefined ? Number(p.lotAreaSqm) : existing.lot_area_sqm,
                market_value: p.marketValue !== undefined ? Number(p.marketValue) : existing.market_value,
                assessed_value: p.assessedValue !== undefined ? Number(p.assessedValue) : existing.assessed_value,
                is_shell_record: p.isShellRecord !== undefined ? Boolean(p.isShellRecord) : existing.is_shell_record,
                updated_at: new Date().toISOString()
              })
              .eq('td_number', cleanTd);

            updatedCount++;
          } catch (updateErr) {
            errors.push(updateErr);
          }
        }
      }
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from('properties').insert(toInsert);
      if (insertError) {
        errors.push(insertError);
        insertedCount = 0;
      }
    }

    const primaryBarangay = batchMetadata?.barangay || validRows[0]?.barangay || 'Multiple';
    const filename = batchMetadata?.filename || `Santa_Rosa_Import_${new Date().toISOString().split('T')[0]}.csv`;
    let batchId: number | undefined;

    try {
      const { data: batchData } = await supabase.from('csv_import_batches').insert({
        batch_name: `Batch-${Date.now().toString().slice(-6)}`,
        barangay: primaryBarangay,
        filename,
        total_rows: validRows.length,
        inserted_rows: insertedCount,
        updated_rows: updatedCount,
        unchanged_rows: unchangedCount,
        imported_by: assessorName
      }).select('id').single();

      batchId = batchData?.id;
    } catch {
      // Non-blocking
    }

    await supabase.from('rptar_audit_logs').insert({
      td_number: 'BATCH-IMPORT',
      action_type: 'UPDATED',
      assessor_name: assessorName,
      station_id: stationId,
      details: `Smart upsert processed ${validRows.length} parcels (${insertedCount} new, ${updatedCount} updated, ${unchangedCount} unchanged) for Barangay ${primaryBarangay}`
    });

    return {
      message: `Processed ${validRows.length} parcels: ${insertedCount} added, ${updatedCount} updated, ${unchangedCount} unchanged`,
      insertedCount,
      updatedCount,
      unchangedCount,
      batchId,
      errors
    };
  }

  // 9. Utility
  getBackupDownloadUrl(): string {
    return '#';
  }
}
