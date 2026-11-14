package com.eg.nexus;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Native Capacitor Plugin for AndroidKeyStore Hardware-Backed Key Protection.
 * Ensures master session keys are protected inside the Android hardware-backed
 * keystore (StrongBox Keymaster / Standard TEE) using 256-bit AES-GCM non-extractable keys.
 * Supports crash-safe, transactional zero-data-loss migration to StrongBox with persistent journal.
 */
@CapacitorPlugin(name = "NexusKeystore")
public class NexusKeystorePlugin extends Plugin {
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    public static final String KEY_ALIAS_V1 = "eg_nexus_master_aes_key";
    public static final String KEY_ALIAS_STRONGBOX_V2 = "eg_nexus_master_aes_key_sb_v2";
    public static final String KEY_ALIAS_LEGACY = "eg_nexus_master_key_v1";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;

    // Crash-Safe Transaction Journal Constants
    public static final String JOURNAL_PREFS_NAME = "eg_nexus_keystore_journal";
    public static final String JOURNAL_KEY_MIGRATION_STATE = "migration_state";

    public static final String STATE_ACTIVE_V1 = "ACTIVE_V1";
    public static final String STATE_MIGRATION_PREPARED = "MIGRATION_PREPARED";
    public static final String STATE_V2_KEY_CREATED = "V2_KEY_CREATED";
    public static final String STATE_V2_DATA_VERIFIED = "V2_DATA_VERIFIED";
    public static final String STATE_STORAGE_COMMITTED = "STORAGE_COMMITTED";
    public static final String STATE_ACTIVE_V2 = "ACTIVE_V2";
    public static final String STATE_DELETE_OLD_KEYS = "DELETE_OLD_KEYS";

    private String memoryJournalState = null;

    @Override
    public void load() {
        super.load();
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            recoverInterruptedMigration(keyStore);
        } catch (Exception ignored) {}
    }

    private synchronized String getJournalState(KeyStore keyStore) {
        String state = null;
        try {
            Context context = getContext();
            if (context != null) {
                SharedPreferences prefs = context.getSharedPreferences(JOURNAL_PREFS_NAME, Context.MODE_PRIVATE);
                state = prefs.getString(JOURNAL_KEY_MIGRATION_STATE, null);
            }
        } catch (Exception ignored) {}

        if (state == null) {
            state = memoryJournalState;
        }

        if (state == null) {
            if (keyStore != null) {
                try {
                    if (keyStore.containsAlias(KEY_ALIAS_STRONGBOX_V2)
                            && !keyStore.containsAlias(KEY_ALIAS_V1)
                            && !keyStore.containsAlias(KEY_ALIAS_LEGACY)) {
                        state = STATE_ACTIVE_V2;
                    } else {
                        state = STATE_ACTIVE_V1;
                    }
                } catch (Exception e) {
                    state = STATE_ACTIVE_V1;
                }
            } else {
                state = STATE_ACTIVE_V1;
            }
            setJournalState(state);
        }
        return state;
    }

    private synchronized void setJournalState(String state) {
        this.memoryJournalState = state;
        Context context = getContext();
        if (context != null) {
            SharedPreferences prefs = context.getSharedPreferences(JOURNAL_PREFS_NAME, Context.MODE_PRIVATE);
            boolean committed = prefs.edit().putString(JOURNAL_KEY_MIGRATION_STATE, state).commit();
            if (!committed) {
                throw new IllegalStateException("Failed to persist StrongBox journal state: " + state);
            }
        }
    }

    /**
     * Critical crash recovery routine.
     * Evaluates journal state on boot / method execution:
     * - Intermediate states ("MIGRATION_PREPARED", "V2_KEY_CREATED", "V2_DATA_VERIFIED"):
     *   The app crashed before client storage persisted new ciphertext!
     *   Deletes KEY_ALIAS_STRONGBOX_V2 and resets to ACTIVE_V1. Old data remains 100% decryptable with V1 key.
     * - "STORAGE_COMMITTED":
     *   The app crashed after client storage wrote new ciphertext, but before old keys were purged.
     *   Completes migration: sets state to ACTIVE_V2 and deletes old keys.
     */
    private synchronized boolean recoverInterruptedMigration(KeyStore keyStore) {
        if (keyStore == null) {
            try {
                keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
                keyStore.load(null);
            } catch (Exception e) {
                return false;
            }
        }
        String state = getJournalState(keyStore);
        boolean recovered = false;
        try {
            if (STATE_MIGRATION_PREPARED.equals(state)
                    || STATE_V2_KEY_CREATED.equals(state)
                    || STATE_V2_DATA_VERIFIED.equals(state)) {
                if (keyStore.containsAlias(KEY_ALIAS_STRONGBOX_V2)) {
                    keyStore.deleteEntry(KEY_ALIAS_STRONGBOX_V2);
                }
                setJournalState(STATE_ACTIVE_V1);
                recovered = true;
            } else if (STATE_STORAGE_COMMITTED.equals(state)) {
                setJournalState(STATE_ACTIVE_V2);
                if (keyStore.containsAlias(KEY_ALIAS_V1)) {
                    keyStore.deleteEntry(KEY_ALIAS_V1);
                }
                if (keyStore.containsAlias(KEY_ALIAS_LEGACY)) {
                    keyStore.deleteEntry(KEY_ALIAS_LEGACY);
                }
                recovered = true;
            }
        } catch (Exception ignored) {}
        return recovered;
    }

    /**
     * Resolves the authoritative active key alias based on journal state.
     * Never selects KEY_ALIAS_STRONGBOX_V2 unless the journal has verified
     * or committed migration.
     */
    private synchronized String getActiveKeyAlias(KeyStore keyStore) throws Exception {
        String state = getJournalState(keyStore);
        if ((STATE_ACTIVE_V2.equals(state) || STATE_STORAGE_COMMITTED.equals(state) || STATE_DELETE_OLD_KEYS.equals(state))
                && keyStore.containsAlias(KEY_ALIAS_STRONGBOX_V2)) {
            return KEY_ALIAS_STRONGBOX_V2;
        }
        if (keyStore.containsAlias(KEY_ALIAS_V1)) {
            return KEY_ALIAS_V1;
        }
        if (keyStore.containsAlias(KEY_ALIAS_LEGACY)) {
            return KEY_ALIAS_LEGACY;
        }
        return KEY_ALIAS_V1;
    }

    private synchronized SecretKey getOrCreateSecretKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);
        recoverInterruptedMigration(keyStore);
        String activeAlias = getActiveKeyAlias(keyStore);
        if (keyStore.containsAlias(activeAlias)) {
            return (SecretKey) keyStore.getKey(activeAlias, null);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                SecretKey k = generateSecretKey(KEY_ALIAS_STRONGBOX_V2, true);
                setJournalState(STATE_ACTIVE_V2);
                return k;
            } catch (Exception e) {
                // Fallback to standard TEE with V1 alias if StrongBox unavailable
                SecretKey k = generateSecretKey(KEY_ALIAS_V1, false);
                setJournalState(STATE_ACTIVE_V1);
                return k;
            }
        } else {
            SecretKey k = generateSecretKey(KEY_ALIAS_V1, false);
            setJournalState(STATE_ACTIVE_V1);
            return k;
        }
    }

    private synchronized SecretKey getOrCreateKey() throws Exception {
        return getOrCreateSecretKey();
    }

    private SecretKey generateSecretKey(String alias, boolean useStrongBox) throws Exception {
        KeyGenerator keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE
        );
        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
            alias,
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

    private SecretKey generateSecretKey(boolean useStrongBox) throws Exception {
        return generateSecretKey(KEY_ALIAS_V1, useStrongBox);
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
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            recoverInterruptedMigration(keyStore);
            SecretKey secretKey = getOrCreateSecretKey();
            JSObject sec = inspectKeySecurity(secretKey);
            String activeAlias = getActiveKeyAlias(keyStore);
            String journalState = getJournalState(keyStore);
            ret.put("available", true);
            ret.put("hardwareBacked", Boolean.TRUE.equals(sec.getBool("hardwareBacked")));
            String secLevel = sec.getString("securityLevel");
            ret.put("securityLevel", secLevel != null ? secLevel : "software");
            ret.put("alias", activeAlias);
            ret.put("journalState", journalState);
            ret.put("provider", ANDROID_KEYSTORE);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("available", false);
            ret.put("hardwareBacked", false);
            ret.put("securityLevel", "software");
            ret.put("journalState", STATE_ACTIVE_V1);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void getKeySecurityInfo(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            recoverInterruptedMigration(keyStore);
            SecretKey secretKey = getOrCreateSecretKey();
            JSObject sec = inspectKeySecurity(secretKey);
            String activeAlias = getActiveKeyAlias(keyStore);
            String journalState = getJournalState(keyStore);
            ret.put("available", true);
            ret.put("hardwareBacked", Boolean.TRUE.equals(sec.getBool("hardwareBacked")));
            String secLevel = sec.getString("securityLevel");
            ret.put("securityLevel", secLevel != null ? secLevel : "software");
            ret.put("alias", activeAlias);
            ret.put("journalState", journalState);
            ret.put("provider", ANDROID_KEYSTORE);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("available", false);
            ret.put("hardwareBacked", false);
            ret.put("securityLevel", "software");
            ret.put("journalState", STATE_ACTIVE_V1);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    /**
     * Transactional zero-data-loss migration to StrongBox.
     * Progresses through persistent journal states:
     * MIGRATION_PREPARED -> V2_KEY_CREATED -> V2_DATA_VERIFIED.
     * Deletion of old key is deferred to commitKeyMigration.
     */
    @PluginMethod
    public synchronized void migrateKeyToStrongBox(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            ret.put("migrated", false);
            ret.put("reason", "StrongBox requires Android P (API 28) or higher");
            call.resolve(ret);
            return;
        }
        KeyStore keyStore = null;
        try {
            keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);

            // Run crash recovery first in case an earlier run left unfinished state
            recoverInterruptedMigration(keyStore);

            String state = getJournalState(keyStore);
            if (STATE_ACTIVE_V2.equals(state) || STATE_DELETE_OLD_KEYS.equals(state)) {
                if (keyStore.containsAlias(KEY_ALIAS_STRONGBOX_V2)) {
                    SecretKey currentKey = (SecretKey) keyStore.getKey(KEY_ALIAS_STRONGBOX_V2, null);
                    JSObject sec = inspectKeySecurity(currentKey);
                    String currentLevel = sec.getString("securityLevel");
                    if ("strongbox".equalsIgnoreCase(currentLevel)) {
                        ret.put("migrated", false);
                        ret.put("alreadyStrongBox", true);
                        ret.put("securityLevel", "strongbox");
                        ret.put("alias", KEY_ALIAS_STRONGBOX_V2);
                        ret.put("journalState", state);
                        call.resolve(ret);
                        return;
                    }
                }
            }

            // Step 1: Record MIGRATION_PREPARED in journal
            setJournalState(STATE_MIGRATION_PREPARED);

            String activeAlias = getActiveKeyAlias(keyStore);
            String ciphertextB64 = call.getString("ciphertext");
            String ivB64 = call.getString("iv");
            String aad = call.getString("aad");

            SecretKey newStrongBoxKey;

            if (ciphertextB64 != null && ivB64 != null) {
                // Decrypt existing ciphertext using old active key
                if (!keyStore.containsAlias(activeAlias)) {
                    throw new IllegalStateException("Active key not found for alias: " + activeAlias);
                }
                SecretKey oldKey = (SecretKey) keyStore.getKey(activeAlias, null);
                Cipher oldCipher = Cipher.getInstance(TRANSFORMATION);
                byte[] ivOld = Base64.decode(ivB64, Base64.NO_WRAP);
                byte[] ctOld = Base64.decode(ciphertextB64, Base64.NO_WRAP);
                GCMParameterSpec oldSpec = new GCMParameterSpec(GCM_TAG_LENGTH, ivOld);
                oldCipher.init(Cipher.DECRYPT_MODE, oldKey, oldSpec);
                if (aad != null && !aad.isEmpty()) {
                    oldCipher.updateAAD(aad.getBytes(StandardCharsets.UTF_8));
                }
                byte[] decryptedBytes = oldCipher.doFinal(ctOld);

                // Step 2: Generate new StrongBox-backed key without touching the old key
                newStrongBoxKey = generateSecretKey(KEY_ALIAS_STRONGBOX_V2, true);
                setJournalState(STATE_V2_KEY_CREATED);

                // Step 3: Re-encrypt with new StrongBox key
                Cipher newCipher = Cipher.getInstance(TRANSFORMATION);
                newCipher.init(Cipher.ENCRYPT_MODE, newStrongBoxKey);
                if (aad != null && !aad.isEmpty()) {
                    newCipher.updateAAD(aad.getBytes(StandardCharsets.UTF_8));
                }
                byte[] newIv = newCipher.getIV();
                byte[] newCiphertext = newCipher.doFinal(decryptedBytes);

                // Step 4: Verify roundtrip decryption with new StrongBox key
                Cipher testCipher = Cipher.getInstance(TRANSFORMATION);
                GCMParameterSpec newSpec = new GCMParameterSpec(GCM_TAG_LENGTH, newIv);
                testCipher.init(Cipher.DECRYPT_MODE, newStrongBoxKey, newSpec);
                if (aad != null && !aad.isEmpty()) {
                    testCipher.updateAAD(aad.getBytes(StandardCharsets.UTF_8));
                }
                byte[] roundtripBytes = testCipher.doFinal(newCiphertext);

                if (!Arrays.equals(decryptedBytes, roundtripBytes)) {
                    throw new IllegalStateException("StrongBox migration roundtrip verification failed");
                }

                // Step 5: Mark data verified in journal
                setJournalState(STATE_V2_DATA_VERIFIED);

                ret.put("newCiphertext", Base64.encodeToString(newCiphertext, Base64.NO_WRAP));
                ret.put("newIv", Base64.encodeToString(newIv, Base64.NO_WRAP));
                if (aad != null) {
                    ret.put("aad", aad);
                }
            } else {
                // No existing ciphertext to re-encrypt; generate and verify new StrongBox key
                newStrongBoxKey = generateSecretKey(KEY_ALIAS_STRONGBOX_V2, true);
                setJournalState(STATE_V2_KEY_CREATED);

                Cipher testEnc = Cipher.getInstance(TRANSFORMATION);
                testEnc.init(Cipher.ENCRYPT_MODE, newStrongBoxKey);
                byte[] tIv = testEnc.getIV();
                byte[] tCt = testEnc.doFinal("nexus_strongbox_probe".getBytes(StandardCharsets.UTF_8));
                Cipher testDec = Cipher.getInstance(TRANSFORMATION);
                testDec.init(Cipher.DECRYPT_MODE, newStrongBoxKey, new GCMParameterSpec(GCM_TAG_LENGTH, tIv));
                byte[] tDec = testDec.doFinal(tCt);
                if (!Arrays.equals("nexus_strongbox_probe".getBytes(StandardCharsets.UTF_8), tDec)) {
                    throw new IllegalStateException("StrongBox probe roundtrip test failed");
                }

                setJournalState(STATE_V2_DATA_VERIFIED);
            }

            JSObject newSec = inspectKeySecurity(newStrongBoxKey);
            ret.put("migrated", true);
            ret.put("securityLevel", newSec.getString("securityLevel"));
            ret.put("hardwareBacked", Boolean.TRUE.equals(newSec.getBool("hardwareBacked")));
            ret.put("alias", KEY_ALIAS_STRONGBOX_V2);
            ret.put("journalState", STATE_V2_DATA_VERIFIED);
            call.resolve(ret);
        } catch (Exception e) {
            // Rollback: delete uncommitted StrongBox key if created, leaving old key intact
            if (keyStore != null) {
                try {
                    if (keyStore.containsAlias(KEY_ALIAS_STRONGBOX_V2)) {
                        keyStore.deleteEntry(KEY_ALIAS_STRONGBOX_V2);
                    }
                } catch (Exception ignored) {}
            }
            setJournalState(STATE_ACTIVE_V1);
            ret.put("migrated", false);
            ret.put("journalState", STATE_ACTIVE_V1);
            ret.put("error", "StrongBox migration failed: " + e.getMessage());
            call.resolve(ret);
        }
    }

    /**
     * Commits the key migration by advancing journal to STORAGE_COMMITTED,
     * then ACTIVE_V2, and purging old keys.
     */
    @PluginMethod
    public synchronized void commitKeyMigration(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            String stage = call.getString("stage", call.getString("state", null));
            String currentState = getJournalState(keyStore);

            if (STATE_STORAGE_COMMITTED.equals(stage)
                    || (stage == null && STATE_V2_DATA_VERIFIED.equals(currentState))) {
                setJournalState(STATE_STORAGE_COMMITTED);
                ret.put("committed", true);
                ret.put("journalState", STATE_STORAGE_COMMITTED);
                ret.put("activeAlias", KEY_ALIAS_STRONGBOX_V2);
                call.resolve(ret);
                return;
            }

            setJournalState(STATE_STORAGE_COMMITTED);
            setJournalState(STATE_ACTIVE_V2);
            boolean deletedOld = false;
            if (keyStore.containsAlias(KEY_ALIAS_STRONGBOX_V2)) {
                if (keyStore.containsAlias(KEY_ALIAS_V1)) {
                    keyStore.deleteEntry(KEY_ALIAS_V1);
                    deletedOld = true;
                }
                if (keyStore.containsAlias(KEY_ALIAS_LEGACY)) {
                    keyStore.deleteEntry(KEY_ALIAS_LEGACY);
                    deletedOld = true;
                }
            }
            ret.put("committed", true);
            ret.put("deletedOldKeys", deletedOld);
            ret.put("activeAlias", KEY_ALIAS_STRONGBOX_V2);
            ret.put("journalState", STATE_ACTIVE_V2);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("committed", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    /**
     * Rolls back uncommitted StrongBox key migration if client storage fails.
     */
    @PluginMethod
    public synchronized void rollbackKeyMigration(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS_STRONGBOX_V2)) {
                keyStore.deleteEntry(KEY_ALIAS_STRONGBOX_V2);
            }
            setJournalState(STATE_ACTIVE_V1);
            String activeAlias = getActiveKeyAlias(keyStore);
            ret.put("rolledBack", true);
            ret.put("activeAlias", activeAlias);
            ret.put("journalState", STATE_ACTIVE_V1);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("rolledBack", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    /**
     * Queries current persistent migration journal state and authoritative alias.
     */
    @PluginMethod
    public synchronized void getMigrationJournalState(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            boolean recovered = recoverInterruptedMigration(keyStore);
            String state = getJournalState(keyStore);
            String activeAlias = getActiveKeyAlias(keyStore);
            ret.put("journalState", state);
            ret.put("activeAlias", activeAlias);
            ret.put("recovered", recovered);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("journalState", STATE_ACTIVE_V1);
            ret.put("activeAlias", KEY_ALIAS_V1);
            ret.put("recovered", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    /**
     * Explicit trigger for crash recovery of interrupted migration.
     */
    @PluginMethod
    public synchronized void recoverInterruptedMigration(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            String priorState = getJournalState(keyStore);
            boolean recovered = recoverInterruptedMigration(keyStore);
            String state = getJournalState(keyStore);
            String activeAlias = getActiveKeyAlias(keyStore);
            ret.put("recovered", recovered);
            ret.put("journalState", state);
            ret.put("activeAlias", activeAlias);
            if (recovered && (STATE_MIGRATION_PREPARED.equals(priorState)
                    || STATE_V2_KEY_CREATED.equals(priorState)
                    || STATE_V2_DATA_VERIFIED.equals(priorState))) {
                ret.put("deletedUncommittedV2", true);
            }
            if (recovered && STATE_STORAGE_COMMITTED.equals(priorState)) {
                ret.put("deletedOldKeys", true);
            }
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("recovered", false);
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
