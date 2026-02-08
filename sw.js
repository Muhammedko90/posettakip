// Önbellek (cache) adı ve versiyonu.
const CACHE_NAME = 'emre-bebe-takip-cache-v22'; // Versiyonu v22 olarak güncelledim

// Uygulama ilk yüklendiğinde veya çevrimdışıyken çalışması için
// önbelleğe alınacak temel dosyaların ve kaynakların listesi.
const urlsToCache = [
  '/', // Ana dizini temsil eder.
  'index.html', // Ana HTML dosyası.
  'manifest.json', // PWA manifest dosyası.
  'https://cdn.tailwindcss.com', // Stil için kullanılan TailwindCSS.
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', // PDF oluşturma kütüphanesi.
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', // PDF tablo eklentisi.
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap', // Google Fonts.
  'https://cdn.jsdelivr.net/npm/apexcharts' // ApexCharts grafik kütüphanesi
];

// 'install' olayı: Service Worker yüklendiğinde tetiklenir.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache açıldı ve temel dosyalar önbelleğe alınıyor.');
        const promises = urlsToCache.map(url => {
            return cache.add(url).catch(err => {
                console.warn(`Önbelleğe eklenemedi: ${url}`, err);
            });
        });
        return Promise.all(promises);
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
                            event.request.url.includes('gstatic.com');

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
             console.error('Fetch hatası:', err);
        });
      })
    );
});

// 'activate' olayı
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
