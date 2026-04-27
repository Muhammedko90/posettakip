/**
 * Firebase bağlantı ayarları - Sadece konfigürasyon
 */
export const firebaseConfig = {
    apiKey: "AIzaSyDsIDN74rIPhYtdaTIkeGcrczxQEjr7-sw",
    authDomain: "emre-bebe-takip.firebaseapp.com",
    projectId: "emre-bebe-takip",
    // Firebase Console > Storage ile aynı olmalı (varsayılan kova adı)
    storageBucket: "emre-bebe-takip.firebasestorage.app",
    messagingSenderId: "174642780473",
    appId: "1:174642780473:web:89c50d5f80612c16e3f0e8"
};

/**
 * Web Push (FCM tarayıcı bildirimi) için VAPID anahtarı.
 *
 * Nasıl alınır:
 *   Firebase Console > Project Settings > Cloud Messaging sekmesi
 *   > Web configuration / Web Push certificates > "Generate key pair"
 *   Üretilen "Key pair" değerini buraya kopyalayın.
 *
 * Bu değer boş kaldığı sürece web tarafı sessizce devre dışı kalır
 * (native Android tarafı bu anahtara ihtiyaç duymaz).
 */
export const fcmVapidKey = "";
