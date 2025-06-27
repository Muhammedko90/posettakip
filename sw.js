// Cache adı ve versiyonu
const CACHE_NAME = 'emre-bebe-takip-cache-v2'; // Versiyon güncellendi
// Çevrimdışı mod için önbelleğe alınacak temel dosyalar
const urlsToCache = [
  '/',
  'index.html',
  'manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Service Worker'ı yükle ve temel dosyaları önbelleğe al
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache açıldı ve temel dosyalar ekleniyor.');
        // Önbelleğe alınacak URL'lerden bir tanesi bile başarısız olursa, yükleme başarısız olur.
        // Bu yüzden her bir isteği ayrı ayrı ele alıp hataları yakalamak daha güvenli olabilir.
        const promises = urlsToCache.map(url => {
            return cache.add(url).catch(err => {
                console.warn(`Önbelleğe eklenemedi: ${url}`, err);
            });
        });
        return Promise.all(promises);
      })
  );
});

// Fetch event'lerini dinle ve cache stratejisi uygula
self.addEventListener('fetch', event => {
  // Sadece GET isteklerini işleme al
  if (event.request.method !== 'GET') {
    return;
  }

  // Hava durumu, Firebase ve Google Fonts gibi dinamik kaynaklar için her zaman ağı kullan (network-first)
  // wttr.in adresini bu kurala ekledim.
  if (event.request.url.includes('wttr.in') || event.request.url.includes('firebase') || event.request.url.includes('gstatic.com')) {
      event.respondWith(
          fetch(event.request).catch((err) => {
              console.error('Ağ isteği başarısız oldu:', event.request.url, err);
              // Burada çevrimdışı bir yedek yanıt döndürülebilir.
              // Örneğin, "Çevrimdışı olduğunuz için veri alınamadı" gibi bir JSON objesi.
          })
      );
      return;
  }
  
  // Diğer tüm istekler için önce önbelleğe bak (cache-first)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Eğer kaynak önbellekte varsa, oradan döndür
        if (response) {
          return response;
        }

        // Kaynak önbellekte yoksa, ağdan getirmeye çalış
        return fetch(event.request.clone()).then(
          response => {
            // Geçerli bir cevap alınamazsa veya opak bir cevap ise, önbelleğe almadan döndür
            if (!response || response.status !== 200 || response.type === 'opaque') {
              return response;
            }
            
            // Başarılı cevabı hem tarayıcıya gönder hem de önbelleğe ekle
            let responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(err => {
             console.error('Fetch hatası:', err);
             // Ağ hatası durumunda genel bir çevrimdışı sayfası gösterilebilir.
        });
      })
    );
});

// Eski cache'leri temizle
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME]; // Beyaz listeye yeni cache adını ekledim
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
});
