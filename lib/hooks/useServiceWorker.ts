'use client';

import { useEffect, useState } from 'react';

export function useServiceWorker() {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check if service workers are supported
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      setIsSupported(true);

      // Check online/offline status
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Register service worker
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          setIsRegistered(true);
          setRegistration(reg);
          console.log('[SW] Service worker registered:', reg.scope);

          // Check for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[SW] New service worker available. Reload to update.');
                }
              });
            }
          });
        })
        .catch((err) => {
          console.error('[SW] Registration failed:', err);
          setIsRegistered(false);
        });

      // Handle controller change (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW] New service worker activated');
        window.location.reload();
      });

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  return { isSupported, isRegistered, isOnline, registration };
}
