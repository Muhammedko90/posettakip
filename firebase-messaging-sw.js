/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging - Arka plan service worker'ı.
 *
 * Sayfa kapalıyken / sekme arka plandayken gelen push mesajlarını yakalar
 * ve native Notification API'si ile bildirim olarak gösterir.
 *
 * NOT: Bu dosya MUTLAKA site kökünde (https://.../firebase-messaging-sw.js)
 * servis edilmelidir; alt klasöre konursa Firebase SDK bulamaz.
 *
 * Service Worker ortamında ES module / dynamic import desteği tutarsız olduğu
 * için Firebase'in "compat" sürümlerini importScripts ile yüklüyoruz.
 */

importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDsIDN74rIPhYtdaTIkeGcrczxQEjr7-sw",
    authDomain: "emre-bebe-takip.firebaseapp.com",
    projectId: "emre-bebe-takip",
    storageBucket: "emre-bebe-takip.firebasestorage.app",
    messagingSenderId: "174642780473",
    appId: "1:174642780473:web:89c50d5f80612c16e3f0e8"
});

const messaging = firebase.messaging();

// Native Android tarafıyla aynı kanal id mantığı.
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

/**
 * Sunucudan SADECE "data" payload'u gönderildiğinde tetiklenir.
 * "notification" payload'u kullanılırsa tarayıcı bildirimi otomatik gösterir
 * ve bu callback çalışmaz – tutarlı kontrol için data-only önerilir.
 */
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

/**
 * Bildirime tıklandığında uygulamayı aç (varsa odakla, yoksa yeni sekme aç).
 */
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
