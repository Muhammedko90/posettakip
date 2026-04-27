/**
 * Bu dosyayı "firebase-config.js" olarak kopyalayın ve Firebase Console’daki
 * Proje ayarları > Genel > Uygulamalar bölümünden web uygulaması yapılandırmasını
 * yapıştırın. Bu örnek repoda tutulur; gerçek anahtarlar asla commitlemeyin.
 */
export const firebaseConfig = {
    apiKey: "YOUR_WEB_API_KEY",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.firebasestorage.app",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000000000"
};

/**
 * Web Push (FCM) VAPID — Firebase Console > Cloud Messaging > Web Push certificates
 */
export const fcmVapidKey = "";
