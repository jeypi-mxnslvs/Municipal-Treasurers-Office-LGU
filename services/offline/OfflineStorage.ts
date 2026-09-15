import { Property, OfflineBookletSeries, OfflinePaymentItem } from '@/types';

/**
 * OfflineStorage
 * 
 * High-performance IndexedDB client-side cache and transaction outbox engine.
 * Designed for mobile collection caravans dispatched to rural barangays in Santa Rosa
 * with zero cellular coverage or during provincial power/fiber outages.
 * 
 * Features:
 * - Local caching of property masterlists, valuations, and tax policy.
 * - Offline outbox queue for AF-51 payments.
 * - Sequential offline booklet series tracking to prevent duplicate receipts.
 * - Graceful fallback to in-memory store in non-browser / headless test environments.
 * 
 * Reference: ROADMAP_AND_PHASES.md Phase 5 & SSOT.md Section 6.3
 */

const DB_NAME = 'santa_rosa_rptas_offline';
const DB_VERSION = 1;

export class OfflineStorage {
  private db: IDBDatabase | null = null;
  private isMemoryMode: boolean = false;

  // In-memory fallback maps for Node/Vitest or unsupported environments
  private memProperties: Map<string, Property> = new Map();
  private memPendingPayments: Map<string, OfflinePaymentItem> = new Map();
  private memBooklets: Map<string, OfflineBookletSeries> = new Map();

  constructor() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      this.isMemoryMode = true;
    }
  }

  /**
   * Initializes the IndexedDB database schema and indexes.
   */
  async init(): Promise<void> {
    if (this.isMemoryMode) return;

    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // 1. Properties Cache Store
          if (!db.objectStoreNames.contains('properties')) {
            const propStore = db.createObjectStore('properties', { keyPath: 'id' });
            propStore.createIndex('tdNumber', 'tdNumber', { unique: false });
            propStore.createIndex('barangay', 'barangay', { unique: false });
            propStore.createIndex('ownerName', 'ownerName', { unique: false });
          }

          // 2. Pending Payments Outbox Store
          if (!db.objectStoreNames.contains('pending_payments')) {
            const payStore = db.createObjectStore('pending_payments', { keyPath: 'id' });
            payStore.createIndex('syncStatus', 'syncStatus', { unique: false });
            payStore.createIndex('propertyId', 'propertyId', { unique: false });
            payStore.createIndex('createdAt', 'createdAt', { unique: false });
          }

          // 3. Offline Booklet Serials Store
          if (!db.objectStoreNames.contains('offline_booklets')) {
            const bookStore = db.createObjectStore('offline_booklets', { keyPath: 'bookletId' });
            bookStore.createIndex('stationId', 'stationId', { unique: false });
            bookStore.createIndex('isActive', 'isActive', { unique: false });
          }
        };

        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          resolve();
        };

        request.onerror = (event) => {
          console.warn('IndexedDB failed to open, falling back to memory mode:', (event.target as IDBOpenDBRequest).error);
          this.isMemoryMode = true;
          resolve();
        };
      } catch (err) {
        console.warn('IndexedDB exception, falling back to memory mode:', err);
        this.isMemoryMode = true;
        resolve();
      }
    });
  }

  // ==========================================
  // 1. Properties Cache Methods
  // ==========================================

  async cacheProperties(properties: Property[]): Promise<void> {
    if (this.isMemoryMode) {
      properties.forEach(p => this.memProperties.set(String(p.id), p));
      return;
    }

    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('properties', 'readwrite');
      const store = tx.objectStore('properties');

      properties.forEach(p => store.put(p));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedProperties(search?: string, barangay?: string): Promise<Property[]> {
    let allProps: Property[];

    if (this.isMemoryMode) {
      allProps = Array.from(this.memProperties.values());
    } else {
      await this.init();
      if (!this.db) return [];

      allProps = await new Promise<Property[]>((resolve, reject) => {
        const tx = this.db!.transaction('properties', 'readonly');
        const store = tx.objectStore('properties');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    }

    return allProps.filter(p => {
      if (barangay && barangay !== 'All' && p.barangay !== barangay) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const matchTd = (p.tdNumber || '').toLowerCase().includes(q);
        const matchOwner = (p.ownerName || '').toLowerCase().includes(q);
        const matchLoc = (p.address || '').toLowerCase().includes(q);
        return matchTd || matchOwner || matchLoc;
      }
      return true;
    });
  }

  async getCachedPropertyById(propertyId: string | number): Promise<Property | null> {
    const idStr = String(propertyId);
    if (this.isMemoryMode) {
      return this.memProperties.get(idStr) || null;
    }

    await this.init();
    if (!this.db) return null;

    return new Promise<Property | null>((resolve, reject) => {
      const tx = this.db!.transaction('properties', 'readonly');
      const store = tx.objectStore('properties');
      const request = store.get(idStr);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async updatePropertyArrears(propertyId: string | number, lastPaidYear: number, lastPaidQuarter: number = 4): Promise<void> {
    const prop = await this.getCachedPropertyById(propertyId);
    if (!prop) return;

    prop.lastPaidYear = lastPaidYear;
    prop.lastPaidQuarter = lastPaidQuarter;

    if (this.isMemoryMode) {
      this.memProperties.set(String(prop.id), prop);
      return;
    }

    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('properties', 'readwrite');
      const store = tx.objectStore('properties');
      const request = store.put(prop);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==========================================
  // 2. Offline Booklet Serials Management
  // ==========================================

  async registerOfflineBooklet(booklet: OfflineBookletSeries): Promise<void> {
    if (this.isMemoryMode) {
      this.memBooklets.set(booklet.bookletId, { ...booklet });
      return;
    }

    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('offline_booklets', 'readwrite');
      const store = tx.objectStore('offline_booklets');
      const request = store.put(booklet);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getBooklets(stationId?: string): Promise<OfflineBookletSeries[]> {
    if (this.isMemoryMode) {
      return Array.from(this.memBooklets.values()).filter(
        b => !stationId || b.stationId === stationId
      );
    }

    await this.init();
    if (!this.db) return [];

    return new Promise<OfflineBookletSeries[]>((resolve, reject) => {
      const tx = this.db!.transaction('offline_booklets', 'readonly');
      const store = tx.objectStore('offline_booklets');
      const request = store.getAll();

      request.onsuccess = () => {
        const booklets: OfflineBookletSeries[] = request.result || [];
        resolve(booklets.filter(b => !stationId || b.stationId === stationId));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getActiveBooklet(stationId?: string): Promise<OfflineBookletSeries | null> {
    const booklets = await this.getBooklets(stationId);
    return booklets.find(b => b.isActive) || null;
  }

  async allocateNextSerial(stationId?: string): Promise<{ receiptNo: string; bookletId: string }> {
    const stationBooklets = await this.getBooklets(stationId);
    let booklet: OfflineBookletSeries;

    if (stationBooklets.length === 0) {
      // If no booklet assigned yet, auto-provision a default mobile caravan series
      const defaultStation = stationId || 'Caravan-Station-01';
      booklet = {
        bookletId: `BK-OFFLINE-${defaultStation.toUpperCase()}`,
        stationId: defaultStation,
        seriesStart: 8800001,
        seriesEnd: 8800100,
        currentSerial: 8800001,
        assignedCashier: 'Mobile Caravan Cashier',
        isActive: true
      };
      await this.registerOfflineBooklet(booklet);
    } else {
      booklet = stationBooklets.find(b => b.isActive) || stationBooklets[stationBooklets.length - 1];
    }

    if (!booklet.isActive || booklet.currentSerial > booklet.seriesEnd) {
      booklet.isActive = false;
      await this.registerOfflineBooklet(booklet);
      throw new Error(`Assigned offline booklet ${booklet.bookletId} exhausted (Last serial ${booklet.seriesEnd}). Please allocate a new booklet stub.`);
    }

    const assignedSerial = booklet.currentSerial;
    booklet.currentSerial += 1;
    if (booklet.currentSerial > booklet.seriesEnd) {
      booklet.isActive = false;
    }

    await this.registerOfflineBooklet(booklet);

    return {
      receiptNo: String(assignedSerial),
      bookletId: booklet.bookletId
    };
  }

  // ==========================================
  // 3. Offline Payment Outbox Queue
  // ==========================================

  async enqueuePayment(payment: OfflinePaymentItem): Promise<void> {
    if (this.isMemoryMode) {
      this.memPendingPayments.set(payment.id, { ...payment });
      return;
    }

    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('pending_payments', 'readwrite');
      const store = tx.objectStore('pending_payments');
      const request = store.put(payment);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingPayments(): Promise<OfflinePaymentItem[]> {
    if (this.isMemoryMode) {
      return Array.from(this.memPendingPayments.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }

    await this.init();
    if (!this.db) return [];

    return new Promise<OfflinePaymentItem[]>((resolve, reject) => {
      const tx = this.db!.transaction('pending_payments', 'readonly');
      const store = tx.objectStore('pending_payments');
      const request = store.getAll();

      request.onsuccess = () => {
        const items: OfflinePaymentItem[] = request.result || [];
        items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updatePaymentStatus(
    id: string,
    update: Partial<OfflinePaymentItem>
  ): Promise<void> {
    if (this.isMemoryMode) {
      const existing = this.memPendingPayments.get(id);
      if (existing) {
        this.memPendingPayments.set(id, { ...existing, ...update });
      }
      return;
    }

    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('pending_payments', 'readwrite');
      const store = tx.objectStore('pending_payments');
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const item: OfflinePaymentItem = getReq.result;
        if (!item) {
          resolve();
          return;
        }
        const updated = { ...item, ...update };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async clearSyncedPayments(): Promise<number> {
    const items = await this.getPendingPayments();
    const syncedIds = items.filter(i => i.syncStatus === 'SYNCED').map(i => i.id);

    if (this.isMemoryMode) {
      syncedIds.forEach(id => this.memPendingPayments.delete(id));
      return syncedIds.length;
    }

    await this.init();
    if (!this.db) return 0;

    return new Promise<number>((resolve, reject) => {
      const tx = this.db!.transaction('pending_payments', 'readwrite');
      const store = tx.objectStore('pending_payments');

      syncedIds.forEach(id => store.delete(id));

      tx.oncomplete = () => resolve(syncedIds.length);
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const offlineStorage = new OfflineStorage();
