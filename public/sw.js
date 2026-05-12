// Service Worker for Yamalé Alliance - Offline Mode
const CACHE_VERSION = 'yamale-v2';
const CACHE_NAME = `yamale-cache-${CACHE_VERSION}`;

// Resources to cache on install
const STATIC_CACHE_URLS = [
  '/',
  '/library',
  '/ai-research',
  '/lawyers',
  '/marketplace',
];

// API endpoints to cache (with network-first strategy)
const API_CACHE_PATTERNS = [
  /^\/api\/laws(\?.*)?$/,
  /^\/api\/laws\/[^/]+$/,
  /^\/api\/ai\/chats$/,
  /^\/api\/bookmarks$/,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_CACHE_URLS.map(url => new Request(url, { cache: 'reload' }))).catch((err) => {
        console.warn('[SW] Failed to cache some static assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - implement cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Clerk authentication domains (iframes, popups, etc.)
  if (url.hostname.includes('clerk.') || url.hostname.includes('clerk.com') || url.hostname.includes('clerk.dev') || url.hostname.includes('clerk.accounts')) {
    return;
  }

  // Skip navigation requests (let browser handle page navigation)
  if (request.mode === 'navigate' || request.destination === 'document') {
    return;
  }

  // Skip cross-origin requests (except our API)
  if (url.origin !== self.location.origin && !url.pathname.startsWith('/api/')) {
    return;
  }

  // Skip Clerk API endpoints
  if (url.pathname.startsWith('/api/clerk') || url.pathname.includes('clerk')) {
    return;
  }

  // Network-first strategy for API endpoints (laws, chats)
  if (API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname + url.search))) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Cache-first strategy for static assets (only specific paths)
  if (STATIC_CACHE_URLS.some(path => url.pathname === path || url.pathname.startsWith(path + '/'))) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Don't intercept other requests - let them pass through normally
  return;
});

// Network-first strategy: try network, fallback to cache
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // If offline and no cache, return a basic offline response
    if (request.url.includes('/api/')) {
      return new Response(
        JSON.stringify({ error: 'Offline', offline: true }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    throw error;
  }
}

// Cache-first strategy: try cache, fallback to network
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Cache and network failed:', request.url);
    throw error;
  }
}

// Background sync for failed POST/PUT/DELETE requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-requests') {
    event.waitUntil(syncPendingRequests());
  }
  if (event.tag === 'yamale-saved-laws') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          try {
            client.postMessage({ type: 'yamale-sync-saved-laws' });
          } catch (e) {
            console.warn('[SW] Client message failed:', e);
          }
        });
      })
    );
  }
});

async function syncPendingRequests() {
  try {
    // Request queue from clients via postMessage
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    if (clients.length === 0) return;

    // Ask clients for their queue
    const queuePromises = clients.map((client) => {
      return new Promise((resolve) => {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data);
        };
        client.postMessage({ type: 'GET_QUEUE' }, [messageChannel.port2]);
        // Timeout after 1 second
        setTimeout(() => resolve([]), 1000);
      });
    });

    const queues = await Promise.all(queuePromises);
    const allQueued = queues.flat().filter(Boolean);
    if (allQueued.length === 0) return;

    console.log('[SW] Syncing', allQueued.length, 'pending requests');
    const results = await Promise.allSettled(
      allQueued.map(async (item) => {
        try {
          const init = {
            method: item.method,
            headers: item.headers,
          };
          if (item.body && (item.method === 'POST' || item.method === 'PUT' || item.method === 'PATCH')) {
            init.body = item.body;
          }
          const response = await fetch(item.url, init);
          if (response.ok) {
            return { success: true, id: item.id };
          }
          return { success: false, id: item.id, error: 'Response not ok' };
        } catch (error) {
          return { success: false, id: item.id, error: error.message };
        }
      })
    );

    // Notify clients to remove successful requests
    const successfulIds = results
      .filter((r) => r.status === 'fulfilled' && r.value.success)
      .map((r) => r.value.id);

    if (successfulIds.length > 0) {
      clients.forEach((client) => {
        client.postMessage({ type: 'REMOVE_FROM_QUEUE', ids: successfulIds });
      });
    }

    console.log('[SW] Sync complete. Synced:', successfulIds.length, 'Remaining:', allQueued.length - successfulIds.length);
  } catch (error) {
    console.error('[SW] Sync error:', error);
  }
}

// Message handler for queue management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return Promise.all(
          urls.map((url) =>
            fetch(url)
              .then((response) => cache.put(url, response))
              .catch((err) => console.warn('[SW] Failed to cache:', url, err))
          )
        );
      })
    );
  } else if (event.data && event.data.type === 'GET_QUEUE') {
    // Client is asking for queue - respond via message channel
    const port = event.ports[0];
    if (port) {
      // We'll get the queue from clients via postMessage
      event.waitUntil(
        self.clients.matchAll().then((clients) => {
          if (clients.length > 0) {
            const messageChannel = new MessageChannel();
            messageChannel.port1.onmessage = (e) => {
              port.postMessage(e.data);
            };
            clients[0].postMessage({ type: 'GET_QUEUE_FROM_CLIENT' }, [messageChannel.port2]);
          } else {
            port.postMessage([]);
          }
        })
      );
    }
  }
});
