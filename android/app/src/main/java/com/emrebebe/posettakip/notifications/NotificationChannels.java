package com.emrebebe.posettakip.notifications;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.emrebebe.posettakip.R;

/**
 * Push bildirim kanallarını yöneten yardımcı sınıf.
 *
 * Android 8.0 (API 26) ve sonrasında her bildirim bir "channel" üzerinden gönderilmek zorunda.
 * Android 13 (API 33) ile birlikte de kanallar varsayılan olarak kapalı görünebilir; bu yüzden
 * uygulama ilk açıldığında kanalları kayıt ederiz ki kullanıcı Ayarlar -> Bildirimler ekranında
 * her birini açıp kapatabilsin.
 */
public final class NotificationChannels {

    /** Yeni poşet eklendiğinde gönderilen bildirimler için kanal. */
    public static final String CHANNEL_NEW_BAG = "poset_yeni";

    /** Bir poşet "teslim edildi" olarak işaretlendiğinde gönderilen bildirimler için kanal. */
    public static final String CHANNEL_DELIVERED = "poset_teslim";

    /** Hangi tipte olduğu belli olmayan / sunucudan gelen genel bildirimler için kanal. */
    public static final String CHANNEL_DEFAULT = "poset_genel";

    private NotificationChannels() { /* no-op */ }

    /**
     * Tüm kanalları (varsa zaten oluşturulmuşsa Android sistemi sessizce yok sayar).
     * Application.onCreate ya da ilk Activity başlatılırken çağrılmalı.
     */
    public static void createAll(@NonNull Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager nm = ContextCompat.getSystemService(context, NotificationManager.class);
        if (nm == null) {
            return;
        }

        Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        AudioAttributes audioAttrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

        NotificationChannel newBag = new NotificationChannel(
                CHANNEL_NEW_BAG,
                context.getString(R.string.notif_channel_new_bag_name),
                NotificationManager.IMPORTANCE_HIGH
        );
        newBag.setDescription(context.getString(R.string.notif_channel_new_bag_desc));
        newBag.enableLights(true);
        newBag.enableVibration(true);
        newBag.setVibrationPattern(new long[]{0, 250, 200, 250});
        newBag.setSound(defaultSound, audioAttrs);
        newBag.setShowBadge(true);

        NotificationChannel delivered = new NotificationChannel(
                CHANNEL_DELIVERED,
                context.getString(R.string.notif_channel_delivered_name),
                NotificationManager.IMPORTANCE_DEFAULT
        );
        delivered.setDescription(context.getString(R.string.notif_channel_delivered_desc));
        delivered.enableLights(true);
        delivered.enableVibration(true);
        delivered.setSound(defaultSound, audioAttrs);
        delivered.setShowBadge(true);

        NotificationChannel general = new NotificationChannel(
                CHANNEL_DEFAULT,
                context.getString(R.string.notif_channel_default_name),
                NotificationManager.IMPORTANCE_DEFAULT
        );
        general.setDescription(context.getString(R.string.notif_channel_default_desc));
        general.setShowBadge(true);

        nm.createNotificationChannel(newBag);
        nm.createNotificationChannel(delivered);
        nm.createNotificationChannel(general);
    }

    /**
     * Gelen mesajın "type" alanına göre ilgili kanalın id'sini döndürür.
     * Bilinmeyen tipler için varsayılan kanala düşer.
     */
    @NonNull
    public static String resolveChannelId(String type) {
        if (type == null) return CHANNEL_DEFAULT;
        switch (type) {
            case "new_bag":
            case "poset_eklendi":
                return CHANNEL_NEW_BAG;
            case "delivered":
            case "poset_teslim":
                return CHANNEL_DELIVERED;
            default:
                return CHANNEL_DEFAULT;
        }
    }
}
