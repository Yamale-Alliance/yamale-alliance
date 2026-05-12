'use client';

import { useEffect } from 'react';
import { useServiceWorker } from '@/lib/hooks/useServiceWorker';
import { OfflineIndicator } from './OfflineIndicator';

// Initialize offline sync inline to avoid import issues
function useOfflineSyncSetup() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Set up service worker message listener
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
      } else if (event.data?.type === 'yamale-sync-saved-laws') {
        try {
          const { syncSavedLawsFromNetwork } = await import('@/lib/library-offline-storage');
          void syncSavedLawsFromNetwork();
        } catch (err) {
          console.error('[Sync] Saved laws refresh failed:', err);
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Try to sync queue when coming back online
    const handleOnline = async () => {
      try {
        const { syncSavedLawsFromNetwork } = await import('@/lib/library-offline-storage');
        void syncSavedLawsFromNetwork();
      } catch {
        // ignore
      }
      try {
        const { getQueue, removeFromQueue, replayRequest } = await import('@/lib/offline-queue');
        const queue = await getQueue();
        if (queue.length > 0) {
          console.log('[Sync] Attempting to sync', queue.length, 'queued requests');
          const results = await Promise.allSettled(
            queue.map((item) => replayRequest(item))
          );
          const successful = results
            .map((r, i) => ({ success: r.status === 'fulfilled' && r.value, id: queue[i].id }))
            .filter((r) => r.success);
          for (const item of successful) {
            await removeFromQueue(item.id);
          }
          console.log('[Sync] Synced', successful.length, 'requests');
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

export function OfflineProvider() {
  const { isSupported } = useServiceWorker();
  useOfflineSyncSetup();

  useEffect(() => {
    if (isSupported) {
      console.log('[Offline] Service worker support enabled');
    }
  }, [isSupported]);

  return <OfflineIndicator />;
}
