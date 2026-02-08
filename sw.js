// Önbellek (cache) adı ve versiyonu.
// Versiyonu yükselterek tarayıcının yeni dosyaları almasını sağlıyoruz.
const CACHE_NAME = 'emre-bebe-takip-cache-v24'; 

// Uygulama ilk yüklendiğinde veya çevrimdışıyken çalışması için
// önbelleğe alınacak temel dosyaların ve kaynakların listesi.
const urlsToCache = [
  '/', 
  'index.html', 
  'manifest.json', 
  'https://cdn.tailwindcss.com', 
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', 
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap', 
  'https://cdn.jsdelivr.net/npm/apexcharts'
];

// 'install' olayı: Service Worker yüklendiğinde tetiklenir.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache açıldı ve temel dosyalar önbelleğe alınıyor.');
        // Hata oluşsa bile devam etmesi için her birini ayrı ayrı eklemeye çalışıyoruz
        return Promise.all(
            urlsToCache.map(url => {
                return cache.add(url).catch(err => {
                    console.warn(`Önbelleğe eklenemedi: ${url}`, err);
                });
            })
        );
      })
  );
  self.skipWaiting();
});

// 'fetch' olayı
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const isDynamicResource = event.request.url.includes('wttr.in') || 
                            event.request.url.includes('firebase') || 
                            event.request.url.includes('gstatic.com') ||
                            event.request.url.includes('api.telegram.org');

  if (isDynamicResource) {
      event.respondWith(
          fetch(event.request).catch((err) => {
              console.error('Ağ isteği başarısız oldu:', event.request.url, err);
          })
      );
      return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request.clone()).then(
          networkResponse => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
              return networkResponse;
            }
            
            let responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(err => {
             // Fetch hatası (offline durumunda custom page dönebiliriz ama şimdilik logluyoruz)
             console.error('Fetch hatası:', err);
        });
      })
    );
});

// 'activate' olayı: Eski önbellekleri temizler
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME]; 
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Eski cache siliniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});
