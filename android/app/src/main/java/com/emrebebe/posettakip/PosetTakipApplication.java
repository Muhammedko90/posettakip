package com.emrebebe.posettakip;

import android.app.Application;

import com.emrebebe.posettakip.notifications.NotificationChannels;

/**
 * Uygulama global Application sınıfı.
 *
 * Process daha ilk yaratıldığında bildirim kanallarını kayıt ediyoruz; böylece kullanıcı
 * hiç bildirim almadan önce bile Sistem Ayarları -> Uygulamalar -> Poşet Takip -> Bildirimler
 * ekranında kanal başlıklarını görebilir.
 */
public class PosetTakipApplication extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationChannels.createAll(this);
    }
}
