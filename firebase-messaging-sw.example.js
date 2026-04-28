/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging - Arka plan service worker'ı.
 *
 * Bu dosyayı "firebase-messaging-sw.js" olarak kopyalayın ve aşağıdaki
 * firebase.initializeApp(...) bloğunu Firebase Console’daki web uygulaması
 * yapılandırmasıyla doldurun (assets/js/firebase-config.js ile aynı değerler).
 *
 * Yerel dosya .gitignore altında tutulur; gerçek anahtarları commitlemeyin.
 */

importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "YOUR_WEB_API_KEY",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.firebasestorage.app",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000000000"
});

const messaging = firebase.messaging();

function resolveTag(type) {
    switch (type) {
        case 'new_bag':
        case 'poset_eklendi':
            return 'poset_yeni';
        case 'delivered':
        case 'poset_teslim':
            return 'poset_teslim';
        default:
            return 'poset_genel';
    }
}

messaging.onBackgroundMessage((payload) => {
    const data = payload && payload.data ? payload.data : {};
    const title = data.title || 'Poşet Takip';
    const body = data.body || '';
    const tag = resolveTag(data.type);

    return self.registration.showNotification(title, {
        body,
        tag,
        renotify: true,
        icon: 'https://placehold.co/192x192/1e293b/ffffff?text=EMRE',
        badge: 'https://placehold.co/96x96/1e293b/ffffff?text=PT',
        data: data,
        requireInteraction: false
    });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || '/';

    event.waitUntil((async () => {
        const allClients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        });
        for (const client of allClients) {
            try {
                const clientUrl = new URL(client.url);
                if (clientUrl.origin === self.location.origin && 'focus' in client) {
                    if (event.notification.data) {
                        client.postMessage({
                            type: 'fcm-notification-click',
                            payload: event.notification.data
                        });
                    }
                    return client.focus();
                }
            } catch (_) { /* ignore */ }
        }
        if (self.clients.openWindow) {
            return self.clients.openWindow(targetUrl);
        }
        return null;
    })());
});
