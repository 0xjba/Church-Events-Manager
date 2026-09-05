// Stamped with the build's asset hash by scripts/stamp-sw.mjs, so every deploy
// ships a byte-different worker. That is what makes the browser install the new
// one, and what lets activate() drop the previous build's assets instead of
// letting every release pile up in one cache forever.
const BUILD_ID = '__BUILD_ID__';
const CACHE_NAME = `devotional-events-${BUILD_ID}`;
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event
//
// The page shell is fetched from the network first, because index.html names
// the hashed asset files: serving a cached shell after a deploy would pin the
// browser to the previous release until the cache happened to be cleared.
// Hashed assets themselves never change under a given name, so those come from
// the cache when present.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  // The API is never cached.
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          return response;
        })
        // Offline: the last shell we saw is better than nothing.
        .catch(() => caches.match('/').then((cached) => cached || Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then(async (response) => {
        // A chunk from a previous build no longer exists on the server, and the
        // SPA catch-all answers it with index.html under a 200 and a
        // JavaScript content type. Content type cannot be trusted here, so the
        // body is what gets checked. Caching that would poison the entry for
        // good, and returning it makes the browser parse HTML as a script.
        if (isAsset(event.request.url) && (await looksLikeHtml(response))) {
          return Response.error();
        }

        if (response.status === 200 && !response.headers.get('content-type')?.includes('text/html')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});

const isAsset = (url) => /\.(js|css)$/i.test(new URL(url).pathname);

const looksLikeHtml = async (response) => {
  try {
    const text = await response.clone().text();
    return /^\s*<(!doctype|html)/i.test(text.slice(0, 60));
  } catch {
    return false;
  }
};

// Notification handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Push notification handling
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      url: '/'
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icon-192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Devotional Events', options)
  );
});
