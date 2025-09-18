// Önbellek (cache) adı ve versiyonu.
// Yeni versiyon, eski önbelleğin silinip yenisinin kurulmasını tetikler.
const CACHE_NAME = 'emre-bebe-takip-cache-v5'; 

// Önbelleğe alınacak temel uygulama dosyaları ("App Shell").
const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'script.js',
  'manifest.json',
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
  );
});

// 'fetch' olayı: Uygulamadan yapılan her ağ isteğini yakalar.
self.addEventListener('fetch', event => {
  // Sadece GET isteklerini işleme al.
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Strateji 1: Network First, falling back to Cache (Firebase/Google API'leri için)
  // Bu, her zaman en güncel veriyi almamızı sağlar, çevrimdışıysak önbelleği kullanır.
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Ağ yanıtı başarılıysa, bir kopyasını önbelleğe alıp sonucu döndür.
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
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

  // Strateji 2: Cache First, falling back to Network (Uygulama kabuğu ve diğer statik dosyalar için)
  // Bu, uygulamanın anında yüklenmesini sağlar.
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Önbellekte yanıt varsa, onu kullan.
        if (cachedResponse) {
          return cachedResponse;
        }

        // Önbellekte yoksa, ağdan getir, önbelleğe ekle ve sonucu döndür.
        return fetch(event.request.clone()).then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
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
          // Eğer bir önbellek adı beyaz listede değilse, o eski bir versiyondur ve silinmelidir.
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Eski önbellek siliniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

