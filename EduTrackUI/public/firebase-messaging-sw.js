importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Firebase config is injected at build time by the Vite plugin in vite.config.ts.
// The API key is kept in .env.local (gitignored) and never hardcoded here.
const firebaseConfig = {
  apiKey: self.firebaseConfig?.apiKey || "__FIREBASE_API_KEY__",
  authDomain: "marantha-tokens.firebaseapp.com",
  projectId: "marantha-tokens",
  storageBucket: "marantha-tokens.firebasestorage.app",
  messagingSenderId: "698012186285",
  appId: "1:698012186285:web:8088d5d54e561d90397824"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

function buildNotificationTag(payload) {
  const data = payload?.data || {};

  // Prefer backend IDs so retries update the same card, but different events stack.
  if (data.notification_id) return `mca-notif-${data.notification_id}`;
  if (data.entity_type && data.entity_id) return `mca-${data.entity_type}-${data.entity_id}`;
  if (data.type && data.payment_id) return `mca-${data.type}-${data.payment_id}`;
  if (data.type && data.installment_plan_id) return `mca-${data.type}-${data.installment_plan_id}`;

  // Fallback: unique tag so unrelated pushes do not overwrite each other.
  return `mca-notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message ', payload);

  const notificationTitle = payload?.notification?.title || payload?.data?.title || 'New Notification';
  const notificationTag = buildNotificationTag(payload);
  const notificationOptions = {
    body: payload?.notification?.body || payload?.data?.body || 'You have a new update.',
    icon: '/icon-192x192.png', // Update with your icon path
    badge: '/icon-192x192.png',
    data: payload?.data || {},
    tag: notificationTag,
    renotify: false,
  };

  if (typeof self.registration.setAppBadge === 'function') {
    self.registration.setAppBadge(1).catch(() => {});
  }

  // Notify open tabs so they can refresh notification queries immediately.
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'PUSH_NOTIFICATION_RECEIVED', payload: payload || null });
    });
  });

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const actionUrl = event.notification?.data?.action_url || '/';
  const targetUrl = new URL(actionUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    })
  );
});