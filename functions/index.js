/**
 * Poşet Takip - Cloud Functions (FCM tetikleyicileri)
 *
 * Firestore'da bir poşet eklendiğinde / "teslim edildi" olarak güncellendiğinde
 * ilgili kullanıcının kayıtlı tüm cihazlarına push bildirimi gönderir.
 *
 * Kullanılan modern API'lar:
 *   - firebase-functions v2 (onDocumentCreated / onDocumentUpdated)
 *   - firebase-admin getMessaging().sendEachForMulticast(...)
 *
 * (Eski sendToDevice / sendMulticast deprecated; sendEachForMulticast HTTP v1
 *  protokolünü kullanır ve cevapta her token için ayrı status döner -
 *  invalid token'ları otomatik temizleyebilmemiz buna dayanıyor.)
 */

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

// Firestore veritabanınız `nam5` (North America multi-region) üzerinde olduğu için
// fonksiyonu da aynı kıtada (us-central1) çalıştırmak Eventarc tetikleyicisinin
// cross-region atlamasını ve ekstra gecikme/maliyeti önler.
setGlobalOptions({
    region: "us-central1",
    maxInstances: 10
});

const db = getFirestore();
const messaging = getMessaging();

const FCM_BATCH_LIMIT = 500;

// Bilgilendirici sabitler: Android tarafında PosetMessagingService.java
// data.type'a göre bu kanallara yönlendirme yapıyor.
//   - "new_bag"   -> "poset_yeni"
//   - "delivered" -> "poset_teslim"
// Cloud Function'dan ekstra bir kanal alanı GÖNDERMİYORUZ; eşleşme tamamen
// data-only payload üzerinden yapılıyor.

const INVALID_TOKEN_ERRORS = new Set([
    "messaging/invalid-registration-token",
    "messaging/registration-token-not-registered",
    "messaging/invalid-argument"
]);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Bir kullanıcının kayıtlı tüm cihaz token'larını yükler.
 *
 * @param {string} userId
 * @returns {Promise<Array<{ docId: string, token: string }>>}
 */
async function loadUserDevices(userId) {
    const snap = await db.collection("users").doc(userId).collection("devices").get();
    const devices = [];
    snap.forEach((d) => {
        const data = d.data() || {};
        const token = data.token || d.id;
        if (typeof token === "string" && token.length > 10) {
            devices.push({ docId: d.id, token });
        }
    });
    return devices;
}

/**
 * Geçersiz / artık kayıtlı olmayan token'ların Firestore'daki belgelerini siler.
 * Bu sayede aynı kullanıcıya bir daha boşa mesaj gönderilmez.
 */
async function cleanupInvalidTokens(userId, invalidDocIds) {
    if (invalidDocIds.length === 0) return;
    const batch = db.batch();
    invalidDocIds.forEach((docId) => {
        const ref = db.collection("users").doc(userId).collection("devices").doc(docId);
        batch.delete(ref);
    });
    try {
        await batch.commit();
        logger.info(`[fcm] ${invalidDocIds.length} geçersiz token temizlendi (user=${userId}).`);
    } catch (err) {
        logger.warn("[fcm] Geçersiz token temizliği başarısız:", err);
    }
}

/**
 * lastSeen alanını "şimdi" olarak günceller (başarılı şekilde gönderilen cihazlar için).
 */
async function touchLastSeen(userId, docIds) {
    if (docIds.length === 0) return;
    const batch = db.batch();
    docIds.forEach((docId) => {
        const ref = db.collection("users").doc(userId).collection("devices").doc(docId);
        batch.set(ref, { lastSeen: FieldValue.serverTimestamp() }, { merge: true });
    });
    try {
        await batch.commit();
    } catch (err) {
        logger.debug("[fcm] lastSeen güncellenemedi:", err);
    }
}

/**
 * Verilen kullanıcının tüm cihazlarına aynı bildirimi gönderir.
 *
 * payload:
 *   - type:    "new_bag" | "delivered" | string
 *   - title:   bildirim başlığı (dinamik)
 *   - body:    bildirim içeriği (dinamik)
 *   - extra:   ek serbest data alanları (itemId, customerName, ...)
 *
 * Tasarım notları:
 *   * Sadece "data" payload'u kullanıyoruz; böylece android-side
 *     PosetMessagingService.java mesajı yakalayıp doğru NotificationChannel'a
 *     yönlendirebiliyor (ön plan + arka plan için tutarlı davranış).
 *   * "android.priority = high" -> cihazı uyandırır (Doze modunda dahi).
 *   * webpush konfigürasyonu firebase-messaging-sw.js'in onBackgroundMessage
 *     handler'ı ile birlikte çalışacak şekilde data-only.
 */
async function sendToUserDevices(userId, payload) {
    if (!userId) return { sent: 0, removed: 0 };

    const devices = await loadUserDevices(userId);
    if (devices.length === 0) {
        logger.info(`[fcm] user=${userId} için kayıtlı cihaz yok.`);
        return { sent: 0, removed: 0 };
    }

    const data = {
        type: String(payload.type || "default"),
        title: String(payload.title || "Poşet Takip"),
        body: String(payload.body || ""),
        ...stringifyExtra(payload.extra)
    };

    let totalSuccess = 0;
    const invalidDocIds = [];
    const successDocIds = [];

    for (let i = 0; i < devices.length; i += FCM_BATCH_LIMIT) {
        const chunk = devices.slice(i, i + FCM_BATCH_LIMIT);
        const message = {
            tokens: chunk.map((d) => d.token),
            data,
            android: {
                priority: "high",
                ttl: 60 * 60 * 1000, // 1 saat
                collapseKey: data.type
            },
            apns: {
                headers: {
                    "apns-priority": "10"
                },
                payload: {
                    aps: {
                        alert: { title: data.title, body: data.body },
                        sound: "default",
                        "thread-id": data.type
                    }
                }
            },
            webpush: {
                headers: {
                    Urgency: "high",
                    TTL: "3600"
                },
                fcmOptions: {
                    // Bildirime tıklayınca uygulamanın açacağı URL.
                    link: "/"
                }
            },
            fcmOptions: {
                analyticsLabel: data.type
            }
        };

        let response;
        try {
            response = await messaging.sendEachForMulticast(message);
        } catch (err) {
            logger.error("[fcm] sendEachForMulticast tamamen başarısız:", err);
            continue;
        }

        response.responses.forEach((resp, idx) => {
            const device = chunk[idx];
            if (resp.success) {
                totalSuccess += 1;
                successDocIds.push(device.docId);
            } else {
                const code = resp.error && resp.error.code;
                logger.warn(`[fcm] gönderim hatası user=${userId} token=${device.docId} code=${code}`);
                if (INVALID_TOKEN_ERRORS.has(code)) {
                    invalidDocIds.push(device.docId);
                }
            }
        });
    }

    await Promise.all([
        cleanupInvalidTokens(userId, invalidDocIds),
        touchLastSeen(userId, successDocIds)
    ]);

    logger.info(`[fcm] user=${userId} type=${data.type} sent=${totalSuccess}/${devices.length} removed=${invalidDocIds.length}`);
    return { sent: totalSuccess, removed: invalidDocIds.length };
}

/**
 * FCM data payload'unun TÜM değerleri string olmak zorunda. Karışık tipleri stringe çeviriyoruz.
 */
function stringifyExtra(extra) {
    if (!extra || typeof extra !== "object") return {};
    const out = {};
    for (const [key, value] of Object.entries(extra)) {
        if (value === null || value === undefined) continue;
        out[key] = typeof value === "string" ? value : JSON.stringify(value);
    }
    return out;
}

/**
 * Firestore item belgesinden okunabilir başlık/içerik üretir.
 */
function buildNewBagPayload(userId, itemId, item) {
    const customer = (item.customerName || "Bilinmeyen müşteri").toString();
    const count = Number(item.bagCount) || 0;
    const note = (item.note || "").toString().trim();

    const title = "🛍️ Yeni Poşet Eklendi";
    const body = note
        ? `${customer} • ${count} adet • Not: ${note}`
        : `${customer} için ${count} poşet kaydedildi.`;

    return {
        type: "new_bag",
        title,
        body,
        extra: {
            userId,
            itemId,
            customerName: customer,
            bagCount: count
        }
    };
}

function buildDeliveredPayload(userId, itemId, item, before) {
    const customer = (item.customerName || "Bilinmeyen müşteri").toString();
    const count = Number(item.bagCount) || Number(before && before.bagCount) || 0;
    const deliveredBy = (item.deliveredBy || "").toString().trim();

    const title = "✅ Poşet Teslim Edildi";
    const body = deliveredBy
        ? `${customer} • ${count} adet • Teslim eden: ${deliveredBy}`
        : `${customer} için ${count} poşet teslim edildi.`;

    return {
        type: "delivered",
        title,
        body,
        extra: {
            userId,
            itemId,
            customerName: customer,
            bagCount: count,
            deliveredBy
        }
    };
}

/* -------------------------------------------------------------------------- */
/* Trigger 1: Yeni poşet eklendi                                              */
/* -------------------------------------------------------------------------- */

exports.onItemCreated = onDocumentCreated(
    "users/{userId}/items/{itemId}",
    async (event) => {
        const snap = event.data;
        if (!snap) return;
        const item = snap.data() || {};
        const { userId, itemId } = event.params;

        // Eğer poşet ZATEN delivered olarak yaratıldıysa (örn. iade akışı), yeni-poşet
        // bildirimi göndermeyelim; teslim bildirimi mantığı update tetikleyicisi tarafında.
        if (item.status === "delivered") {
            logger.debug(`[fcm] onItemCreated: status=delivered, atlanıyor (user=${userId} item=${itemId})`);
            return;
        }

        const payload = buildNewBagPayload(userId, itemId, item);
        await sendToUserDevices(userId, payload);
    }
);

/* -------------------------------------------------------------------------- */
/* Trigger 2: Poşet "teslim edildi" olarak güncellendi                         */
/* -------------------------------------------------------------------------- */

exports.onItemUpdated = onDocumentUpdated(
    "users/{userId}/items/{itemId}",
    async (event) => {
        if (!event.data) return;
        const before = event.data.before.data() || {};
        const after = event.data.after.data() || {};
        const { userId, itemId } = event.params;

        const wasDelivered = before.status === "delivered";
        const isDelivered = after.status === "delivered";

        // Sadece active -> delivered geçişlerinde bildirim gönderiyoruz.
        // Aksi halde başka alanlardaki her güncelleme spam yaratır.
        if (wasDelivered || !isDelivered) return;

        const payload = buildDeliveredPayload(userId, itemId, after, before);
        await sendToUserDevices(userId, payload);
    }
);
