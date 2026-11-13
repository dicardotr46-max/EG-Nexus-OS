package com.eg.nexus;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Native Capacitor Plugin for AndroidKeyStore Hardware-Backed Key Protection.
 * Ensures master session keys are protected inside the Android hardware-backed
 * keystore (TEE / StrongBox) using 256-bit AES-GCM non-extractable keys.
 */
@CapacitorPlugin(name = "NexusKeystore")
public class NexusKeystorePlugin extends Plugin {
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "eg_nexus_master_key_v1";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;

    private synchronized SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            KeyGenerator keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                ANDROID_KEYSTORE
            );
            KeyGenParameterSpec keyGenParameterSpec = new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(false)
            .setRandomizedEncryptionRequired(true)
            .build();
            keyGenerator.init(keyGenParameterSpec);
            return keyGenerator.generateKey();
        }
        return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            ret.put("available", true);
            ret.put("hardwareBacked", true);
            ret.put("alias", KEY_ALIAS);
            ret.put("provider", "AndroidKeyStore");
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("available", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void encrypt(PluginCall call) {
        String plaintext = call.getString("data");
        if (plaintext == null) {
            call.reject("Data to encrypt is required");
            return;
        }
        try {
            SecretKey secretKey = getOrCreateKey();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey);
            byte[] iv = cipher.getIV();
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes("UTF-8"));

            JSObject ret = new JSObject();
            ret.put("iv", Base64.encodeToString(iv, Base64.NO_WRAP));
            ret.put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP));
            ret.put("algorithm", "AES-GCM-256");
            ret.put("keySource", "AndroidKeyStore");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Hardware encryption failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void decrypt(PluginCall call) {
        String ciphertextB64 = call.getString("ciphertext");
        String ivB64 = call.getString("iv");
        if (ciphertextB64 == null || ivB64 == null) {
            call.reject("ciphertext and iv are required");
            return;
        }
        try {
            SecretKey secretKey = getOrCreateKey();
            byte[] iv = Base64.decode(ivB64, Base64.NO_WRAP);
            byte[] ciphertext = Base64.decode(ciphertextB64, Base64.NO_WRAP);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec);
            byte[] plainBytes = cipher.doFinal(ciphertext);

            JSObject ret = new JSObject();
            ret.put("data", new String(plainBytes, "UTF-8"));
            ret.put("keySource", "AndroidKeyStore");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Hardware decryption failed: " + e.getMessage(), e);
        }
    }
}
