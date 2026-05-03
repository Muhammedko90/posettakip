/**
 * Telegram webhook + komut işleme (Firestore Admin).
 * Uygulama kapalıyken komutların çalışması için Cloud Function üzerinden kullanılır.
 */

const crypto = require("crypto");
const { FieldValue } = require("firebase-admin/firestore");
const { jsPDF } = require("jspdf");
require("jspdf-autotable");

const ROUTES_COLL = "telegramWebhookRoutes";
const DEFAULT_SHARE_TMPL =
    "Merhaba, [Müşteri Adı] adına ayrılan [Poşet Sayısı] poşetiniz [Bekleme Süresi] gündür beklemektedir.";

function toTrUpperCase(str) {
    return str ? String(str).toLocaleUpperCase("tr-TR") : "";
}

function isSundayIstanbul() {
    const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Istanbul",
        weekday: "long",
    }).format(new Date());
    return weekday === "Sunday";
}

function todayStrIstanbul() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

function formatDateTs(createdAt) {
    if (!createdAt) return "";
    const d =
        createdAt.toDate && typeof createdAt.toDate === "function"
            ? createdAt.toDate()
            : createdAt.seconds
              ? new Date(createdAt.seconds * 1000)
              : new Date(createdAt);
    return d.toLocaleString("tr-TR");
}

function itemCreatedDate(item) {
    const c = item.createdAt;
    if (!c) return new Date();
    if (c.toDate) return c.toDate();
    if (c.seconds) return new Date(c.seconds * 1000);
    return new Date(c);
}

function itemDeliveredDayStr(item) {
    const d = item.deliveredAt;
    if (!d) return "";
    const dt = d.toDate ? d.toDate() : d.seconds ? new Date(d.seconds * 1000) : new Date(d);
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(dt);
}

function serializeForBackup(value) {
    if (value === null || value === undefined) return value;
    if (typeof value === "object") {
        if (typeof value.toDate === "function") {
            try {
                return value.toDate().toISOString();
            } catch {
                return String(value);
            }
        }
        if (Array.isArray(value)) return value.map(serializeForBackup);
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = serializeForBackup(v);
        }
        return out;
    }
    return value;
}

function toPdfAscii(str) {
    const map = { İ: "I", ı: "i", Ş: "S", ş: "s", Ğ: "G", ğ: "g", Ü: "U", ü: "u", Ö: "O", ö: "o", Ç: "C", ç: "c" };
    return String(str || "").replace(/[İıŞşĞğÜüÖöÇç]/g, (ch) => map[ch] || ch);
}

function buildWebhookUrl(projectId, secret, region = "us-central1") {
    const base = `https://${region}-${projectId}.cloudfunctions.net/telegramWebhook`;
    const q = new URLSearchParams({ s: secret });
    return `${base}?${q.toString()}`;
}

async function tgApi(botToken, method, body) {
    const url = `https://api.telegram.org/bot${botToken}/${method}`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok !== false, data, status: res.status };
}

async function sendMessage(botToken, chatId, text, opts = {}) {
    if (isSundayIstanbul()) return;
    const body = { chat_id: chatId, text };
    if (opts.reply_markup) body.reply_markup = opts.reply_markup;
    if (opts.silent) body.disable_notification = true;
    if (opts.parseMode === null) {
        /* düz metin */
    } else if (opts.parseMode !== undefined) {
        body.parse_mode = opts.parseMode;
    } else {
        body.parse_mode = "Markdown";
    }
    await tgApi(botToken, "sendMessage", body);
}

async function sendDocumentBuffer(botToken, chatId, buf, filename, caption = "", parseMode = null, silent = false) {
    if (isSundayIstanbul()) return;
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("caption", caption);
    if (parseMode) form.append("parse_mode", parseMode);
    form.append("document", new Blob([buf], { type: "application/octet-stream" }), filename);
    if (silent) form.append("disable_notification", "true");
    const url = `https://api.telegram.org/bot${botToken}/sendDocument`;
    const res = await fetch(url, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok !== false, data };
}

async function editMessageText(botToken, chatId, messageId, text, replyMarkup = null) {
    if (isSundayIstanbul()) return;
    const body = { chat_id: chatId, message_id: messageId, text };
    if (replyMarkup !== undefined) body.reply_markup = replyMarkup;
    await tgApi(botToken, "editMessageText", body);
}

async function answerCallback(botToken, cqId, text, showAlert = false) {
    if (isSundayIstanbul()) return;
    await tgApi(botToken, "answerCallbackQuery", {
        callback_query_id: cqId,
        text,
        show_alert: showAlert,
    });
}

async function tryClaimTelegramUpdate(db, userId, updateId) {
    const id = typeof updateId === "number" ? updateId : parseInt(String(updateId), 10);
    if (!Number.isFinite(id)) return false;
    const ref = db.collection("users").doc(userId).collection("telegramConsumedUpdates").doc(String(id));
    try {
        return await db.runTransaction(async (t) => {
            const snap = await t.get(ref);
            if (snap.exists) return false;
            t.set(ref, { updateId: id, consumedAt: FieldValue.serverTimestamp() });
            return true;
        });
    } catch {
        return false;
    }
}

async function loadSettings(db, userId) {
    const ref = db.collection("users").doc(userId).collection("settings").doc("appSettings");
    const snap = await ref.get();
    return snap.exists ? snap.data() || {} : {};
}

async function saveSettingsMerge(db, userId, patch) {
    const ref = db.collection("users").doc(userId).collection("settings").doc("appSettings");
    await ref.set(patch, { merge: true });
}

async function loadItems(db, userId) {
    const snap = await db.collection("users").doc(userId).collection("items").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadCustomers(db, userId) {
    const snap = await db.collection("users").doc(userId).collection("customers").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadDeliveryPersonnel(db, userId) {
    const snap = await db.collection("users").doc(userId).collection("deliveryPersonnel").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function addItem(db, userId, data) {
    const col = db.collection("users").doc(userId).collection("items");
    await col.add({
        ...data,
        createdAt: FieldValue.serverTimestamp(),
        lastModified: FieldValue.serverTimestamp(),
    });
}

async function updateItem(db, userId, itemId, data) {
    const ref = db.collection("users").doc(userId).collection("items").doc(itemId);
    const patch = { ...data, lastModified: FieldValue.serverTimestamp() };
    if (patch.note !== undefined) patch.note = toTrUpperCase(patch.note);
    await ref.update(patch);
}

async function deleteItem(db, userId, itemId) {
    await db.collection("users").doc(userId).collection("items").doc(itemId).delete();
}

async function addBagsToExistingItem(db, userId, itemId, bagCount, additionalDates) {
    const ref = db.collection("users").doc(userId).collection("items").doc(itemId);
    await ref.update({
        bagCount,
        lastModified: FieldValue.serverTimestamp(),
        additionalDates: FieldValue.arrayUnion(...additionalDates),
    });
}

async function addCustomer(db, userId, name, extras = {}) {
    await db.collection("users").doc(userId).collection("customers").add({ name, ...extras });
}

function generateWebhookSecret() {
    return crypto.randomBytes(24).toString("hex");
}

async function resolveUserIdFromWebhook(db, secretFromQuery, headerSecret) {
    if (!secretFromQuery || secretFromQuery !== headerSecret) return null;
    const route = await db.collection(ROUTES_COLL).doc(secretFromQuery).get();
    if (!route.exists) return null;
    const uid = route.data()?.userId;
    return typeof uid === "string" && uid ? uid : null;
}

async function updateItemDeliverSplit(db, userId, item, toDel, senderLabel) {
    const total = Number(item.bagCount);
    const rem = total - toDel;
    const curDates = [...(item.additionalDates || [])];
    if (toDel >= total) {
        await updateItem(db, userId, item.id, {
            status: "delivered",
            deliveredAt: new Date(),
            deliveredBy: senderLabel,
            note: "",
            reminderDate: null,
        });
    } else {
        await updateItem(db, userId, item.id, {
            bagCount: rem,
            additionalDates: curDates.slice(0, Math.max(0, curDates.length - toDel)),
        });
        await addItem(db, userId, {
            customerName: item.customerName,
            bagCount: toDel,
            status: "delivered",
            deliveredAt: new Date(),
            deliveredBy: senderLabel,
            note: "",
            reminderDate: null,
            additionalDates: [],
        });
    }
}

function activePdfBlob(items) {
    const activeItems = items.filter((i) => i.status === "active");
    if (activeItems.length === 0) return null;
    const pdf = new jsPDF();
    pdf.text("Bekleyen Poset Listesi", 14, 16);
    const tableColumn = ["#", "Musteri Adi", "Poset Sayisi", "Eklenme Tarihi"];
    const tableRows = activeItems.map((item, i) => [
        i + 1,
        toPdfAscii(item.customerName),
        item.bagCount,
        formatDateTs(item.createdAt).split(" ")[0],
    ]);
    pdf.autoTable({ head: [tableColumn], body: tableRows, startY: 20 });
    return Buffer.from(pdf.output("arraybuffer"));
}

/**
 * Kayıtlı webhook URL'ini Telegram'a yazar; secret ve Firestore eşlemesini günceller.
 */
async function registerWebhook(db, uid, logger) {
    const settingsRef = db.collection("users").doc(uid).collection("settings").doc("appSettings");
    const snap = await settingsRef.get();
    const settings = snap.exists ? snap.data() || {} : {};
    const botToken = (settings.telegramBotToken || "").trim();
    if (!botToken) {
        const err = new Error("Telegram bot token ayarlı değil.");
        err.code = "failed-precondition";
        throw err;
    }

    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    /** HTTPS işlev bölgesi firebase.json / setGlobalOptions ile aynı olmalı */
    const region = "us-central1";
    if (!projectId) {
        const err = new Error("GCLOUD_PROJECT tanımsız.");
        err.code = "internal";
        throw err;
    }

    let secret = (settings.telegramWebhookSecret || "").trim();
    const oldSecret = secret;
    if (!secret) secret = generateWebhookSecret();

    const batch = db.batch();
    const routeRef = db.collection(ROUTES_COLL).doc(secret);
    batch.set(routeRef, { userId: uid }, { merge: true });

    if (oldSecret && oldSecret !== secret) {
        batch.delete(db.collection(ROUTES_COLL).doc(oldSecret));
    }

    batch.set(
        settingsRef,
        {
            telegramWebhookSecret: secret,
            telegramCloudWebhookActive: true,
        },
        { merge: true },
    );
    await batch.commit();

    const url = buildWebhookUrl(projectId, secret, region);
    const setRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            url,
            secret_token: secret,
            allowed_updates: ["message", "callback_query", "channel_post"],
            drop_pending_updates: false,
        }),
    });
    const setJson = await setRes.json().catch(() => ({}));
    if (!setJson.ok) {
        logger.error("setWebhook başarısız", setJson);
        await saveSettingsMerge(db, uid, { telegramCloudWebhookActive: false });
        const err = new Error(setJson.description || "Telegram setWebhook başarısız");
        err.code = "internal";
        throw err;
    }

    return { ok: true, webhookUrl: url };
}

/**
 * Webhook'u kaldırır ve bulut dinleyiciyi devre dışı bırakır.
 */
async function clearWebhook(db, uid, logger) {
    const settingsRef = db.collection("users").doc(uid).collection("settings").doc("appSettings");
    const snap = await settingsRef.get();
    const settings = snap.exists ? snap.data() || {} : {};
    const botToken = (settings.telegramBotToken || "").trim();
    const secret = (settings.telegramWebhookSecret || "").trim();

    if (botToken) {
        try {
            await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ drop_pending_updates: false }),
            });
        } catch (e) {
            logger.warn("deleteWebhook:", e);
        }
    }
    if (secret) {
        try {
            await db.collection(ROUTES_COLL).doc(secret).delete();
        } catch (e) {
            logger.warn("route delete:", e);
        }
    }
    await settingsRef.set(
        {
            telegramWebhookSecret: FieldValue.delete(),
            telegramCloudWebhookActive: false,
        },
        { merge: true },
    );
    return { ok: true };
}

async function processCallbackQuery(db, userId, settings, cq, botToken, _logger) {
    const data = cq.data;
    const message = cq.message;
    if (!message) return;

    const chatId = message.chat.id;
    const messageId = message.message_id;
    const adminIds = (settings.telegramChatId || "").split(",").map((id) => id.trim());
    const allowed = adminIds.includes(String(chatId));

    if (!allowed) {
        await answerCallback(botToken, cq.id, "⛔ Yetkiniz yok!", true);
        return;
    }
    await answerCallback(botToken, cq.id, "İşlem yapılıyor...");

    const parts = data.split("_");
    const action = parts[0];
    const itemId = parts.slice(1).join("_");

    const reloadItems = async () => loadItems(db, userId);

    const editUrl = async (text, replyMarkup) => {
        await editMessageText(botToken, chatId, messageId, text, replyMarkup);
    };

    if (action === "dlv") {
        const items = await reloadItems();
        const item = items.find((i) => i.id === itemId);
        if (item && item.status === "active") {
            await updateItem(db, userId, item.id, {
                status: "delivered",
                deliveredAt: new Date(),
                deliveredBy: "Telegram",
                note: "",
                reminderDate: null,
            });
            const dateStr = new Date().toLocaleString("tr-TR");
            const broadcast = `✅ Teslimat (Telegram)\n\nMüşteri: ${item.customerName}\nTeslim edilen: ${item.bagCount} adet\nKaynak: Hızlı teslim\nTarih: ${dateStr}`;
            for (const tid of [...new Set(adminIds)]) {
                if (tid) await sendMessage(botToken, tid, broadcast, { parseMode: null });
            }
            await editUrl(`✅ ${item.customerName}\nteslim edildi.\nTelegram hızlı teslim.`);
        } else {
            await editUrl("❌ Bu kayıt artık aktif değil.");
        }
        return;
    }

    if (action === "ykvar") {
        const items = await reloadItems();
        const item = items.find((i) => i.id === itemId);
        const emptyKb = { inline_keyboard: [] };
        if (item && item.status === "active") {
            const noteLine = item.note ? `\n📝 Not: ${item.note}` : "";
            await editUrl(
                `✅ Var — ${item.customerName}\nBekleyen: ${item.bagCount} poşet${noteLine}\n(Beklemede, yoklama doğrulandı.)`,
                emptyKb,
            );
        } else if (item) {
            await editUrl(`${item.customerName} için kayıt artık bekleyen listede değil.`, emptyKb);
        } else {
            await editUrl("❌ Kayıt bulunamadı.", emptyKb);
        }
        return;
    }

    if (action === "ykdel") {
        const items = await reloadItems();
        const item = items.find((i) => i.id === itemId);
        const emptyKb = { inline_keyboard: [] };
        if (item && item.status === "active") {
            await updateItem(db, userId, item.id, {
                status: "delivered",
                deliveredAt: new Date(),
                deliveredBy: "Telegram yoklama",
                note: "",
                reminderDate: null,
            });
            const dateStr = new Date().toLocaleString("tr-TR");
            const broadcast = `✅ Teslimat (Telegram yoklama)\n\nMüşteri: ${item.customerName}\nTeslim edilen: ${item.bagCount} adet\nKaynak: Yoklama — Teslim\nTarih: ${dateStr}`;
            for (const tid of [...new Set(adminIds)]) {
                if (tid) await sendMessage(botToken, tid, broadcast, { parseMode: null });
            }
            await editUrl(
                `Teslim edildi (yoklama)\n\n${item.customerName}\n${item.bagCount} adet\nTeslim eden: Telegram yoklama`,
                emptyKb,
            );
        } else if (item) {
            await editUrl(`${item.customerName} — zaten teslim veya güncellenmiş.`, emptyKb);
        } else {
            await editUrl("❌ Kayıt bulunamadı.", emptyKb);
        }
        return;
    }

}

async function processTelegramCommand(db, userId, settings, message, logger) {
    if (!message || !message.text) return;

    const botToken = (settings.telegramBotToken || "").trim();
    if (!botToken) return;

    const text = message.text.trim();
    const chatId = message.chat.id;
    const user = message.from || { first_name: "Kanal", last_name: "Yöneticisi" };
    const senderName = message.chat.title
        ? `Kanal: ${message.chat.title}`
        : `${user.first_name || ""} ${user.last_name || ""}`.trim();

    const parts = text.split(/\s+/);
    const command = ((parts[0] && parts[0].split("@")[0]) || "").toLowerCase();

    const adminIds = (settings.telegramChatId || "").split(",").map((id) => id.trim());
    const isAdmin = adminIds.includes(String(chatId));

    let reply = "";
    let shouldBroadcast = false;

    let allItems = await loadItems(db, userId);
    const allCustomers = await loadCustomers(db, userId);
    const deliveryPersonnel = await loadDeliveryPersonnel(db, userId);

    const broadcastReply = async (msgText) => {
        for (const tid of [...new Set(adminIds)]) {
            if (tid) await sendMessage(botToken, tid, msgText, { parseMode: "Markdown" });
        }
    };

    try {
        switch (command) {
            case "/start":
            case "/basla": {
                if (message.chat.type === "channel") {
                    reply = `👋 Merhaba! Bu kanalın ID'si: \`${chatId}\`\nBu ID'yi sisteme ekleyerek bildirimleri buraya yönlendirebilirsiniz.`;
                    break;
                }
                let subscribers = settings.telegramSubscribers || [];
                if (!subscribers.some((s) => String(s.id) === String(chatId))) {
                    subscribers = [
                        ...subscribers,
                        { id: chatId, name: senderName, joinedAt: new Date().toISOString() },
                    ];
                    settings.telegramSubscribers = subscribers;
                    await saveSettingsMerge(db, userId, { telegramSubscribers: subscribers });
                    reply = `👋 Merhaba ${senderName}!\nDuyuru listesine başarıyla eklendiniz.`;
                } else {
                    reply = `👋 Tekrar merhaba ${senderName}! Zaten listedesiniz.`;
                }
                if (isAdmin) reply += "\n👑 Yetkili girişi doğrulandı. Komutları kullanabilirsiniz.";
                else {
                    reply += `\nℹ️ Şu an sadece duyuruları alabilirsiniz. İşlem yetkiniz yok.\n\nYetkili olmak için aşağıdaki ID'yi uygulama ayarlarına ekleyin:\n🆔 \`${chatId}\``;
                }
                break;
            }
            case "/id":
                reply = `🆔 *Hesap/Kanal Bilgileri*\n\n🔢 Chat ID: \`${chatId}\`\n👤 İsim/Başlık: ${senderName}`;
                if (isAdmin) reply += "\n\n✅ *DURUM: YETKİLİ (Mesaj Alabilir)*";
                else {
                    reply +=
                        "\n\n❌ *DURUM: KAYITSIZ*\n(Bu kanala bildirim gelmesi için yukarıdaki Chat ID'yi Ayarlar > Telegram Chat ID kutusuna ekleyin)";
                }
                break;
            case "/ping":
                reply = "🏓 Pong! Bot çevrimiçi (bulut).";
                break;
            case "/duyuru": {
                if (!isAdmin) {
                    reply = `⛔ Bu komutu kullanmaya yetkiniz yok.\n\nDuyuru göndermek için ID'nizi web panelindeki Ayarlar kısmına eklemelisiniz.\n🆔 ID'niz: \`${chatId}\``;
                    break;
                }
                const announcement = parts.slice(1).join(" ");
                if (!announcement) {
                    reply = "⚠️ Mesaj yazmadınız. Örn: `/duyuru Yarın kapalıyız`";
                    break;
                }
                if (isSundayIstanbul()) {
                    reply = "⛔ Pazar günleri duyuru gönderilemez.";
                    break;
                }
                const subscribers = settings.telegramSubscribers || [];
                const subIds = subscribers.map((s) => String(s.id));
                const allTargetIds = [...new Set([...adminIds, ...subIds])];
                if (allTargetIds.length === 0) reply = "⚠️ Gönderilecek kimse bulunamadı.";
                else {
                    let successCount = 0;
                    for (const targetId of allTargetIds) {
                        if (!targetId) continue;
                        await sendMessage(botToken, targetId, `📢 *DUYURU*\n\n${announcement}`);
                        successCount++;
                    }
                    reply = `✅ Duyuru ${successCount} kişiye gönderildi.`;
                }
                break;
            }
            case "/ekle": {
                if (!isAdmin) {
                    reply = "⛔ Yetkiniz yok.";
                    break;
                }
                if (parts.length < 2) {
                    reply = "⚠️ Kullanım: `/ekle [Müşteri Adı] [Adet]`";
                    break;
                }
                let bagCount = 1;
                let nameParts = parts.slice(1);
                const lastPart = nameParts[nameParts.length - 1];
                if (!isNaN(Number(lastPart)) && nameParts.length > 1) {
                    bagCount = parseInt(lastPart, 10);
                    nameParts.pop();
                }
                const customerName = toTrUpperCase(nameParts.join(" "));
                const activeItems = allItems.filter((item) => item.status === "active");
                const existingItem = activeItems.find(
                    (item) => toTrUpperCase(item.customerName) === customerName,
                );
                if (existingItem) {
                    const datesToAdd = Array(bagCount)
                        .fill(null)
                        .map(() => new Date());
                    await addBagsToExistingItem(
                        db,
                        userId,
                        existingItem.id,
                        existingItem.bagCount + bagCount,
                        datesToAdd,
                    );
                    reply = `📦 *Poşet Eklendi (Mevcut Müşteri)*\n\n👤 Müşteri: ${customerName}\n➕ Eklenen: ${bagCount} Adet\n🔢 Toplam: ${existingItem.bagCount + bagCount} Adet\n📅 Tarih: ${new Date().toLocaleDateString("tr-TR")}`;
                } else {
                    if (!allCustomers.some((c) => toTrUpperCase(c.name) === customerName)) {
                        await addCustomer(db, userId, customerName);
                    }
                    await addItem(db, userId, {
                        customerName,
                        bagCount,
                        note: "",
                        status: "active",
                        deliveredAt: null,
                        deliveredBy: null,
                        additionalDates: [],
                        reminderDate: null,
                    });
                    reply = `🆕 *Yeni Müşteri Kaydı*\n\n👤 Müşteri: ${customerName}\n🛍️ Adet: ${bagCount}\n📅 Tarih: ${new Date().toLocaleDateString("tr-TR")}`;
                }
                shouldBroadcast = true;
                break;
            }
            case "/teslim":
            case "/teslimet":
            case "/tset": {
                if (!isAdmin) {
                    reply = "⛔ Yetkiniz yok.";
                    break;
                }
                if (parts.length < 2) {
                    reply = "⚠️ Kullanım: `/teslim [Müşteri Adı]`";
                    break;
                }
                let count = 1;
                let nameParts = parts.slice(1);
                const lastPart = nameParts[nameParts.length - 1];
                if (!isNaN(Number(lastPart)) && nameParts.length > 1) {
                    count = parseInt(lastPart, 10);
                    nameParts.pop();
                }
                const customerName = toTrUpperCase(nameParts.join(" "));
                allItems = await loadItems(db, userId);
                const item = allItems.find(
                    (i) => i.status === "active" && toTrUpperCase(i.customerName) === customerName,
                );
                if (!item) reply = `❌ Bulunamadı: ${customerName}`;
                else {
                    const total = Number(item.bagCount);
                    const toDel = Math.min(count, total);
                    const rem = total - toDel;
                    const senderLabel = `Bot (${senderName})`;
                    await updateItemDeliverSplit(db, userId, item, toDel, senderLabel);
                    reply = `✅ ${customerName}: ${toDel} teslim edildi.${rem > 0 ? ` (Kalan: ${rem})` : " (Tamamı bitti)"}`;
                    shouldBroadcast = true;
                }
                break;
            }
            case "/sms": {
                if (!isAdmin) {
                    reply = "⛔ Yetkiniz yok.";
                    break;
                }
                if (parts.length < 2) {
                    reply = "⚠️ Örn: `/sms Ahmet`";
                    break;
                }
                const cName = toTrUpperCase(parts.slice(1).join(" "));
                allItems = await loadItems(db, userId);
                const item = allItems.find(
                    (i) => i.status === "active" && toTrUpperCase(i.customerName) === cName,
                );
                if (!item) reply = "❌ Müşteri bulunamadı.";
                else {
                    const days = Math.floor((Date.now() - itemCreatedDate(item).getTime()) / 86400000);
                    const tmpl = settings.shareTemplate || DEFAULT_SHARE_TMPL;
                    reply = `📱 *Hazır Mesaj:*\n\`${tmpl
                        .replace(/\[Müşteri Adı\]/gi, item.customerName)
                        .replace(/\[Poşet Sayısı\]/gi, item.bagCount)
                        .replace(/\[Bekleme Süresi\]/gi, days)}\``;
                }
                break;
            }
            case "/not": {
                if (!isAdmin) {
                    reply = "⛔ Yetkiniz yok.";
                    break;
                }
                if (parts.length < 3) {
                    reply = "⚠️ Örn: `/not Ahmet Notunuz`";
                    break;
                }
                const targetName = toTrUpperCase(parts[1]);
                allItems = await loadItems(db, userId);
                const activeItems = allItems.filter((i) => i.status === "active");
                let matchedItem =
                    activeItems.find((i) => toTrUpperCase(i.customerName) === targetName) ||
                    activeItems.find((i) => toTrUpperCase(i.customerName).startsWith(targetName));
                if (matchedItem) {
                    const note = parts.slice(2).join(" ");
                    await updateItem(db, userId, matchedItem.id, { note: toTrUpperCase(note) });
                    reply = `📝 *${matchedItem.customerName}* notu güncellendi.`;
                    shouldBroadcast = true;
                } else reply = "❌ Müşteri bulunamadı.";
                break;
            }
            case "/sil": {
                if (!isAdmin) {
                    reply = "⛔ Yetkiniz yok.";
                    break;
                }
                const cName = toTrUpperCase(parts.slice(1).join(" "));
                allItems = await loadItems(db, userId);
                const item = allItems.find(
                    (i) => i.status === "active" && toTrUpperCase(i.customerName) === cName,
                );
                if (item) {
                    await deleteItem(db, userId, item.id);
                    reply = `🗑️ Silindi: ${cName}`;
                    shouldBroadcast = true;
                } else reply = "❌ Bulunamadı.";
                break;
            }
            case "/bekleyen": {
                if (!isAdmin) {
                    reply = "⛔ Yetkiniz yok.";
                    break;
                }
                allItems = await loadItems(db, userId);
                const active = allItems.filter((i) => i.status === "active");
                if (active.length === 0) reply = "📂 Bekleyen yok.";
                else {
                    const inlineKeyboard = {
                        inline_keyboard: active.map((i) => [
                            { text: `✅ ${i.customerName} (${i.bagCount}) Teslim`, callback_data: `dlv_${i.id}` },
                        ]),
                    };
                    await sendMessage(botToken, chatId, "📋 *Hızlı Teslimat Menüsü*", {
                        parseMode: "Markdown",
                        reply_markup: inlineKeyboard,
                    });
                    return;
                }
                break;
            }
            case "/iade": {
                if (!isAdmin) {
                    reply = "⛔ Yetkiniz yok.";
                    break;
                }
                if (parts.length < 2) {
                    reply = "⚠️ Örn: `/iade Ahmet 1`";
                    break;
                }
                let count = 1;
                const p = [...parts];
                if (!isNaN(Number(p[p.length - 1]))) {
                    count = parseInt(p.pop(), 10);
                }
                const cName = toTrUpperCase(p.slice(1).join(" "));
                await addItem(db, userId, {
                    customerName: cName,
                    bagCount: count,
                    note: "İADE",
                    status: "active",
                    deliveredAt: null,
                    deliveredBy: null,
                    additionalDates: [],
                    reminderDate: null,
                });
                reply = `🔄 İade alındı: ${cName} (${count} ad)`;
                shouldBroadcast = true;
                break;
            }
            case "/yenile":
                reply = "☁️ Komutlar Firebase üzerinden işleniyor; bağlantı sürekli açık. Uygulama poll kullanmıyorsanız ek yenileme gerekmez.";
                break;
            case "/yedekal": {
                if (!isAdmin) {
                    reply = "⛔ Yetkiniz yok.";
                    break;
                }
                allItems = await loadItems(db, userId);
                const json = JSON.stringify(
                    serializeForBackup({
                        allItems,
                        allCustomers,
                        deliveryPersonnel,
                        settings: { ...settings, telegramBotToken: "[REDACTED]" },
                        exportedAt: new Date().toISOString(),
                    }),
                    null,
                    2,
                );
                const buf = Buffer.from(json, "utf8");
                await sendDocumentBuffer(
                    botToken,
                    chatId,
                    buf,
                    `yedek-${todayStrIstanbul()}.json`,
                    "📦 Manuel Yedek",
                    null,
                );
                return;
            }
            case "/pdf": {
                if (!isAdmin) {
                    reply = "⛔ Yetkiniz yok.";
                    break;
                }
                allItems = await loadItems(db, userId);
                const pdfBuf = activePdfBlob(allItems);
                if (!pdfBuf) reply = "⚠️ PDF boş.";
                else {
                    await sendDocumentBuffer(
                        botToken,
                        chatId,
                        pdfBuf,
                        `liste-${todayStrIstanbul()}.pdf`,
                        "📄 Liste",
                        null,
                    );
                    return;
                }
                break;
            }
            case "/yoklama": {
                if (!isAdmin) {
                    reply = "⛔ Yetkiniz yok.";
                    break;
                }
                allItems = await loadItems(db, userId);
                const active = allItems
                    .filter((i) => i.status === "active")
                    .sort((a, b) =>
                        toTrUpperCase(a.customerName).localeCompare(toTrUpperCase(b.customerName), "tr"),
                    );
                if (active.length === 0) {
                    reply = "📋 *Poşet yoklaması*\n\nBekleyen kayıt yok.";
                    break;
                }
                const totalBags = active.reduce((sum, row) => sum + row.bagCount, 0);
                await sendMessage(
                    botToken,
                    chatId,
                    `📋 Poşet yoklaması\n👥 ${active.length} müşteri · ${totalBags} poşet\nAşağıda her müşteri ayrı mesajdadır.`,
                    { parseMode: null },
                );
                let idx = 0;
                for (const item of active) {
                    idx += 1;
                    const noteLine = item.note ? `\n📝 Not: ${item.note}` : "";
                    const body = `Yoklama ${idx}/${active.length}\n\n${item.customerName}\n${item.bagCount} poşet${noteLine}`;
                    await sendMessage(botToken, chatId, body, {
                        parseMode: null,
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "✅ Var", callback_data: `ykvar_${item.id}` },
                                    { text: "❌ Teslim", callback_data: `ykdel_${item.id}` },
                                ],
                            ],
                        },
                    });
                    await new Promise((r) => setTimeout(r, 180));
                }
                return;
            }
            case "/ozet": {
                if (!isAdmin) {
                    reply = "⛔ Yetkiniz yok.";
                    break;
                }
                allItems = await loadItems(db, userId);
                const active = allItems.filter((i) => i.status === "active");
                const today = todayStrIstanbul();
                const todayDel = allItems.filter(
                    (i) => i.status === "delivered" && itemDeliveredDayStr(i) === today,
                );
                reply = `📊 *Özet*\n📦 Bekleyen: ${active.reduce((a, b) => a + b.bagCount, 0)}\n✅ Bugün Teslim: ${todayDel.reduce((a, b) => a + b.bagCount, 0)}`;
                break;
            }
            case "/gunsonu": {
                if (!isAdmin) {
                    reply = "⛔ Yetkiniz yok.";
                    break;
                }
                allItems = await loadItems(db, userId);
                const today = todayStrIstanbul();
                const added = allItems
                    .filter((i) => {
                        const ds = new Intl.DateTimeFormat("en-CA", {
                            timeZone: "Europe/Istanbul",
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                        }).format(itemCreatedDate(i));
                        return ds === today;
                    })
                    .reduce((a, b) => a + b.bagCount, 0);
                const del = allItems
                    .filter((i) => i.status === "delivered" && itemDeliveredDayStr(i) === today)
                    .reduce((a, b) => a + b.bagCount, 0);
                const devir = allItems.filter((i) => i.status === "active").reduce((a, b) => a + b.bagCount, 0);
                reply = `🌙 *Gün Sonu (${today})*\n➕ Eklenen: ${added}\n✅ Teslim: ${del}\n📦 Devir: ${devir}`;
                break;
            }
            case "/help":
            case "/yardim":
                reply =
                    "🤖 *Bot Komutları (bulut)*\n\n" +
                    "➕ `/ekle` — Yeni poşet ekle\nÖrn: `/ekle Ahmet 2`\n\n" +
                    "✅ `/teslim` — Poşet teslim et\nÖrn: `/teslim Ahmet 1`\n\n" +
                    "📋 `/bekleyen` — Bekleyenleri listele, butonla teslim et\n\n" +
                    "📋 `/yoklama` — Yoklama mesajları\n\n" +
                    "📊 `/ozet` — Özet\n\n" +
                    "🌙 `/gunsonu` — Gün sonu\n\n" +
                    "📱 `/sms` — Hazır mesaj metni\n\n" +
                    "📝 `/not` — Not ekle\n\n" +
                    "📄 `/pdf` — Bekleyen listesi PDF\n\n" +
                    "💾 `/yedekal` — JSON yedek\n\n" +
                    "🔄 `/iade` — İade\n\n" +
                    "📢 `/duyuru` — Duyuru\n\n" +
                    "🗑️ `/sil` — Sil\n\n" +
                    "🆔 `/id` — Chat ID\n\n" +
                    "❓ `/yardim` — Bu liste\n\n" +
                    "🏓 `/ping` — Bağlantı testi\n\n" +
                    "👋 `/basla` — Abonelik";
                break;
            default:
                return;
        }

        if (reply) {
            if (shouldBroadcast) await broadcastReply(reply);
            else await sendMessage(botToken, chatId, reply, { parseMode: "Markdown" });
        }
    } catch (err) {
        logger.error("Bot komut hatası:", err);
        if (isAdmin) await sendMessage(botToken, chatId, `⚠️ Hata: ${err.message}`, { parseMode: null });
    }
}

async function handleWebhookRequest(req, res, db, logger) {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }

    const secretQ =
        typeof req.query?.s === "string"
            ? req.query.s
            : Array.isArray(req.query?.s)
              ? req.query.s[0]
              : "";
    const headerSecret = req.get("X-Telegram-Bot-Api-Secret-Token") || "";

    let body = req.body;
    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
        } catch {
            res.status(400).send("Bad Request");
            return;
        }
    }

    const userId = await resolveUserIdFromWebhook(db, secretQ, headerSecret);
    if (!userId) {
        logger.warn("Webhook: geçersiz secret veya eşleşme yok");
        res.status(403).send("Forbidden");
        return;
    }

    const settings = await loadSettings(db, userId);
    const botToken = (settings.telegramBotToken || "").trim();
    if (!botToken) {
        res.status(200).json({ ok: true });
        return;
    }

    const update = body;
    const updateId = update.update_id;
    if (!updateId) {
        res.status(200).json({ ok: true });
        return;
    }

    const owns = await tryClaimTelegramUpdate(db, userId, updateId);
    if (!owns) {
        res.status(200).json({ ok: true });
        return;
    }

    if (isSundayIstanbul()) {
        res.status(200).json({ ok: true });
        return;
    }

    try {
        if (update.message && update.message.text) {
            await processTelegramCommand(db, userId, settings, update.message, logger);
        }
        if (update.channel_post && update.channel_post.text) {
            await processTelegramCommand(db, userId, settings, update.channel_post, logger);
        }
        if (update.callback_query) {
            await processCallbackQuery(db, userId, settings, update.callback_query, botToken, logger);
        }
    } catch (err) {
        logger.error("Webhook işleme:", err);
    }

    res.status(200).json({ ok: true });
}

module.exports = {
    handleWebhookRequest,
    registerWebhook,
    clearWebhook,
    buildWebhookUrl,
};
