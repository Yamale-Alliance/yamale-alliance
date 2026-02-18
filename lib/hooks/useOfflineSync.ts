'use client';

import { useEffect } from 'react';
import { addToQueue, getQueue, removeFromQueue, replayRequest } from '@/lib/offline-queue';

// Hook to handle offline sync for API requests
export function useOfflineSync() {
  useEffect(() => {
    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', async (event) => {
        if (event.data?.type === 'GET_QUEUE_FROM_CLIENT') {
          const queue = await getQueue();
          const port = event.ports?.[0];
          if (port) {
            port.postMessage(queue);
          }
        } else if (event.data?.type === 'REMOVE_FROM_QUEUE') {
          const ids = event.data.ids || [];
          for (const id of ids) {
            await removeFromQueue(id);
          }
        }
      });

      // Try to sync queue when coming back online
      const handleOnline = async () => {
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
      };

      window.addEventListener('online', handleOnline);
      return () => {
        window.removeEventListener('online', handleOnline);
      };
    }
  }, []);

  return { addToQueue };
}
