package com.eg.nexus;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Native Capacitor Plugin for AndroidKeyStore Hardware-Backed Key Protection.
 * Ensures master session keys are protected inside the Android hardware-backed
 * keystore (StrongBox Keymaster / Standard TEE) using 256-bit AES-GCM non-extractable keys.
 */
@CapacitorPlugin(name = "NexusKeystore")
public class NexusKeystorePlugin extends Plugin {
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "eg_nexus_master_key_v1";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;

    private synchronized SecretKey getOrCreateSecretKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                try {
                    return generateSecretKey(true);
                } catch (Exception e) {
                    // StrongBoxUnavailableException or hardware limitation -> automatic fallback to standard TEE
                    return generateSecretKey(false);
                }
            } else {
                return generateSecretKey(false);
            }
        }
        return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
    }

    private synchronized SecretKey getOrCreateKey() throws Exception {
        return getOrCreateSecretKey();
    }

    private SecretKey generateSecretKey(boolean useStrongBox) throws Exception {
        KeyGenerator keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE
        );
        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .setUserAuthenticationRequired(false)
        .setRandomizedEncryptionRequired(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && useStrongBox) {
            builder.setIsStrongBoxBacked(true);
        }

        keyGenerator.init(builder.build());
        return keyGenerator.generateKey();
    }

    private JSObject inspectKeySecurity(SecretKey secretKey) {
        JSObject info = new JSObject();
        try {
            SecretKeyFactory factory = SecretKeyFactory.getInstance(secretKey.getAlgorithm(), ANDROID_KEYSTORE);
            KeyInfo keyInfo = (KeyInfo) factory.getKeySpec(secretKey, KeyInfo.class);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) { // API 31+
                int securityLevel = keyInfo.getSecurityLevel();
                if (securityLevel == KeyProperties.SECURITY_LEVEL_STRONGBOX) {
                    info.put("hardwareBacked", true);
                    info.put("securityLevel", "strongbox");
                } else if (securityLevel == KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT) {
                    info.put("hardwareBacked", true);
                    info.put("securityLevel", "tee");
                } else {
                    info.put("hardwareBacked", false);
                    info.put("securityLevel", "software");
                }
            } else {
                boolean insideSecureHardware = keyInfo.isInsideSecureHardware();
                info.put("hardwareBacked", insideSecureHardware);
                info.put("securityLevel", insideSecureHardware ? "tee" : "software");
            }
        } catch (Exception e) {
            info.put("hardwareBacked", false);
            info.put("securityLevel", "software");
            info.put("inspectError", e.getMessage());
        }
        return info;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            SecretKey secretKey = getOrCreateSecretKey();
            JSObject sec = inspectKeySecurity(secretKey);
            ret.put("available", true);
            ret.put("hardwareBacked", sec.getBool("hardwareBacked", false));
            ret.put("securityLevel", sec.getString("securityLevel", "software"));
            ret.put("alias", KEY_ALIAS);
            ret.put("provider", ANDROID_KEYSTORE);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("available", false);
            ret.put("hardwareBacked", false);
            ret.put("securityLevel", "software");
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void getKeySecurityInfo(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            SecretKey secretKey = getOrCreateSecretKey();
            JSObject sec = inspectKeySecurity(secretKey);
            ret.put("available", true);
            ret.put("hardwareBacked", sec.getBool("hardwareBacked", false));
            ret.put("securityLevel", sec.getString("securityLevel", "software"));
            ret.put("alias", KEY_ALIAS);
            ret.put("provider", ANDROID_KEYSTORE);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("available", false);
            ret.put("hardwareBacked", false);
            ret.put("securityLevel", "software");
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
        String aad = call.getString("aad");
        try {
            SecretKey secretKey = getOrCreateSecretKey();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey);
            if (aad != null && !aad.isEmpty()) {
                cipher.updateAAD(aad.getBytes(StandardCharsets.UTF_8));
            }
            byte[] iv = cipher.getIV();
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            JSObject ret = new JSObject();
            ret.put("iv", Base64.encodeToString(iv, Base64.NO_WRAP));
            ret.put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP));
            ret.put("algorithm", "AES-GCM-256");
            ret.put("keySource", "AndroidKeyStore");
            if (aad != null) {
                ret.put("aad", aad);
            }
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
        String aad = call.getString("aad");
        try {
            SecretKey secretKey = getOrCreateSecretKey();
            byte[] iv = Base64.decode(ivB64, Base64.NO_WRAP);
            byte[] ciphertext = Base64.decode(ciphertextB64, Base64.NO_WRAP);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec);
            if (aad != null && !aad.isEmpty()) {
                cipher.updateAAD(aad.getBytes(StandardCharsets.UTF_8));
            }
            byte[] plainBytes = cipher.doFinal(ciphertext);

            JSObject ret = new JSObject();
            ret.put("data", new String(plainBytes, StandardCharsets.UTF_8));
            ret.put("keySource", "AndroidKeyStore");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Hardware decryption failed: " + e.getMessage(), e);
        }
    }
}
