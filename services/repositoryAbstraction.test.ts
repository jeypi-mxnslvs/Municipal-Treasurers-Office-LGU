import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalHttpRepository } from './LocalHttpRepository';
import { SupabaseRepository } from './SupabaseRepository';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({ supabase: {
  auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  rpc: vi.fn(),
  from: vi.fn(),
} }));

describe('Phase 4: Deployment Abstraction (ITreasuryRepository & LocalHttpRepository)', () => {
  let repo: LocalHttpRepository;

  beforeEach(() => {
    repo = new LocalHttpRepository('http://192.168.1.100:8000/api/v1');
    vi.restoreAllMocks();
  });

  it('initializes with custom on-premise base URL', () => {
    expect(repo.getBackupDownloadUrl()).toBe('http://192.168.1.100:8000/api/v1/admin/backup');
  });

  it('dispatches getProperties to local HTTP REST endpoint', async () => {
    const mockProperties = [
      { id: '1', tdNumber: 'TD-001', ownerName: 'Juan Dela Cruz', assessedValue: 100000, lastPaidYear: 2024, barangay: 'Poblacion', propertyClass: 'Residential', isShellRecord: false, address: 'Rizal St.' }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockProperties, total: 1, page: 2, pageSize: 25, hasNextPage: false }),
    });

    const result = await repo.getProperties({ search: 'Juan', barangay: 'Poblacion', page: 2 });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://192.168.1.100:8000/api/v1/properties?page=2&pageSize=25&search=Juan&barangay=Poblacion',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
    expect(result.items).toEqual(mockProperties);
    expect(result.total).toBe(1);
  });

  it('passes special characters and bounded paging as parameters, without client-side filtering', async () => {
    const abortSignal = vi.fn().mockResolvedValue({ data: { items: [{ id: 42, td_number: 'TD-42', owner_name: 'O’Neil % _' }], total: 25000, page: 2, pageSize: 25, hasNextPage: true }, error: null });
    vi.mocked(supabase.rpc).mockReturnValue({ abortSignal } as never);
    const search = `O'Neil % _ 雪`;
    const result = await new SupabaseRepository().getProperties({ page: 2, pageSize: 25, search });
    expect(supabase.rpc).toHaveBeenCalledWith('list_properties_page', expect.objectContaining({ p_search: search, p_page: 2, p_page_size: 25 }));
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(25000);
    expect(result.hasNextPage).toBe(true);
  });

  it('chunks exact import TD lookups so a large file cannot truncate review results', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);
    const tdNumbers = Array.from({ length: 1201 }, (_, index) => `TD-${index}`);
    await new SupabaseRepository().lookupPropertiesByTd(tdNumbers);
    expect(vi.mocked(supabase.rpc).mock.calls.filter(([name]) => name === 'lookup_properties_by_td')).toHaveLength(3);
    expect(vi.mocked(supabase.rpc).mock.calls.at(-1)?.[1]).toEqual({ p_td_numbers: tdNumbers.slice(1000) });
  });

  it('bounds batch notice candidates with stable ID pagination', async () => {
    const query = {
      select: vi.fn(), eq: vi.fn(), not: vi.fn(), neq: vi.fn(), gt: vi.fn(),
      lt: vi.fn(), order: vi.fn(), range: vi.fn().mockResolvedValue({ data: [], count: 25000, error: null }),
    };
    for (const key of ['select', 'eq', 'not', 'neq', 'gt', 'lt', 'order'] as const) query[key].mockReturnValue(query);
    vi.mocked(supabase.from).mockReturnValue(query as never);
    const result = await new SupabaseRepository().getNoticeCandidates(2);
    expect(query.range).toHaveBeenCalledWith(25, 49);
    expect(query.order).toHaveBeenCalledWith('id', { ascending: true });
    expect(result.total).toBe(25000);
    expect(result.hasNextPage).toBe(true);
  });

  it('fails closed when notice verification evidence cannot be read', async () => {
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn().mockResolvedValue({ data: null, error: new Error('Evidence unavailable') }) };
    for (const key of ['select', 'eq'] as const) query[key].mockReturnValue(query);
    vi.mocked(supabase.from).mockReturnValue(query as never);
    await expect(new SupabaseRepository().getPeriodVerifications(123, true)).rejects.toThrow('Evidence unavailable');
  });

  it('dispatches verifyDelinquencyPeriod via local HTTP endpoint', async () => {
    const mockVerification = {
      id: 101,
      propertyId: 1,
      tdNumberSnapshot: 'TD-001',
      periodKey: '2024',
      taxYear: 2024,
      periodLabel: 'Tax Year 2024',
      status: 'VERIFIED_SETTLED_EXTERNALLY',
      verificationType: 'EXTERNAL_SETTLEMENT_EVIDENCE',
      sourceReference: 'OR-2024-9988',
      remarks: 'Prior payment settled',
      verifiedBy: 1,
      verifiedAt: '2026-09-18T00:00:00.000Z',
      stationId: 'Desk-1',
      createdAt: '2026-09-18T00:00:00.000Z'
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockVerification,
    });

    const result = await repo.verifyDelinquencyPeriod({
      propertyId: 1,
      tdNumber: 'TD-001',
      periodKey: '2024',
      taxYear: 2024,
      periodLabel: 'Tax Year 2024',
      status: 'VERIFIED_SETTLED_EXTERNALLY',
      verificationType: 'EXTERNAL_SETTLEMENT_EVIDENCE',
      sourceReference: 'OR-2024-9988',
      verifiedBy: 1,
      stationId: 'Desk-1'
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://192.168.1.100:8000/api/v1/delinquency/verify',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(result.id).toBe(101);
    expect(result.status).toBe('VERIFIED_SETTLED_EXTERNALLY');
  });

  it('dispatches supervisory reversal via local HTTP endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Verification successfully reversed' }),
    });

    await repo.revertDelinquencyVerification({
      propertyId: 1,
      taxYear: 2024,
      reason: 'Erroneous external receipt encoded',
      authorizedBy: 'Supervisor Admin'
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://192.168.1.100:8000/api/v1/delinquency/revert',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('throws descriptive error on HTTP non-200 responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ message: 'Supervisor authorization required' }),
    });

    await expect(
      repo.revertDelinquencyVerification({
        propertyId: 1,
        taxYear: 2024,
        reason: 'Error',
        authorizedBy: 'Clerk'
      })
    ).rejects.toThrow('Supervisor authorization required');
  });
});
