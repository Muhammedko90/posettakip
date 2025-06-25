// Cache adı ve versiyonu - Her büyük güncellemede versiyonu artırmak önemlidir.
const CACHE_NAME = 'emre-bebe-takip-cache-v4';

// Önbelleğe alınacak ÇEKİRDEK uygulama dosyaları. 
// Bunlar uygulamanın çalışması için zorunlu olanlardır.
const CORE_ASSETS = [
  '/',
  'index.html',
  'manifest.json'
];

// 1. Service Worker'ı Yükleme (Install)
// Bu adım, service worker ilk kez kaydedildiğinde veya güncellendiğinde çalışır.
self.addEventListener('install', event => {
  console.log('[Service Worker] Yükleniyor (v4)...');
  // Yeni service worker'ın eski olanın yerini alması için beklemesini engeller.
  self.skipWaiting(); 
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Çekirdek dosyalar önbelleğe alınıyor.');
        // Çekirdek dosyaları önbelleğe ekler. Bunlardan biri bile indirilemezse kurulum başarısız olur.
        return cache.addAll(CORE_ASSETS);
      })
      .catch(error => {
        console.error('[Service Worker] Çekirdek dosyaları önbelleğe alma başarısız oldu:', error);
      })
  );
});

// 2. Service Worker'ı Aktifleştirme ve Eski Cache'leri Temizleme (Activate)
// Bu adım, yeni service worker kontrolü eline aldığında çalışır.
self.addEventListener('activate', event => {
  console.log('[Service Worker] Aktifleştiriliyor (v4)...');
  const cacheWhitelist = [CACHE_NAME]; // Mevcut cache adını koru
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Eğer cache adı beyaz listede (whitelist) değilse, eski olduğu için sil.
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Eski cache temizleniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    // Yeni service worker'ın tüm açık sekmeleri hemen kontrol etmesini sağlar.
    .then(() => self.clients.claim())
  );
});

// 3. Ağ İsteklerini Yönetme (Fetch) - Stale-While-Revalidate Stratejisi
// Bu, uygulamadan yapılan her ağ isteğini yakalar.
self.addEventListener('fetch', event => {
  const { request } = event;

  // Sadece GET isteklerini işle. Firebase ve chrome-extension isteklerini yoksay.
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension://') || request.url.includes('firestore.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      // 1. Önce önbellekten yanıt vermeye çalış (Hızlı yanıt için)
      return cache.match(request).then(cachedResponse => {
        
        // 2. Arka planda ağı kontrol et ve önbelleği güncelle (Revalidate)
        const fetchPromise = fetch(request).then(networkResponse => {
          // Gelen yanıt geçerliyse, önbelleği güncelle
          if (networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        });

        // 3. Eğer önbellekte yanıt varsa onu hemen döndür, yoksa ağdan gelen yanıtı bekle.
        return cachedResponse || fetchPromise;
      });
    })
  );
});
