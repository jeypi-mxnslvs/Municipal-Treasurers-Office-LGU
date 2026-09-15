import { ITreasuryRepository } from '../ITreasuryRepository';
import { offlineStorage, OfflineStorage } from './OfflineStorage';
import { OfflineSyncResult } from '@/types';

export type SyncEventListener = (event: {
  type: 'SYNC_START' | 'SYNC_PROGRESS' | 'SYNC_COMPLETE' | 'ONLINE' | 'OFFLINE';
  pendingCount: number;
  result?: OfflineSyncResult;
}) => void;

/**
 * OfflineSyncService
 * 
 * Orchestrates background synchronization between the mobile caravan IndexedDB outbox
 * and the central Santa Rosa Treasury master database.
 * 
 * Guarantees:
 * - Sequential FIFO replay of queued payments.
 * - Non-destructive conflict detection (flags split-station concurrent payments for supervisor review).
 * - Zero lost collections during network transitions.
 * 
 * Reference: ROADMAP_AND_PHASES.md Phase 5 Acceptance Criteria
 */
export class OfflineSyncService {
  private isSyncing: boolean = false;
  private listeners: Set<SyncEventListener> = new Set();
  private repository: ITreasuryRepository | null = null;
  private storage: OfflineStorage;

  constructor(storage: OfflineStorage = offlineStorage) {
    this.storage = storage;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.notifyListeners('ONLINE', 0);
        this.autoSync();
      });

      window.addEventListener('offline', () => {
        this.notifyListeners('OFFLINE', 0);
      });
    }
  }

  setRepository(repo: ITreasuryRepository) {
    this.repository = repo;
  }

  subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(
    type: 'SYNC_START' | 'SYNC_PROGRESS' | 'SYNC_COMPLETE' | 'ONLINE' | 'OFFLINE',
    pendingCount: number,
    result?: OfflineSyncResult
  ) {
    this.listeners.forEach(l => {
      try {
        l({ type, pendingCount, result });
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    });
  }

  get isOnline(): boolean {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  }

  async getPendingCount(): Promise<number> {
    const items = await this.storage.getPendingPayments();
    return items.filter(i => i.syncStatus === 'PENDING' || i.syncStatus === 'FAILED').length;
  }

  async autoSync(): Promise<OfflineSyncResult | null> {
    if (!this.isOnline || !this.repository || this.isSyncing) {
      return null;
    }
    return this.sync();
  }

  /**
   * Replays pending offline payments against the master repository.
   */
  async sync(repoOverride?: ITreasuryRepository): Promise<OfflineSyncResult> {
    const repo = repoOverride || this.repository;
    if (!repo) {
      throw new Error('No TreasuryRepository driver registered for offline sync.');
    }

    if (this.isSyncing) {
      throw new Error('Synchronization is already in progress.');
    }

    this.isSyncing = true;
    const pendingItems = await this.storage.getPendingPayments();
    const queuedItems = pendingItems.filter(i => i.syncStatus === 'PENDING' || i.syncStatus === 'FAILED');

    const result: OfflineSyncResult = {
      total: queuedItems.length,
      synced: 0,
      conflicts: 0,
      failed: 0,
      errors: []
    };

    this.notifyListeners('SYNC_START', queuedItems.length);

    for (const item of queuedItems) {
      await this.storage.updatePaymentStatus(item.id, { syncStatus: 'SYNCING' });

      try {
        // 1. Conflict Detection: Verify server state hasn't already advanced past these tax years
        let serverProperty = null;
        try {
          const props = await repo.getProperties(String(item.propertyId));
          serverProperty = props.find(p => String(p.id) === String(item.propertyId) || p.tdNumber === item.receiptSnapshot.property.tdNumber);
        } catch {
          // If search fails, proceed to attempt payment
        }

        const minPaidYear = Math.min(...item.paidRecords.map(r => r.year));
        if (serverProperty && serverProperty.lastPaidYear >= minPaidYear) {
          // CONFLICT: Another teller already posted payments for this property while this caravan was offline!
          const conflictMsg = `Conflict: Property ${item.receiptSnapshot.property.tdNumber} was already cleared on server through year ${serverProperty.lastPaidYear}. Queued caravan payment covers year(s) from ${minPaidYear}. Marked for supervisory review.`;
          
          await this.storage.updatePaymentStatus(item.id, {
            syncStatus: 'CONFLICT',
            syncError: conflictMsg
          });

          result.conflicts++;
          result.errors.push({
            id: item.id,
            receiptNo: item.receiptNo,
            error: conflictMsg
          });

          this.notifyListeners('SYNC_PROGRESS', queuedItems.length - result.synced - result.conflicts - result.failed);
          continue;
        }

        // 2. Post atomic payment to central server
        const officialReceipt = await repo.postPayment({
          propertyId: item.propertyId,
          paidRecords: item.paidRecords,
          tenderType: item.tenderType,
          tenderReference: item.tenderReference ? `${item.tenderReference} [Caravan Offline OR: ${item.receiptNo}]` : `[Caravan Offline OR: ${item.receiptNo}]`,
          postedBy: `${item.postedBy} (Synced from Caravan)`,
          stationId: item.stationId,
          userId: item.userId
        });

        // 3. Mark as SYNCED
        await this.storage.updatePaymentStatus(item.id, {
          syncStatus: 'SYNCED',
          syncedAt: new Date().toISOString(),
          serverReceiptNo: officialReceipt.receiptNo
        });

        result.synced++;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await this.storage.updatePaymentStatus(item.id, {
          syncStatus: 'FAILED',
          syncError: errMsg
        });

        result.failed++;
        result.errors.push({
          id: item.id,
          receiptNo: item.receiptNo,
          error: errMsg
        });
      }

      this.notifyListeners('SYNC_PROGRESS', queuedItems.length - result.synced - result.conflicts - result.failed);
    }

    this.isSyncing = false;
    this.notifyListeners('SYNC_COMPLETE', 0, result);
    return result;
  }
}

export const offlineSyncService = new OfflineSyncService();
