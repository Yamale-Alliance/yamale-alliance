// Offline queue management using IndexedDB
const DB_NAME = 'yamale-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'requests';

interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  timestamp: number;
}

let db: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

export async function addToQueue(request: Request): Promise<void> {
  try {
    const database = await initDB();
    const body = await request.clone().text().catch(() => null);
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const queued: QueuedRequest = {
      id: `${Date.now()}-${Math.random()}`,
      url: request.url,
      method: request.method,
      headers,
      body,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(queued);

      request.onsuccess = () => {
        resolve();
        // Request background sync
        if ('serviceWorker' in navigator && 'sync' in (self as any).ServiceWorkerRegistration.prototype) {
          navigator.serviceWorker.ready.then((registration) => {
            (registration as any).sync.register('sync-requests').catch(() => {
              // Background sync not available
            });
          });
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Queue] Failed to add to queue:', error);
  }
}

export async function getQueue(): Promise<QueuedRequest[]> {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Queue] Failed to get queue:', error);
    return [];
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Queue] Failed to remove from queue:', error);
  }
}

export async function clearQueue(): Promise<void> {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Queue] Failed to clear queue:', error);
  }
}

export async function replayRequest(queued: QueuedRequest): Promise<boolean> {
  try {
    const init: RequestInit = {
      method: queued.method,
      headers: queued.headers,
    };
    if (queued.body && (queued.method === 'POST' || queued.method === 'PUT' || queued.method === 'PATCH')) {
      init.body = queued.body;
    }

    const response = await fetch(queued.url, init);
    return response.ok;
  } catch (error) {
    console.error('[Queue] Failed to replay request:', error);
    return false;
  }
}
