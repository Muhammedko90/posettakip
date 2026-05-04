/**
 * Poşet Takip - Cloud Functions (FCM + Firestore tetikleyicileri)
 *
 * Firestore yolu: users/{userId}/items/{itemId}
 *
 * FCM token örneği (bu projede kullanılan yapı):
 *   users/{userId}/devices/{deviceDocId}  → alan: token (veya doc id = token)
 *
 * Alternatif örnek (kendi şemanıza göre loadUserDevices içinde düzenleyin):
 *   db.collection("users").doc(userId).collection("tokens").get()
 *   db.collection("fcmTokens").where("userId", "==", userId).get()
 *
 * Mobil bildirimler: her cihaz için admin.messaging().send(...) (tekil gönderim).
 *
 * Telegram: telegram-bot.js şu an yalnızca webhook / registerWebhook export ediyor; poşet
 * olayları için hazır bir "notify" export'u yok. telegram-bot.js'e dokunmadan, aynı
 * Firestore ayar yolu (users/.../settings/appSettings) ve Bot API ile mesaj gönderilir.
 */

const {
    onDocumentCreated,
    onDocumentUpdated,
    onDocumentDeleted,
} = require("firebase-functions/v2/firestore");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { logger } = require("firebase-functions");
const {
    handleWebhookRequest,
    registerWebhook,
    clearWebhook,
} = require("./telegram-bot");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

setGlobalOptions({
    region: "us-central1",
    maxInstances: 10,
});

const db = getFirestore();
const messaging = getMessaging();

const INVALID_TOKEN_ERRORS = new Set([
    "messaging/invalid-registration-token",
    "messaging/registration-token-not-registered",
    "messaging/invalid-argument",
]);

/* -------------------------------------------------------------------------- */
/* Helpers — Firestore / FCM                                                   */
/* -------------------------------------------------------------------------- */

/**
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
 * FCM data payload değerleri string olmalı.
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
 * Kullanıcının tüm cihazlarına bildirim — her biri için messaging.send().
 */
async function sendToUserDevices(userId, payload) {
    if (!userId) return { sent: 0, removed: 0 };

    let devices;
    try {
        devices = await loadUserDevices(userId);
    } catch (err) {
        logger.error("[fcm] loadUserDevices hatası:", err);
        return { sent: 0, removed: 0 };
    }

    if (devices.length === 0) {
        logger.info(`[fcm] user=${userId} için kayıtlı cihaz yok.`);
        return { sent: 0, removed: 0 };
    }

    const data = {
        type: String(payload.type || "default"),
        title: String(payload.title || "Poşet Takip"),
        body: String(payload.body || ""),
        ...stringifyExtra(payload.extra),
    };

    let totalSuccess = 0;
    const invalidDocIds = [];
    const successDocIds = [];

    for (const device of devices) {
        const message = {
            token: device.token,
            data,
            android: {
                priority: "high",
                ttl: 60 * 60 * 1000,
                collapseKey: data.type,
            },
            apns: {
                headers: {
                    "apns-priority": "10",
                },
                payload: {
                    aps: {
                        alert: { title: data.title, body: data.body },
                        sound: "default",
                        "thread-id": data.type,
                    },
                },
            },
            webpush: {
                headers: {
                    Urgency: "high",
                    TTL: "3600",
                },
                fcmOptions: {
                    link: "/",
                },
            },
            fcmOptions: {
                analyticsLabel: data.type,
            },
        };

        try {
            await messaging.send(message);
            totalSuccess += 1;
            successDocIds.push(device.docId);
        } catch (err) {
            const code = err.code || err?.errorInfo?.code;
            logger.warn(`[fcm] send() hatası user=${userId} doc=${device.docId} code=${code}`, err.message || err);
            if (INVALID_TOKEN_ERRORS.has(code)) {
                invalidDocIds.push(device.docId);
            }
        }
    }

    try {
        await Promise.all([
            cleanupInvalidTokens(userId, invalidDocIds),
            touchLastSeen(userId, successDocIds),
        ]);
    } catch (err) {
        logger.warn("[fcm] cleanup/touchLastSeen:", err);
    }

    logger.info(`[fcm] user=${userId} type=${data.type} sent=${totalSuccess}/${devices.length} removed=${invalidDocIds.length}`);
    return { sent: totalSuccess, removed: invalidDocIds.length };
}

/* -------------------------------------------------------------------------- */
/* Helpers — Telegram (telegram-bot.js export etmediği için minimal Bot API)    */
/* -------------------------------------------------------------------------- */

async function loadAppSettings(dbRef, userId) {
    const ref = dbRef.collection("users").doc(userId).collection("settings").doc("appSettings");
    const snap = await ref.get();
    return snap.exists ? snap.data() || {} : {};
}

/**
 * Ayarlardaki telegramChatId (virgülle ayrılmış) adreslerine düz metin gönderir.
 * Hatalar loglanır; throw etmez.
 */
async function notifyTelegramAdminsPlain(dbRef, userId, text) {
    try {
        const settings = await loadAppSettings(dbRef, userId);
        const botToken = (settings.telegramBotToken || "").trim();
        const adminIds = (settings.telegramChatId || "")
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean);
        if (!botToken || adminIds.length === 0) {
            logger.info(`[tg] user=${userId} için bot token veya chat id yok, atlanıyor.`);
            return;
        }
        const targets = [...new Set(adminIds)];
        for (const chatId of targets) {
            try {
                const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: String(text || ""),
                    }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok || json.ok === false) {
                    logger.warn(`[tg] sendMessage başarısız chat=${chatId}`, json.description || res.status);
                }
            } catch (err) {
                logger.warn(`[tg] sendMessage ağ hatası chat=${chatId}:`, err);
            }
        }
    } catch (err) {
        logger.error("[tg] notifyTelegramAdminsPlain:", err);
    }
}

function tgLineNewBag(item) {
    const customer = (item.customerName || "Bilinmeyen müşteri").toString();
    const count = Number(item.bagCount) || 0;
    const note = (item.note || "").toString().trim();
    const noteLine = note ? `\n📝 Not: ${note}` : "";
    return `🆕 Yeni poşet (uygulama)\n👤 ${customer}\n🛍️ ${count} adet${noteLine}`;
}

function tgLineDelivered(item, before) {
    const customer = (item.customerName || "Bilinmeyen müşteri").toString();
    const count = Number(item.bagCount) || Number(before && before.bagCount) || 0;
    const by = (item.deliveredBy || "").toString().trim();
    const byLine = by ? `\n👷 ${by}` : "";
    return `✅ Teslim edildi (uygulama)\n👤 ${customer}\n🛍️ ${count} adet${byLine}`;
}

function tgLineNote(item) {
    const customer = (item.customerName || "Bilinmeyen müşteri").toString();
    const note = (item.note || "").toString().trim();
    return `📝 Not güncellendi (uygulama)\n👤 ${customer}\n📄 ${note || "(boş)"}`;
}

function tgLineDeleted(item) {
    const customer = (item.customerName || "Bilinmeyen müşteri").toString();
    const count = Number(item.bagCount) || 0;
    return `🗑️ Kayıt silindi (uygulama)\n👤 ${customer}\n🛍️ kayıtlı adet: ${count}`;
}

/* -------------------------------------------------------------------------- */
/* Payload builders (FCM data-only — PosetMessagingService.java ile uyumlu)      */
/* -------------------------------------------------------------------------- */

function buildNewBagPayload(userId, itemId, item) {
    const customer = (item.customerName || "Bilinmeyen müşteri").toString();
    const count = Number(item.bagCount) || 0;
    const note = (item.note || "").toString().trim();
    const title = "🛍️ Yeni Poşet Eklendi";
    const body = note ? `${customer} • ${count} adet • Not: ${note}` : `${customer} için ${count} poşet kaydedildi.`;
    return {
        type: "new_bag",
        title,
        body,
        extra: {
            userId,
            itemId,
            customerName: customer,
            bagCount: count,
        },
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
            deliveredBy,
        },
    };
}

function buildNoteUpdatedPayload(userId, itemId, item) {
    const customer = (item.customerName || "Bilinmeyen müşteri").toString();
    const note = (item.note || "").toString().trim();
    const title = "📝 Not Güncellendi";
    const body = note ? `${customer}: ${note}` : `${customer}: not temizlendi veya güncellendi.`;
    return {
        type: "note_updated",
        title,
        body,
        extra: {
            userId,
            itemId,
            customerName: customer,
        },
    };
}

function buildDeletedPayload(userId, itemId, item) {
    const customer = (item.customerName || "Bilinmeyen müşteri").toString();
    const count = Number(item.bagCount) || 0;
    const title = "🗑️ Kayıt Silindi";
    const body = `${customer} (${count} adet) kaydı silindi.`;
    return {
        type: "item_deleted",
        title,
        body,
        extra: {
            userId,
            itemId,
            customerName: customer,
            bagCount: count,
        },
    };
}

/* -------------------------------------------------------------------------- */
/* Trigger: Yeni poşet                                                          */
/* -------------------------------------------------------------------------- */

exports.onItemCreated = onDocumentCreated("users/{userId}/items/{itemId}", async (event) => {
    try {
        const snap = event.data;
        if (!snap) return;
        const item = snap.data() || {};
        const { userId, itemId } = event.params;

        if (item.status === "delivered") {
            logger.debug(`[fcm] onItemCreated: delivered olarak oluşturuldu, yeni poşet bildirimi yok (user=${userId} item=${itemId})`);
            return;
        }

        const payload = buildNewBagPayload(userId, itemId, item);
        await sendToUserDevices(userId, payload);
        await notifyTelegramAdminsPlain(db, userId, tgLineNewBag(item));
    } catch (err) {
        logger.error("[onItemCreated] beklenmeyen hata:", err);
    }
});

/* -------------------------------------------------------------------------- */
/* Trigger: Teslim veya not güncellemesi                                       */
/* -------------------------------------------------------------------------- */

exports.onItemUpdated = onDocumentUpdated("users/{userId}/items/{itemId}", async (event) => {
    try {
        if (!event.data) return;
        const before = event.data.before.data() || {};
        const after = event.data.after.data() || {};
        const { userId, itemId } = event.params;

        const wasDelivered = before.status === "delivered";
        const isDelivered = after.status === "delivered";
        const noteBefore = String(before.note ?? "");
        const noteAfter = String(after.note ?? "");
        const noteChanged = noteBefore !== noteAfter;

        let payload = null;
        let tgText = null;

        if (!wasDelivered && isDelivered) {
            payload = buildDeliveredPayload(userId, itemId, after, before);
            tgText = tgLineDelivered(after, before);
        } else if (!isDelivered && noteChanged) {
            payload = buildNoteUpdatedPayload(userId, itemId, after);
            tgText = tgLineNote(after);
        }

        if (!payload) return;

        await sendToUserDevices(userId, payload);
        await notifyTelegramAdminsPlain(db, userId, tgText);
    } catch (err) {
        logger.error("[onItemUpdated] beklenmeyen hata:", err);
    }
});

/* -------------------------------------------------------------------------- */
/* Trigger: Silme                                                               */
/* -------------------------------------------------------------------------- */

exports.onItemDeleted = onDocumentDeleted("users/{userId}/items/{itemId}", async (event) => {
    try {
        const snap = event.data;
        if (!snap) return;
        const item = snap.data() || {};
        const { userId, itemId } = event.params;

        const payload = buildDeletedPayload(userId, itemId, item);
        await sendToUserDevices(userId, payload);
        await notifyTelegramAdminsPlain(db, userId, tgLineDeleted(item));
    } catch (err) {
        logger.error("[onItemDeleted] beklenmeyen hata:", err);
    }
});

/* -------------------------------------------------------------------------- */
/* Trigger: Otomatik yedek tamamlandı — yalnızca Telegram                      */
/* -------------------------------------------------------------------------- */
/**
 * İstemci, otomatik yedek Telegram'a gönderildikten sonra (veya başarıyla bittiğinde)
 * örnek: addDoc(collection(db, 'users', uid, 'backupAudit'), { ok: true, source: 'auto' })
 * yazarsa bu fonksiyon tetiklenir ve yöneticilere kısa bilgi gider.
 *
 * Mobil bildirim gönderilmez.
 */
exports.onAutoBackupAuditCreated = onDocumentCreated("users/{userId}/backupAudit/{auditId}", async (event) => {
    try {
        const snap = event.data;
        if (!snap) return;
        const row = snap.data() || {};
        if (row.ok === false || row.success === false) {
            logger.info("[backupAudit] ok=false, Telegram atlanıyor.");
            return;
        }
        const { userId } = event.params;
        await notifyTelegramAdminsPlain(db, userId, "Otomatik yedek başarıyla gönderildi");
    } catch (err) {
        logger.error("[onAutoBackupAuditCreated]:", err);
    }
});

/* -------------------------------------------------------------------------- */
/* Telegram: HTTPS webhook (mevcut — telegram-bot.js)                         */
/* -------------------------------------------------------------------------- */

exports.telegramWebhook = onRequest(
    {
        region: "us-central1",
        cors: false,
        invoker: "public",
        timeoutSeconds: 120,
        memory: "512MiB",
    },
    async (req, res) => {
        await handleWebhookRequest(req, res, db, logger);
    },
);

exports.registerTelegramWebhook = onCall({ region: "us-central1" }, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new HttpsError("unauthenticated", "Giriş yapmanız gerekir.");
    }
    try {
        return await registerWebhook(db, request.auth.uid, logger);
    } catch (e) {
        const code = e.code === "failed-precondition" ? "failed-precondition" : "internal";
        throw new HttpsError(code, e.message || String(e));
    }
});

exports.clearTelegramWebhook = onCall({ region: "us-central1" }, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new HttpsError("unauthenticated", "Giriş yapmanız gerekir.");
    }
    try {
        return await clearWebhook(db, request.auth.uid, logger);
    } catch (e) {
        throw new HttpsError("internal", e.message || String(e));
    }
});
