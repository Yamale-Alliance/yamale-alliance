# Offline Mode Implementation

## Overview

Yamalé Alliance now supports offline mode with service worker caching, background sync, and an offline indicator UI.

## Features

### 1. Service Worker (`public/sw.js`)
- **Network-first strategy** for API endpoints (`/api/laws`, `/api/ai/chats`)
- **Cache-first strategy** for static pages
- Automatic cache versioning and cleanup
- Background sync for failed requests

### 2. Cache Strategy

#### Laws API (`/api/laws`, `/api/laws/[id]`)
- Network-first: Try network, fallback to cache
- Successful responses are cached automatically
- Offline users see cached law data

#### AI Chats (`/api/ai/chats`)
- Network-first: Try network, fallback to cache
- Chat history cached for offline access

#### Static Pages
- Cache-first: Serve from cache, update in background
- Pages: `/`, `/library`, `/ai-research`, `/lawyers`, `/marketplace`

### 3. Offline Indicator (`components/offline/OfflineIndicator.tsx`)
- Shows "You're offline" banner when disconnected
- Shows "Back online" message when connection restored
- Auto-dismisses after 3 seconds when back online

### 4. Background Sync (`lib/offline-queue.ts`)
- Failed POST/PUT/DELETE requests are queued in IndexedDB
- Automatically retried when connection is restored
- Uses Background Sync API when available
- Fallback to manual sync on `online` event

## Usage

### For Users
- **Automatic**: Service worker registers automatically on first visit
- **Offline browsing**: Previously viewed laws and chats are available offline
- **Queue actions**: Failed actions (bookmarks, reviews, etc.) are queued and synced when online

### For Developers

#### Adding Offline Support to New API Calls

```typescript
import { addToQueue } from '@/lib/offline-queue';

async function saveBookmark(lawId: string) {
  const request = new Request('/api/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ law_id: lawId }),
  });

  try {
    const response = await fetch(request);
    if (!response.ok) throw new Error('Failed');
    return response.json();
  } catch (error) {
    if (!navigator.onLine) {
      await addToQueue(request);
      // Show user-friendly message
      return { queued: true };
    }
    throw error;
  }
}
```

#### Checking Online Status

```typescript
import { useServiceWorker } from '@/lib/hooks/useServiceWorker';

function MyComponent() {
  const { isOnline } = useServiceWorker();
  
  if (!isOnline) {
    return <div>Offline mode - limited functionality</div>;
  }
  // ...
}
```

## Technical Details

### Service Worker Registration
- Registered in `OfflineProvider` component
- Scope: `/` (entire app)
- Auto-updates when new version is available

### Cache Storage
- Cache name: `yamale-cache-v1`
- Old caches cleaned up on activation
- Cache size managed by browser

### Queue Storage
- Uses IndexedDB (`yamale-offline-queue` database)
- Stores: URL, method, headers, body, timestamp
- Automatically synced when online

### Browser Support
- **Service Workers**: Chrome, Firefox, Safari 11.1+, Edge
- **Background Sync**: Chrome, Edge (fallback to manual sync on others)
- **IndexedDB**: All modern browsers

## Testing

1. **Test offline mode**:
   - Open DevTools → Network → Throttling → Offline
   - Navigate to previously viewed pages
   - Verify cached content loads

2. **Test background sync**:
   - Go offline
   - Perform an action (e.g., bookmark a law)
   - Go back online
   - Verify action completes automatically

3. **Test cache**:
   - View a law page
   - Go offline
   - Reload page
   - Verify law content loads from cache

## Limitations

- **AI chat responses**: Cannot be generated offline (requires API)
- **New content**: Not available offline until cached
- **Large files**: Marketplace downloads not cached
- **Real-time updates**: Not available offline

## Future Enhancements

- [ ] Pre-cache popular laws on install
- [ ] Cache marketplace item metadata
- [ ] Offline search functionality
- [ ] Cache size management UI
- [ ] Manual cache clear option
