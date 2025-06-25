// Cache adı ve versiyonu
const CACHE_NAME = 'emre-bebe-takip-cache-v2'; // Versiyonu artırarak eski cache'in temizlenmesini sağlıyoruz
// Çevrimdışı mod için önbelleğe alınacak temel dosyalar
const urlsToCache = [
  '/',
  'index.html',
  'manifest.json',
  // Temel kütüphaneler
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  // YENİ EKLENEN UYGULAMA İKONLARI
  'https://i.imgur.com/k4x9YAL.png', // manifest.json içinde kullanılan ikon
  'https://i.imgur.com/VvBwWzV.png'   // index.html içinde kullanılan apple-touch-icon
];

// Service Worker'ı yükle ve temel dosyaları önbelleğe al
self.addEventListener('install', event => {
  // skipWaiting() yeni service worker'ın beklemeden aktif olmasını sağlar
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache açıldı ve temel dosyalar ekleniyor.');
        return cache.addAll(urlsToCache);
      })
  );
});

// Eski cache'leri temizle
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Eski cache temizleniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Yeni service worker'ın tüm açık client'ları kontrol etmesini sağlar
  );
});

// Fetch event'lerini dinle ve cache stratejisi uygula
self.addEventListener('fetch', event => {
  // Sadece GET isteklerini işleme al ve chrome-extension isteklerini yoksay
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Firebase istekleri için ağa gitmesine izin ver
  if (event.request.url.includes('firebase') || event.request.url.includes('firestore.googleapis.com')) {
      return;
  }
  
  // Diğer tüm istekler için önce önbelleğe bak (Cache-First Stratejisi)
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Eğer kaynak önbellekte varsa, oradan döndür
        if (cachedResponse) {
          return cachedResponse;
        }

        // Kaynak önbellekte yoksa, ağdan getirmeye çalış
        return fetch(event.request).then(
          networkResponse => {
            // Geçerli bir cevap alınamazsa, olduğu gibi döndür
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            // Başarılı cevabı hem tarayıcıya gönder hem de önbelleğe ekle
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        );
      })
    );
});
