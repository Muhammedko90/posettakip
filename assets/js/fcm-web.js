/**
 * Firebase Cloud Messaging - Web SDK + Capacitor Bridge entegrasyonu.
 *
 * İki çalışma modu:
 *
 *  1) TARAYICI (PWA / desktop / mobile web):
 *     Firebase JS SDK'nın `firebase-messaging` modülü kullanılır;
 *     `firebase-messaging-sw.js` ile arka plan bildirimleri sağlanır.
 *
 *  2) NATIVE Capacitor (Android APK):
 *     `assets/vendor/capacitor-core.js` üzerinden FcmBridge plugin'ine bağlanılır;
 *     token native FirebaseMessaging.getInstance() ile alınır,
 *     foreground/arka plan bildirimleri PosetMessagingService.java tarafından gösterilir.
 *
 * Her iki modda da token aynı Firestore yoluna yazılır:
 *     users/{userId}/devices/{token}
 *
 * Çıkışta her iki modda da hem Firestore belgesi silinir hem de
 * tarayıcı/cihaz tarafındaki token geçersizleştirilir.
 */

import {
    getMessaging,
    getToken,
    onMessage,
    deleteToken,
    isSupported
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";

import {
    doc,
    setDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const TOKEN_LS_KEY = "poset:fcmToken";

/** GitHub Pages (/repo/) gibi alt yolda çalışırken SW yolu kökten değil uygulama klasöründen olmalı */
function appBasePath() {
    if (typeof location === "undefined") return "/";
    if (location.protocol === "file:") return "/";
    let p = location.pathname;
    if (!p.endsWith("/")) p = p.replace(/\/[^/]*$/, "/");
    return p || "/";
}

const APP_BASE = appBasePath();
const SW_PATH = `${APP_BASE}firebase-messaging-sw.js`;
const SW_SCOPE = `${APP_BASE}firebase-cloud-messaging-push-scope`;
const CAPACITOR_CORE_PATH = "../vendor/capacitor-core.js";

let cachedMessaging = null;
let foregroundUnsubscribe = null;
let nativeTokenRefreshHandle = null;
let nativePluginRef = null;

/* -------------------------------------------------------------------------- */
/* Ortam tespiti                                                               */
/* -------------------------------------------------------------------------- */

function isNativePlatform() {
    try {
        return !!(window.Capacitor
            && typeof window.Capacitor.isNativePlatform === "function"
            && window.Capacitor.isNativePlatform());
    } catch (_) {
        return false;
    }
}

/**
 * Firestore doc id olarak güvenli olacak şekilde token'ı normalize et.
 * FCM token'ları '/' içermez; yine de tedbir olarak değiştiriyoruz.
 */
function tokenToDocId(token) {
    return String(token).replace(/\//g, "_");
}

async function ensureWebSupport() {
    if (isNativePlatform()) return false;
    if (typeof window === "undefined") return false;
    if (!("serviceWorker" in navigator)) return false;
    if (!("Notification" in window)) return false;
    if (!window.PushManager) return false;
    try {
        const ok = await isSupported();
        return !!ok;
    } catch (_) {
        return false;
    }
}

async function ensureMessagingSwRegistration() {
    const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (existing && existing.active) return existing;
    return navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE });
}

async function ensureNotificationPermission() {
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    try {
        return await Notification.requestPermission();
    } catch (_) {
        return Notification.permission;
    }
}

/* -------------------------------------------------------------------------- */
/* Ortak yardımcı: Firestore'a token yaz / sil                                 */
/* -------------------------------------------------------------------------- */

async function writeDeviceDoc(db, userId, token, platform) {
    const docId = tokenToDocId(token);
    const ref = doc(db, "users", userId, "devices", docId);
    await setDoc(ref, {
        token,
        platform,
        userAgent: (navigator && navigator.userAgent) || "",
        language: (navigator && navigator.language) || "",
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp()
    }, { merge: true });
    try {
        localStorage.setItem(TOKEN_LS_KEY, token);
    } catch (_) { /* private mode */ }
}

async function removeDeviceDoc(db, userId, token) {
    if (!token) return;
    try {
        const docId = tokenToDocId(token);
        await deleteDoc(doc(db, "users", userId, "devices", docId));
    } catch (err) {
        console.warn("[fcm] device kaydı silinemedi:", err);
    }
}

/* -------------------------------------------------------------------------- */
/* WEB modu                                                                    */
/* -------------------------------------------------------------------------- */

function setupWebForegroundListener(messaging, onForeground) {
    if (foregroundUnsubscribe) {
        try { foregroundUnsubscribe(); } catch (_) { /* ignore */ }
        foregroundUnsubscribe = null;
    }
    foregroundUnsubscribe = onMessage(messaging, (payload) => {
        try {
            if (typeof onForeground === "function") {
                onForeground(payload);
            } else {
                const title = (payload.data && payload.data.title)
                    || (payload.notification && payload.notification.title)
                    || "Poşet Takip";
                const body = (payload.data && payload.data.body)
                    || (payload.notification && payload.notification.body)
                    || "";
                if (Notification.permission === "granted") {
                    new Notification(title, { body });
                }
            }
        } catch (err) {
            console.warn("[fcm-web] foreground handler hata:", err);
        }
    });
}

async function registerWebToken({ app, db, userId, vapidKey, onForegroundMessage }) {
    if (!vapidKey) {
        console.info("[fcm-web] VAPID anahtarı tanımlı değil; web push devre dışı.");
        return null;
    }
    if (!(await ensureWebSupport())) {
        console.info("[fcm-web] Bu ortam web push desteklemiyor; atlanıyor.");
        return null;
    }
    const permission = await ensureNotificationPermission();
    if (permission !== "granted") {
        console.info("[fcm-web] Bildirim izni verilmedi:", permission);
        return null;
    }
    try {
        const swReg = await ensureMessagingSwRegistration();
        cachedMessaging = cachedMessaging || getMessaging(app);
        const token = await getToken(cachedMessaging, {
            vapidKey,
            serviceWorkerRegistration: swReg
        });
        if (!token) {
            console.warn("[fcm-web] getToken null döndü.");
            return null;
        }
        await writeDeviceDoc(db, userId, token, "web");
        setupWebForegroundListener(cachedMessaging, onForegroundMessage);
        console.log("[fcm-web] Token Firestore'a kaydedildi.");
        return token;
    } catch (err) {
        console.error("[fcm-web] Token kaydı başarısız:", err);
        return null;
    }
}

async function unregisterWebToken({ db, userId, app, cachedToken }) {
    if (cachedToken) {
        await removeDeviceDoc(db, userId, cachedToken);
    }
    if (foregroundUnsubscribe) {
        try { foregroundUnsubscribe(); } catch (_) { /* ignore */ }
        foregroundUnsubscribe = null;
    }
    try {
        if (await ensureWebSupport()) {
            const messaging = cachedMessaging || (app ? getMessaging(app) : null);
            if (messaging) {
                await deleteToken(messaging);
                console.log("[fcm-web] Tarayıcı token'ı geçersiz kılındı.");
            }
        }
    } catch (err) {
        console.warn("[fcm-web] deleteToken hata:", err);
    }
}

/* -------------------------------------------------------------------------- */
/* NATIVE (Capacitor) modu                                                     */
/* -------------------------------------------------------------------------- */

/**
 * FcmBridge plugin proxy'sini bir kere yükleyip modül scope'undaki
 * `nativePluginRef` değişkenine YAZAR. PROXY'yi RETURN ETMEZ.
 *
 * Sebebi: Capacitor'ın registerPlugin() döndürdüğü nesne bir Proxy'dir;
 * her property erişimini native köprüye yönlendirir. Bu proxy'yi async
 * fonksiyondan return edersek Promise resolution mekanizması "thenable mi?"
 * diye `.then` özelliğine bakar → proxy bunu native bir method çağrısı
 * sanır → "FcmBridge.then() is not implemented" hatası oluşur.
 */
async function ensureFcmBridge() {
    if (nativePluginRef) return;
    const mod = await import(CAPACITOR_CORE_PATH);
    if (!mod || typeof mod.registerPlugin !== "function") {
        throw new Error("Capacitor registerPlugin bulunamadı");
    }
    nativePluginRef = mod.registerPlugin("FcmBridge");
}

async function registerNativeToken({ db, userId, onForegroundMessage }) {
    try {
        await ensureFcmBridge();
    } catch (err) {
        console.warn("[fcm-native] FcmBridge plugin yüklenemedi:", err);
        return null;
    }

    try {
        const perm = await nativePluginRef.requestPermissions();
        if (perm && perm.notifications && perm.notifications !== "granted") {
            console.info("[fcm-native] Bildirim izni verilmedi:", perm.notifications);
            return null;
        }
    } catch (err) {
        console.warn("[fcm-native] requestPermissions hata (devam ediliyor):", err);
    }

    let currentToken = null;
    try {
        const res = await nativePluginRef.getToken();
        currentToken = res && res.token;
    } catch (err) {
        console.error("[fcm-native] getToken hata:", err);
        return null;
    }

    if (!currentToken) {
        console.warn("[fcm-native] Token boş döndü.");
        return null;
    }

    try {
        await writeDeviceDoc(db, userId, currentToken, "android");
        console.log("[fcm-native] Token Firestore'a kaydedildi.");
    } catch (err) {
        console.error("[fcm-native] Firestore yazımı başarısız:", err);
        return null;
    }

    // Token yenileme dinleyicisi: native onNewToken -> JS'e tokenRefresh event'i
    try {
        if (nativeTokenRefreshHandle && typeof nativeTokenRefreshHandle.remove === "function") {
            try { await nativeTokenRefreshHandle.remove(); } catch (_) { /* ignore */ }
        }
        nativeTokenRefreshHandle = await nativePluginRef.addListener("tokenRefresh", async (event) => {
            const newToken = event && event.token;
            if (!newToken || newToken === currentToken) return;
            try {
                console.log("[fcm-native] Token yenilendi, Firestore güncelleniyor.");
                await removeDeviceDoc(db, userId, currentToken);
                await writeDeviceDoc(db, userId, newToken, "android");
                currentToken = newToken;
            } catch (err) {
                console.warn("[fcm-native] tokenRefresh güncellemesi başarısız:", err);
            }
        });
    } catch (err) {
        console.warn("[fcm-native] tokenRefresh listener bağlanamadı:", err);
    }

    // Foreground bildirimleri: Capacitor tarafında zaten PosetMessagingService bildirimi
    // sistem barında gösteriyor; ek bir in-app callback istenirse aşağıdaki opsiyonel.
    if (typeof onForegroundMessage === "function") {
        // Şu an native bridge ham FCM payload'unu JS'e taşımıyor – ileride istenirse
        // PosetMessagingService.onMessageReceived içinden notifyListeners('messageReceived')
        // ekleyip burada dinleyebiliriz. Bilinçli olarak şimdilik no-op.
        void onForegroundMessage;
    }

    return currentToken;
}

async function unregisterNativeToken({ db, userId, cachedToken }) {
    if (nativeTokenRefreshHandle && typeof nativeTokenRefreshHandle.remove === "function") {
        try { await nativeTokenRefreshHandle.remove(); } catch (_) { /* ignore */ }
        nativeTokenRefreshHandle = null;
    }
    if (cachedToken) {
        await removeDeviceDoc(db, userId, cachedToken);
    }
    try {
        await ensureFcmBridge();
        await nativePluginRef.deleteToken();
        console.log("[fcm-native] Cihaz token'ı geçersiz kılındı.");
    } catch (err) {
        console.warn("[fcm-native] deleteToken hata:", err);
    }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Login akışı sonrası çağrılır. Ortama göre web ya da native koluna düşer.
 *
 * @param {object} params
 * @param {object} params.app           Firebase App instance (sadece web için kullanılır)
 * @param {object} params.db            Firestore instance
 * @param {string} params.userId        Auth uid
 * @param {string} [params.vapidKey]    Web VAPID key
 * @param {function} [params.onForegroundMessage]
 * @returns {Promise<string|null>}
 */
export async function registerFcmToken(params = {}) {
    const { app, db, userId, vapidKey, onForegroundMessage } = params;
    if (!db || !userId) {
        console.warn("[fcm] registerFcmToken: eksik parametre, atlanıyor.");
        return null;
    }
    if (isNativePlatform()) {
        return registerNativeToken({ db, userId, onForegroundMessage });
    }
    return registerWebToken({ app, db, userId, vapidKey, onForegroundMessage });
}

/**
 * Çıkış akışında signOut'tan ÖNCE çağırılmalı.
 *
 * 1) Firestore'daki users/{uid}/devices/{token} belgesini siler.
 * 2) Tarayıcı / cihaz tarafındaki token'ı geçersizleştirir.
 * 3) İlgili dinleyicileri kapatır, localStorage'ı temizler.
 *
 * Hata olursa engellemez (logout her halükarda devam etmeli).
 */
export async function unregisterFcmToken(params = {}) {
    const { db, userId, app } = params;

    let cachedToken = null;
    try {
        cachedToken = localStorage.getItem(TOKEN_LS_KEY);
    } catch (_) { /* ignore */ }

    if (isNativePlatform()) {
        await unregisterNativeToken({ db, userId, cachedToken });
    } else {
        await unregisterWebToken({ db, userId, app, cachedToken });
    }

    try {
        localStorage.removeItem(TOKEN_LS_KEY);
    } catch (_) { /* ignore */ }
}
