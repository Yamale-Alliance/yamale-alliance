'use client';

import { useEffect } from 'react';
import { OfflineIndicator } from './OfflineIndicator';

// Initialize offline sync inline to avoid import issues
function useOfflineSyncSetup() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'GET_QUEUE_FROM_CLIENT') {
        try {
          const { getQueue } = await import('@/lib/offline-queue');
          const queue = await getQueue();
          const port = event.ports?.[0];
          if (port) {
            port.postMessage(queue);
          }
        } catch (err) {
          console.error('[Sync] Failed to get queue:', err);
        }
      } else if (event.data?.type === 'REMOVE_FROM_QUEUE') {
        try {
          const { removeFromQueue } = await import('@/lib/offline-queue');
          const ids = event.data.ids || [];
          for (const id of ids) {
            await removeFromQueue(id);
          }
        } catch (err) {
          console.error('[Sync] Failed to remove from queue:', err);
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    const handleOnline = async () => {
      try {
        const { getQueue, removeFromQueue, replayRequest } = await import('@/lib/offline-queue');
        const queue = await getQueue();
        if (queue.length > 0) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[Sync] Attempting to sync', queue.length, 'queued requests');
          }
          const results = await Promise.allSettled(queue.map((item) => replayRequest(item)));
          const successful = results
            .map((r, i) => ({ success: r.status === 'fulfilled' && r.value, id: queue[i].id }))
            .filter((r) => r.success);
          for (const item of successful) {
            await removeFromQueue(item.id);
          }
          if (process.env.NODE_ENV !== 'production') {
            console.log('[Sync] Synced', successful.length, 'requests');
          }
        }
      } catch (err) {
        console.error('[Sync] Failed to sync:', err);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
}

/** Offline UI + sync setup. Service worker registration lives in OfflineIndicator only. */
export function OfflineProvider() {
  useOfflineSyncSetup();
  return <OfflineIndicator />;
}
