package com.emrebebe.posettakip;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.emrebebe.posettakip.bridge.FcmBridgePlugin;
import com.emrebebe.posettakip.notifications.NotificationChannels;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "PosetFCM";
    private static final int REQ_POST_NOTIFICATIONS = 4711;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Capacitor: registerPlugin çağrısı super.onCreate'ten ÖNCE yapılmalı,
        // aksi halde plugin köprü oluştururken bulunamaz.
        registerPlugin(FcmBridgePlugin.class);
        super.onCreate(savedInstanceState);

        // Android 8.0+ kanalları her açılışta idempotent şekilde tekrar kayıt eder.
        NotificationChannels.createAll(this);

        ensureNotificationPermission();
        fetchAndStoreFcmToken();
    }

    /**
     * Android 13 (API 33) ve sonrasında POST_NOTIFICATIONS runtime izni gerekir.
     * Daha düşük sürümler manifest izni ile yetinir; bu yüzden yalnızca koşullu istiyoruz.
     */
    private void ensureNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return;
        }
        int granted = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS);
        if (granted != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    REQ_POST_NOTIFICATIONS
            );
        }
    }

    /**
     * Cihaz için güncel FCM token'ı alır ve SharedPreferences'a yazar.
     * Web (Capacitor) tarafı bu değeri okuyarak Firestore'daki users/{uid}/devices/{token}
     * dokümanına yazabilir; Cloud Functions de aynı koleksiyonu okuyup hedefli mesaj gönderir.
     */
    private void fetchAndStoreFcmToken() {
        FirebaseMessaging.getInstance().getToken()
                .addOnCompleteListener(new OnCompleteListener<String>() {
                    @Override
                    public void onComplete(@NonNull Task<String> task) {
                        if (!task.isSuccessful()) {
                            Log.w(TAG, "FCM token alınamadı", task.getException());
                            return;
                        }
                        String token = task.getResult();
                        Log.d(TAG, "Geçerli FCM token: " + token);
                        getSharedPreferences(
                                com.emrebebe.posettakip.notifications.PosetMessagingService.PREFS_NAME,
                                MODE_PRIVATE
                        ).edit().putString(
                                com.emrebebe.posettakip.notifications.PosetMessagingService.PREF_KEY_TOKEN,
                                token
                        ).apply();
                    }
                });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_POST_NOTIFICATIONS) {
            boolean granted = grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            Log.d(TAG, "POST_NOTIFICATIONS izni " + (granted ? "verildi" : "reddedildi"));
        }
    }
}
