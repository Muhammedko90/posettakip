package com.emrebebe.posettakip.notifications;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.emrebebe.posettakip.MainActivity;
import com.emrebebe.posettakip.R;
import com.emrebebe.posettakip.bridge.FcmBridgePlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Uygulamanın FCM giriş noktası.
 *
 * 1) Cihazın FCM token'ı yenilendiğinde {@link #onNewToken(String)} çağrılır. Token'ı
 *    {@link SharedPreferences}'a yazarız; web (Capacitor) tarafı buradan alıp Firestore'daki
 *    {@code users/{uid}/devices/{token}} koleksiyonuna kaydedebilir. (Bkz. README'deki not.)
 *
 * 2) Sunucudan (örn. Cloud Functions) gelen mesajlar {@link #onMessageReceived(RemoteMessage)}
 *    içine düşer. Mesajın {@code data.type} alanına göre uygun kanal seçilir:
 *      - "new_bag"   -> CHANNEL_NEW_BAG  (yeni poşet)
 *      - "delivered" -> CHANNEL_DELIVERED (teslim edildi)
 *      - diğer       -> CHANNEL_DEFAULT
 *
 * Önerilen mesaj formatı (Cloud Functions tarafında):
 * <pre>
 * {
 *   "data": {
 *     "type": "new_bag",
 *     "title": "Yeni Poşet",
 *     "body":  "Ahmet için 2 poşet eklendi.",
 *     "itemId": "abc123",
 *     "customerName": "Ahmet"
 *   }
 * }
 * </pre>
 * Sadece "data" payload'u kullandığınızda uygulama hem ön planda hem arka planda
 * bildirimi bu sınıf üzerinden render eder ve özelleştirebilirsiniz.
 */
public class PosetMessagingService extends FirebaseMessagingService {

    private static final String TAG = "PosetFCM";

    /** Token'ı web tarafının okuyabilmesi için SharedPreferences anahtarı. */
    public static final String PREFS_NAME = "poset_fcm";
    public static final String PREF_KEY_TOKEN = "fcm_token";

    /** Aynı anda birden fazla bildirim için id sayacı. */
    private static final AtomicInteger NOTIFICATION_ID_GEN = new AtomicInteger(1000);

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "Yeni FCM token alındı: " + token);

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(PREF_KEY_TOKEN, token).apply();

        // Web (Capacitor) tarafına yenilenen token'ı duyur. Plugin yüklü değilse
        // (ör. uygulama tamamen kapalıyken token yenilenmiş) sessizce yutulur;
        // bir sonraki açılışta MainActivity / FcmBridge.getToken() aynı değeri okur.
        try {
            FcmBridgePlugin.emitTokenRefresh(token);
        } catch (Throwable ignored) {
            // Plugin sınıfı henüz yüklenmemişse hata vermez; emniyet için catch.
        }
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);

        Map<String, String> data = message.getData();
        RemoteMessage.Notification notif = message.getNotification();

        String type = data.get("type");
        String title = data.containsKey("title")
                ? data.get("title")
                : (notif != null ? notif.getTitle() : getString(R.string.app_name));
        String body = data.containsKey("body")
                ? data.get("body")
                : (notif != null ? notif.getBody() : "");

        if (title == null) title = getString(R.string.app_name);
        if (body == null) body = "";

        Log.d(TAG, "FCM mesajı alındı. type=" + type + " title=" + title);

        showNotification(type, title, body, data);
    }

    private void showNotification(String type, @NonNull String title, @NonNull String body,
                                  @NonNull Map<String, String> data) {
        String channelId = NotificationChannels.resolveChannelId(type);

        Intent launch = new Intent(this, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        for (Map.Entry<String, String> e : data.entrySet()) {
            launch.putExtra(e.getKey(), e.getValue());
        }

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentIntent = PendingIntent.getActivity(
                this, NOTIFICATION_ID_GEN.get(), launch, piFlags);

        Uri sound = android.media.RingtoneManager
                .getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);

        int accent = ContextCompat.getColor(this, R.color.colorPrimary);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.drawable.ic_stat_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setColor(accent)
                .setAutoCancel(true)
                .setContentIntent(contentIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setDefaults(NotificationCompat.DEFAULT_LIGHTS | NotificationCompat.DEFAULT_VIBRATE)
                .setSound(sound);

        NotificationManager nm = ContextCompat.getSystemService(this, NotificationManager.class);
        if (nm == null) return;
        nm.notify(NOTIFICATION_ID_GEN.incrementAndGet(), builder.build());
    }
}
