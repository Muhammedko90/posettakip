package com.emrebebe.posettakip.bridge;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationManagerCompat;

import com.emrebebe.posettakip.notifications.PosetMessagingService;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.messaging.FirebaseMessaging;

import java.lang.ref.WeakReference;

/**
 * Web (JS) tarafının native FCM ile konuşmasını sağlayan Capacitor plugin'i.
 *
 * Web tarafından çağrılabilir method'lar:
 *   - getToken()              -> SharedPreferences cache'i ya da FirebaseMessaging'ten
 *                                tokenı alıp { token } olarak döner.
 *   - deleteToken()           -> Cihazdaki FCM token'ı geçersizleştirir, cache'i temizler.
 *   - getPermissionState()    -> { notifications: 'granted'|'denied' }
 *   - requestPermissions()    -> Android 13+ POST_NOTIFICATIONS runtime izni ister.
 *
 * Web tarafının dinleyebileceği event:
 *   - tokenRefresh -> { token } (FCM token yenilendiğinde fire edilir)
 *
 * Web tarafı bu plugin'i şu şekilde alır:
 *   import { registerPlugin } from '../vendor/capacitor-core.js';
 *   const FcmBridge = registerPlugin('FcmBridge');
 */
@CapacitorPlugin(
        name = "FcmBridge",
        permissions = {
                @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
        }
)
public class FcmBridgePlugin extends Plugin {

    /**
     * PosetMessagingService.onNewToken servisten çağırabilsin diye plugin örneğine
     * weak referans tutuyoruz (Activity yok edildiğinde sızıntı yapmasın).
     */
    private static WeakReference<FcmBridgePlugin> instanceRef;

    @Override
    public void load() {
        super.load();
        instanceRef = new WeakReference<>(this);
    }

    @Override
    protected void handleOnDestroy() {
        if (instanceRef != null && instanceRef.get() == this) {
            instanceRef.clear();
        }
        super.handleOnDestroy();
    }

    /**
     * Servisten dışarıdan çağrılır: token yenilendiğinde web'i uyarır.
     * Plugin yüklü değilse (uygulama arka planda) sessizce yutar.
     */
    public static void emitTokenRefresh(String token) {
        FcmBridgePlugin plugin = instanceRef != null ? instanceRef.get() : null;
        if (plugin == null) return;
        JSObject data = new JSObject();
        data.put("token", token != null ? token : "");
        plugin.notifyListeners("tokenRefresh", data);
    }

    @PluginMethod
    public void getToken(final PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(
                PosetMessagingService.PREFS_NAME, Context.MODE_PRIVATE);
        String cached = prefs.getString(PosetMessagingService.PREF_KEY_TOKEN, null);

        if (cached != null && !cached.isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("token", cached);
            call.resolve(ret);
            return;
        }

        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null) {
                Exception err = task.getException();
                call.reject(
                        err != null ? err.getMessage() : "FCM token alınamadı",
                        err
                );
                return;
            }
            String token = task.getResult();
            prefs.edit().putString(PosetMessagingService.PREF_KEY_TOKEN, token).apply();
            JSObject ret = new JSObject();
            ret.put("token", token);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void deleteToken(final PluginCall call) {
        FirebaseMessaging.getInstance().deleteToken().addOnCompleteListener(task -> {
            Context ctx = getContext();
            SharedPreferences prefs = ctx.getSharedPreferences(
                    PosetMessagingService.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().remove(PosetMessagingService.PREF_KEY_TOKEN).apply();

            if (task.isSuccessful()) {
                call.resolve();
            } else {
                Exception err = task.getException();
                call.reject(
                        err != null ? err.getMessage() : "deleteToken başarısız",
                        err
                );
            }
        });
    }

    @PluginMethod
    public void getPermissionState(PluginCall call) {
        boolean enabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        JSObject ret = new JSObject();
        ret.put("notifications", enabled ? "granted" : "denied");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        // Android 12 ve altında runtime izin diye bir şey yok – manifest izni yeterli.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            JSObject ret = new JSObject();
            boolean enabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
            ret.put("notifications", enabled ? "granted" : "denied");
            call.resolve(ret);
            return;
        }

        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("notifications", "granted");
            call.resolve(ret);
            return;
        }

        requestPermissionForAlias("notifications", call, "notificationsPermissionCallback");
    }

    @PermissionCallback
    private void notificationsPermissionCallback(PluginCall call) {
        PermissionState state = getPermissionState("notifications");
        JSObject ret = new JSObject();
        ret.put("notifications", state == PermissionState.GRANTED ? "granted" : "denied");
        call.resolve(ret);
    }
}
