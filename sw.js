// Önbelleğe alınacak dosyaların sürümünü ve listesini tanımlar.
// Yeni bir sürüm yayınladığınızda, uygulamanın güncellenmesi için bu sürüm adını değiştirmeniz önemlidir (örn: v18).
const CACHE_NAME = 'mak-taksit-cache-v17'; 
const urlsToCache = [
  '/',
  '/index.html',
  // Uygulama ikonları
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable.png',
  // Harici Stil ve Font dosyaları (CDN)
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  // Harici JavaScript kütüphaneleri (CDN)
  'https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js',
  'https://cdn.jsdelivr.net/npm/dayjs@1/plugin/customParseFormat.js',
  'https://cdn.jsdelivr.net/npm/dayjs@1/plugin/isSameOrBefore.js',
  'https://cdn.jsdelivr.net/npm/dayjs@1/plugin/isSameOrAfter.js',
  'https://cdn.jsdelivr.net/npm/dayjs@1/plugin/localizedFormat.js',
  'https://cdn.jsdelivr.net/npm/dayjs@1/locale/tr.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  // Manifest dosyası
  '/manifest.json'
];

// 'install' olayı: Service Worker yüklendiğinde tetiklenir.
// Bu adımda, uygulamanın temel dosyaları önbelleğe alınır.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Önbellek açıldı ve dosyalar ekleniyor.');
        return cache.addAll(urlsToCache);
      })
  );
});

// 'activate' olayı: Yeni Service Worker aktif olduğunda tetiklenir.
// Bu adımda, eski önbellekler temizlenir.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// 'fetch' olayı: Uygulama bir dosya (sayfa, resim, script vb.) talep ettiğinde tetiklenir.
// Önce önbellekte bu dosya aranır, bulunursa direkt önbellekten verilir.
// Bulunamazsa, internetten talep edilir.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// 'notificationclick' olayı: Kullanıcı bir bildirime tıkladığında tetiklenir.
// Uygulama penceresi zaten açıksa ona odaklanır, değilse yeni bir pencere açar.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (let client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
