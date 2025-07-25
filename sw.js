// Önbellek (cache) adı ve versiyonu.
// Uygulamada büyük bir değişiklik yaptığınızda (örn. CSS veya JS dosyalarını güncellediğinizde)
// bu versiyonu ('v3', 'v4' gibi) değiştirerek eski önbelleğin silinip yenisinin kurulmasını sağlarsınız.
const CACHE_NAME = 'emre-bebe-takip-cache-v3'; // Versiyonu güncelledim

// Uygulama ilk yüklendiğinde veya çevrimdışıyken çalışması için
// önbelleğe alınacak temel dosyaların ve kaynakların listesi.
const urlsToCache = [
  '/', // Ana dizini temsil eder.
  'index.html', // Ana HTML dosyası.
  'manifest.json', // PWA manifest dosyası.
  'https://cdn.tailwindcss.com', // Stil için kullanılan TailwindCSS.
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', // PDF oluşturma kütüphanesi.
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', // PDF tablo eklentisi.
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' // Google Fonts.
];

// 'install' olayı: Service Worker yüklendiğinde tetiklenir.
// Bu aşamada, uygulamanın çevrimdışı çalışması için gerekli olan temel dosyaları önbelleğe alırız.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache açıldı ve temel dosyalar önbelleğe alınıyor.');
        // Her bir URL'yi ayrı ayrı önbelleğe eklemeye çalışırız.
        // Bu, bir URL'de hata olsa bile diğerlerinin eklenmesine olanak tanır.
        const promises = urlsToCache.map(url => {
            return cache.add(url).catch(err => {
                console.warn(`Önbelleğe eklenemedi: ${url}`, err);
            });
        });
        return Promise.all(promises);
      })
  );
});

// 'fetch' olayı: Uygulama bir kaynak (dosya, resim, API isteği vb.) talep ettiğinde tetiklenir.
// Bu olay, ağ isteklerini yakalayıp nasıl yanıt verileceğini kontrol etmemizi sağlar.
self.addEventListener('fetch', event => {
  // Sadece GET (veri alma) isteklerini işleme alıyoruz.
  if (event.request.method !== 'GET') {
    return;
  }

  // Strateji 1: Network First (Önce Ağ)
  // Sürekli güncel olması gereken kaynaklar (API'ler gibi) için önce ağdan getirmeyi deneriz.
  const isDynamicResource = event.request.url.includes('wttr.in') || 
                            event.request.url.includes('firebase') || 
                            event.request.url.includes('gstatic.com');

  if (isDynamicResource) {
      event.respondWith(
          fetch(event.request).catch((err) => {
              console.error('Ağ isteği başarısız oldu:', event.request.url, err);
              // İsteğe bağlı: Çevrimdışı durum için özel bir yanıt döndürülebilir.
          })
      );
      return;
  }
  
  // Strateji 2: Cache First (Önce Önbellek)
  // Diğer tüm statik kaynaklar (HTML, CSS, JS dosyaları) için önce önbelleğe bakarız.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Eğer kaynak önbellekte varsa, doğrudan önbellekten döndürürüz.
        if (response) {
          return response;
        }

        // Kaynak önbellekte yoksa, ağdan getirmeye çalışırız.
        return fetch(event.request.clone()).then(
          networkResponse => {
            // Geçerli bir cevap alınamazsa (örn. hata kodu), önbelleğe almadan döndürürüz.
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
              return networkResponse;
            }
            
            // Başarılı cevabı hem tarayıcıya göndeririz hem de bir kopyasını ileride kullanmak üzere önbelleğe alırız.
            let responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(err => {
             console.error('Fetch hatası:', err);
             // Ağ hatası durumunda genel bir çevrimdışı sayfası gösterilebilir.
        });
      })
    );
});

// 'activate' olayı: Yeni Service Worker aktif olduğunda tetiklenir.
// Bu aşama, eski ve gereksiz önbellekleri temizlemek için en uygun yerdir.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME]; // Sadece mevcut versiyonun önbelleğini koru.
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Eğer bir önbellek adı beyaz listede değilse, o eski bir versiyondur ve silinmelidir.
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Eski cache siliniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
