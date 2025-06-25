// Cache adı ve versiyonu - Her güncellemede versiyonu artırmak önemlidir.
const CACHE_NAME = 'emre-bebe-takip-cache-v3';

// Önbelleğe alınacak ÇEKİRDEK uygulama dosyaları.
// Harici URL'leri (imgur gibi) buradan kaldırdık çünkü kurulumu riskli hale getirebilirler.
// Bu dosyalar ilk ağ isteğinde önbelleğe alınacak.
const CORE_ASSETS = [
  '/',
  'index.html',
  'manifest.json'
];

// 1. Service Worker'ı Yükleme (Install)
self.addEventListener('install', event => {
  console.log('[Service Worker] Yükleniyor...');
  // Yeni service worker'ın beklemeden aktif olmasını sağlar.
  self.skipWaiting(); 
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Çekirdek dosyalar önbelleğe alınıyor.');
        return cache.addAll(CORE_ASSETS);
      })
      .catch(error => {
        console.error('[Service Worker] Çekirdek dosyaları önbelleğe alma başarısız oldu:', error);
      })
  );
});

// 2. Service Worker'ı Aktifleştirme ve Eski Cache'leri Temizleme (Activate)
self.addEventListener('activate', event => {
  console.log('[Service Worker] Aktifleştiriliyor...');
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Eğer cache adı beyaz listede değilse, sil.
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Eski cache temizleniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    // Yeni service worker'ın tüm açık sekmeleri kontrol etmesini sağlar.
    .then(() => self.clients.claim())
  );
});

// 3. Ağ İsteklerini Yönetme (Fetch)
self.addEventListener('fetch', event => {
  const { request } = event;

  // Sadece GET isteklerini işle. Firebase ve chrome-extension isteklerini yoksay.
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension://') || request.url.includes('firestore.googleapis.com')) {
    return;
  }

  // Strateji: Önce Cache, sonra Ağ (Cache First, fallback to Network)
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(request).then(cachedResponse => {
        // Kaynak cache'de varsa, cache'den ver.
        if (cachedResponse) {
          // console.log(`[Service Worker] Cache'den bulundu: ${request.url}`);
          return cachedResponse;
        }

        // Kaynak cache'de yoksa, ağdan getirmeye çalış.
        return fetch(request).then(networkResponse => {
          // console.log(`[Service Worker] Ağdan getirildi: ${request.url}`);
          
          // Gelen yanıtı klonla ve cache'e ekle.
          // Bu sayede bir sonraki istekte aynı kaynak cache'den gelir.
          // Bu, Imgur ikonlarınızın da ilk ziyaretten sonra önbelleğe alınmasını sağlar.
          cache.put(request, networkResponse.clone());

          // Yanıtı tarayıcıya döndür.
          return networkResponse;
        }).catch(error => {
          console.error(`[Service Worker] Ağ isteği başarısız oldu: ${request.url}`, error);
          // İsteğe bağlı olarak burada genel bir çevrimdışı sayfası döndürebilirsiniz.
        });
      });
    })
  );
});
