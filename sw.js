// Önbellek (cache) adı ve versiyonu.
// Versiyonu yükselterek tarayıcının yeni dosyaları almasını sağlıyoruz.
const CACHE_NAME = 'emre-bebe-takip-cache-v42';

// Sadece aynı kaynak (origin) dosyaları önbelleğe alınır.
// Harici CDN'ler CORS vermediği için cache.add ile eklenemez; index.html zaten script ile yükler.
// Not: '/' kökünü önbelleğe almak GitHub Pages (/kullanici/repo/) altında yanlış sayfayı cache'ler.
const urlsToCache = [
  'index.html',
  'manifest.json',
  'assets/css/styles.css?v=53',
  'assets/js/gradient-border.js?v=1'
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

  // Uygulama JS'i (telegram bot vb.) SW önbelleğinde kalırsa eski kod çalışır; her zaman önce ağdan dene.
  try {
    const reqUrl = new URL(event.request.url);
    const p = reqUrl.pathname;
    if (p.endsWith('.js') && p.includes('/assets/js/')) {
      event.respondWith(
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) return networkResponse;
            return caches.match(event.request).then((cached) => cached || networkResponse);
          })
          .catch(() => caches.match(event.request))
      );
      return;
    }
  } catch (_) { /* pathname yoksa varsayılan akış */ }
  
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
            try {
              const putPath = new URL(event.request.url).pathname;
              if (putPath.endsWith('.js') && putPath.includes('/assets/js/')) {
                return networkResponse;
              }
            } catch (_) { /* yaz */ }

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
