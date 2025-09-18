// Önbellek (cache) adı ve versiyonu.
// Uygulamada büyük bir değişiklik yaptığınızda (örn. CSS veya JS dosyalarını güncellediğinizde)
// bu versiyonu ('v4', 'v5' gibi) değiştirerek eski önbelleğin silinip yenisinin kurulmasını sağlarsınız.
const CACHE_NAME = 'emre-bebe-takip-cache-v4'; // Versiyonu güncelledim

// Uygulama ilk yüklendiğinde veya çevrimdışıyken çalışması için
// önbelleğe alınacak temel dosyaların ve kaynakların listesi.
const urlsToCache = [
  '/', // Ana dizini temsil eder.
  'index.html', // Ana HTML dosyası.
  'style.css', // UYGULAMANIN ÇALIŞMASI İÇİN EKLENDİ
  'script.js', // UYGULAMANIN ÇALIŞMASI İÇİN EKLENDİ
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
        // Bütün dosyaları tek seferde eklemeyi deneyelim. Bu daha güvenilirdir.
        return cache.addAll(urlsToCache);
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
  
  // Strateji: Cache First (Önce Önbellek), sonra ağa git.
  // Bu strateji, uygulamayı çok daha hızlı açar ve çevrimdışı çalışmasını sağlar.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Eğer kaynak önbellekte varsa, doğrudan önbellekten döndürürüz.
        if (response) {
          return response;
        }

        // Kaynak önbellekte yoksa, ağdan getirmeye çalışırız.
        // Firebase ve gstatic istekleri gibi dinamik içerikler de bu bloğa girecek
        // ve her zaman ağdan güncel olarak getirilip önbelleğe alınacaktır.
        return fetch(event.request.clone()).then(
          networkResponse => {
            // Geçerli bir cevap alınamazsa (örn. hata kodu), önbelleğe almadan döndürürüz.
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            // Başarılı cevabı hem tarayıcıya göndeririz hem de bir kopyasını ileride kullanmak üzere önbelleğe alırız.
            let responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                // Sadece http/https ile başlayan istekleri önbelleğe al (chrome-extension:// gibi istekleri hariç tut)
                if(event.request.url.startsWith('http')) {
                    cache.put(event.request, responseToCache);
                }
              });

            return networkResponse;
          }
        ).catch(err => {
             console.error('Fetch hatası:', err);
             // Ağ hatası durumunda, isteğe bağlı olarak genel bir çevrimdışı sayfası gösterilebilir.
             // return caches.match('offline.html');
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
