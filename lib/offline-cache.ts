import type { AshaOverview, DoctorOverview } from '@/lib/overview-types';

/**
 * Lightweight, zero-dependency IndexedDB cache for ASHA & Doctor overview snapshots.
 * Enables instant first render and offline resilience (stale-while-revalidate):
 * cached data is shown immediately when offline or while revalidating, and refreshed
 * automatically once connectivity returns.
 */

const DB_NAME = 'asha-saathi-cache';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';

const ASHA_KEY = 'asha-overview';
const DOCTOR_KEY = 'doctor-overview';

export interface CachedAshaOverview {
  key: typeof ASHA_KEY;
  data: AshaOverview;
  cachedAt: string;
}

export interface CachedDoctorOverview {
  key: typeof DOCTOR_KEY;
  data: DoctorOverview;
  cachedAt: string;
}

type StoredSnapshot = CachedAshaOverview | CachedDoctorOverview;

function hasIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openCacheDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readRecord(key: typeof ASHA_KEY | typeof DOCTOR_KEY): Promise<StoredSnapshot | null> {
  const db = await openCacheDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key) as IDBRequest<StoredSnapshot | undefined>;
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

async function writeRecord(record: StoredSnapshot): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function readCachedAshaOverview(): Promise<CachedAshaOverview | null> {
  const record = await readRecord(ASHA_KEY);
  if (record && record.key === ASHA_KEY) return record;
  return null;
}

export async function writeCachedAshaOverview(data: AshaOverview): Promise<void> {
  await writeRecord({ key: ASHA_KEY, data, cachedAt: new Date().toISOString() });
}

export async function readCachedDoctorOverview(): Promise<CachedDoctorOverview | null> {
  const record = await readRecord(DOCTOR_KEY);
  if (record && record.key === DOCTOR_KEY) return record;
  return null;
}

export async function writeCachedDoctorOverview(data: DoctorOverview): Promise<void> {
  await writeRecord({ key: DOCTOR_KEY, data, cachedAt: new Date().toISOString() });
}

/** Clear all cached snapshots (call on sign-out or 401/403 session expiry). */
export async function clearOfflineCache(): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}
