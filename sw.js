// Önbellek (cache) adı ve versiyonu.
// Yeni versiyon, eski önbelleğin silinip yenisinin kurulmasını tetikler.
const CACHE_NAME = 'emre-bebe-takip-cache-v6'; 

// Önbelleğe alınacak temel uygulama dosyaları. Göreli yollar kullanıldı.
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// 'install' olayı: Service Worker yüklendiğinde çalışır.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Önbellek açıldı, temel dosyalar ekleniyor.');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] Önbelleğe ekleme başarısız oldu:', error);
      })
  );
});

// 'fetch' olayı: Uygulamadan yapılan her ağ isteğini yakalar.
self.addEventListener('fetch', event => {
  // Sadece GET isteklerini işleme al.
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Strateji 1: Network First (Firebase/Google API'leri için)
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Ağ yanıtı başarılıysa, bir kopyasını önbelleğe alıp sonucu döndür.
          if (networkResponse.ok) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Ağ başarısız olursa, önbellekten yanıt vermeyi dene.
          console.warn(`[Service Worker] Ağ hatası, ${url.href} için önbellek kontrol ediliyor.`);
          return caches.match(event.request);
        })
    );
    return;
  }

  // Strateji 2: Cache First (Diğer tüm dosyalar için)
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Önbellekte varsa, onu kullan.
        if (cachedResponse) {
          return cachedResponse;
        }

        // Önbellekte yoksa, ağdan getir ve önbelleğe ekle.
        return fetch(event.request.clone()).then(networkResponse => {
          if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
  );
});

// 'activate' olayı: Yeni Service Worker aktif olduğunda çalışır.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME]; // Sadece mevcut versiyonun önbelleğini koru.
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Eski önbellek siliniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

