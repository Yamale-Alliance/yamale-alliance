'use client';

import { useEffect, useCallback } from 'react';

interface QueuedRequest {
  id: string;
  request: Request;
  timestamp: number;
}

const QUEUE_STORAGE_KEY = 'yamale-offline-queue';

export function useOfflineQueue() {
  useEffect(() => {
    // Register background sync if available
    if ('serviceWorker' in navigator && 'sync' in (self as any).ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        // Sync will be triggered automatically when online
      });
    }
  }, []);

  const addToQueue = useCallback(async (request: Request): Promise<void> => {
    if (navigator.onLine) {
      // Try to send immediately
      try {
        const response = await fetch(request);
        if (response.ok) {
          return; // Success, no need to queue
        }
      } catch (error) {
        // Network error, will queue below
      }
    }

    // Queue the request
    const queueItem: QueuedRequest = {
      id: `${Date.now()}-${Math.random()}`,
      request: request.clone(),
      timestamp: Date.now(),
    };

    try {
      const existingQueue = getQueue();
      existingQueue.push(queueItem);
      saveQueue(existingQueue);

      // Request background sync
      if ('serviceWorker' in navigator && 'sync' in (self as any).ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        try {
          await (registration as any).sync.register('sync-requests');
        } catch (err) {
          console.warn('[Queue] Background sync not available:', err);
        }
      }
    } catch (error) {
      console.error('[Queue] Failed to queue request:', error);
    }
  }, []);

  const getQueue = (): QueuedRequest[] => {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const saveQueue = (queue: QueuedRequest[]): void => {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('[Queue] Failed to save queue:', error);
    }
  };

  const clearQueue = useCallback((): void => {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
  }, []);

  return { addToQueue, getQueue, clearQueue };
}
