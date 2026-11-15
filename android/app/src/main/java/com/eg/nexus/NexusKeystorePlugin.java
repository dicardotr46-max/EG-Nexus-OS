package com.eg.nexus;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.JSObject;

import android.accounts.AccountManager;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.activity.result.ActivityResult;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.SecureRandom;
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
    public static final String KEY_ALIAS_MASTER_V1 = KEY_ALIAS_V1;
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

    // One-Time Native Capability Bridge & Transaction Tokens
    private String mActiveSessionBridgeToken = null;
    private String mPendingMigrationTxToken = null;
    private String mExpectedV2CiphertextHash = null;
    private String mExpectedV2CiphertextHashAlt = null;
    private String mPendingV2Ciphertext = null;
    private String mPendingV2Iv = null;
    private String mPendingV2Aad = null;

    /**
     * Initializes one-time native vault session bridge token.
     * Can only be initialized once during application lifecycle (or resets if explicitly cleared).
     */
    @PluginMethod
    public synchronized void initNativeVaultSession(PluginCall call) {
        if (mActiveSessionBridgeToken == null || Boolean.TRUE.equals(call.getBoolean("forceReset", false))) {
            byte[] tokenBytes = new byte[32];
            new SecureRandom().nextBytes(tokenBytes);
            StringBuilder sb = new StringBuilder();
            for (byte b : tokenBytes) {
                sb.append(String.format("%02x", b));
            }
            mActiveSessionBridgeToken = sb.toString();
        }
        JSObject ret = new JSObject();
        ret.put("sessionBridgeToken", mActiveSessionBridgeToken);
        call.resolve(ret);
    }

    /**
     * Resets or clears the active native vault session bridge token.
     */
    @PluginMethod
    public synchronized void clearNativeVaultSession(PluginCall call) {
        mActiveSessionBridgeToken = null;
        mPendingMigrationTxToken = null;
        mExpectedV2CiphertextHash = null;
        mExpectedV2CiphertextHashAlt = null;
        mPendingV2Ciphertext = null;
        mPendingV2Iv = null;
        mPendingV2Aad = null;
        JSObject ret = new JSObject();
        ret.put("cleared", true);
        call.resolve(ret);
    }

    /**
     * Validates incoming call against the active session capability bridge token.
     */
    private synchronized boolean validateSessionBridgeToken(PluginCall call) {
        if (mActiveSessionBridgeToken == null || mActiveSessionBridgeToken.isEmpty()) {
            return false;
        }
        String token = call.getString("sessionBridgeToken");
        return token != null && mActiveSessionBridgeToken.equals(token);
    }

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
     * Asserts that transitioning from currentState to nextState follows the
     * strict sequential finite-state machine (FSM):
     * ACTIVE_V1 -> MIGRATION_PREPARED -> V2_KEY_CREATED -> V2_DATA_VERIFIED -> STORAGE_COMMITTED -> ACTIVE_V2
     */
    public void assertValidTransition(String currentState, String nextState) {
        boolean valid = false;
        if (STATE_ACTIVE_V1.equals(currentState) && STATE_MIGRATION_PREPARED.equals(nextState)) {
            valid = true;
        } else if (STATE_MIGRATION_PREPARED.equals(currentState) && STATE_V2_KEY_CREATED.equals(nextState)) {
            valid = true;
        } else if (STATE_V2_KEY_CREATED.equals(currentState) && STATE_V2_DATA_VERIFIED.equals(nextState)) {
            valid = true;
        } else if (STATE_V2_DATA_VERIFIED.equals(currentState) && STATE_STORAGE_COMMITTED.equals(nextState)) {
            valid = true;
        } else if (STATE_STORAGE_COMMITTED.equals(currentState) && STATE_ACTIVE_V2.equals(nextState)) {
            valid = true;
        }
        if (!valid) {
            throw new IllegalStateException("Invalid migration transition from " + currentState + " to " + nextState);
        }
    }

    /**
     * Critical crash recovery routine.
     * Evaluates journal state on boot / method execution:
     * - Intermediate states ("MIGRATION_PREPARED", "V2_KEY_CREATED", "V2_DATA_VERIFIED"):
     *   The app crashed before client storage persisted new ciphertext!
     *   Deletes KEY_ALIAS_STRONGBOX_V2 and resets to ACTIVE_V1. Old data remains 100% decryptable with V1 key.
     * - "STORAGE_COMMITTED":
     *   Point of no return has been passed. Preserves STORAGE_COMMITTED and NEVER auto-advances
     *   to ACTIVE_V2 or auto-deletes KEY_ALIAS_V1 on read. KEY_ALIAS_V1 is only deleted
     *   when JavaScript explicitly commits with { stage: 'ACTIVE_V2', mainStorageVerified: true }.
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
            }
            // CRITICAL: NEVER auto-advance STORAGE_COMMITTED to ACTIVE_V2,
            // and NEVER auto-delete KEY_ALIAS_V1 on reading STORAGE_COMMITTED!
            // If journal state is STORAGE_COMMITTED, Java must report status "STORAGE_COMMITTED" to JavaScript.
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
        if (!validateSessionBridgeToken(call)) {
            call.reject("NATIVE_AUTH_REQUIRED: Missing or invalid native bridge capability token");
            return;
        }
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
            assertValidTransition(state, STATE_MIGRATION_PREPARED);
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
                assertValidTransition(getJournalState(keyStore), STATE_V2_KEY_CREATED);
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
                assertValidTransition(getJournalState(keyStore), STATE_V2_DATA_VERIFIED);
                setJournalState(STATE_V2_DATA_VERIFIED);

                // Generate one-time migration transaction token tied to SHA-256 of V2 ciphertext
                byte[] txBytes = new byte[32];
                new SecureRandom().nextBytes(txBytes);
                StringBuilder sbTx = new StringBuilder();
                for (byte b : txBytes) {
                    sbTx.append(String.format("%02x", b));
                }
                mPendingMigrationTxToken = sbTx.toString();

                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] hashBytes = md.digest(newCiphertext);
                StringBuilder sbHash = new StringBuilder();
                for (byte b : hashBytes) {
                    sbHash.append(String.format("%02x", b));
                }
                mExpectedV2CiphertextHash = sbHash.toString();

                String newCiphertextB64 = Base64.encodeToString(newCiphertext, Base64.NO_WRAP);
                String newIvB64 = Base64.encodeToString(newIv, Base64.NO_WRAP);
                byte[] b64HashBytes = md.digest(newCiphertextB64.getBytes(StandardCharsets.UTF_8));
                StringBuilder sbB64 = new StringBuilder();
                for (byte b : b64HashBytes) {
                    sbB64.append(String.format("%02x", b));
                }
                mExpectedV2CiphertextHashAlt = sbB64.toString();

                mPendingV2Ciphertext = newCiphertextB64;
                mPendingV2Iv = newIvB64;
                mPendingV2Aad = aad;

                ret.put("newCiphertext", newCiphertextB64);
                ret.put("newIv", newIvB64);
                ret.put("migrationTxToken", mPendingMigrationTxToken);
                ret.put("v2CiphertextHash", mExpectedV2CiphertextHash);
                if (aad != null) {
                    ret.put("aad", aad);
                }
            } else {
                // No existing ciphertext to re-encrypt; generate and verify new StrongBox key
                newStrongBoxKey = generateSecretKey(KEY_ALIAS_STRONGBOX_V2, true);
                assertValidTransition(getJournalState(keyStore), STATE_V2_KEY_CREATED);
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

                assertValidTransition(getJournalState(keyStore), STATE_V2_DATA_VERIFIED);
                setJournalState(STATE_V2_DATA_VERIFIED);

                byte[] txBytes = new byte[32];
                new SecureRandom().nextBytes(txBytes);
                StringBuilder sbTx = new StringBuilder();
                for (byte b : txBytes) {
                    sbTx.append(String.format("%02x", b));
                }
                mPendingMigrationTxToken = sbTx.toString();

                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] hashBytes = md.digest(tCt);
                StringBuilder sbHash = new StringBuilder();
                for (byte b : hashBytes) {
                    sbHash.append(String.format("%02x", b));
                }
                mExpectedV2CiphertextHash = sbHash.toString();

                String tCtB64 = Base64.encodeToString(tCt, Base64.NO_WRAP);
                String tIvB64 = Base64.encodeToString(tIv, Base64.NO_WRAP);
                byte[] b64HashBytes = md.digest(tCtB64.getBytes(StandardCharsets.UTF_8));
                StringBuilder sbB64 = new StringBuilder();
                for (byte b : b64HashBytes) {
                    sbB64.append(String.format("%02x", b));
                }
                mExpectedV2CiphertextHashAlt = sbB64.toString();

                mPendingV2Ciphertext = tCtB64;
                mPendingV2Iv = tIvB64;
                mPendingV2Aad = null;

                ret.put("migrationTxToken", mPendingMigrationTxToken);
                ret.put("v2CiphertextHash", mExpectedV2CiphertextHash);
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
            mPendingMigrationTxToken = null;
            mExpectedV2CiphertextHash = null;
            mExpectedV2CiphertextHashAlt = null;
            mPendingV2Ciphertext = null;
            mPendingV2Iv = null;
            mPendingV2Aad = null;
            ret.put("migrated", false);
            ret.put("journalState", STATE_ACTIVE_V1);
            ret.put("error", "StrongBox migration failed: " + e.getMessage());
            call.resolve(ret);
        }
    }

    /**
     * Commits the key migration by advancing journal to STORAGE_COMMITTED,
     * then ACTIVE_V2, and purging old keys.
     * KEY_ALIAS_V1 is ONLY deleted when explicitly requested with stage 'ACTIVE_V2',
     * mainStorageVerified is true, valid migrationTxToken & v2CiphertextHash are provided,
     * and Java can successfully decrypt the V2 ciphertext before deleting V1!
     */
    @PluginMethod
    public synchronized void commitKeyMigration(PluginCall call) {
        if (!validateSessionBridgeToken(call)) {
            call.reject("NATIVE_AUTH_REQUIRED: Missing or invalid native bridge capability token");
            return;
        }
        JSObject ret = new JSObject();
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            String stage = call.getString("stage", call.getString("state", null));
            String currentState = getJournalState(keyStore);

            if (STATE_STORAGE_COMMITTED.equals(stage)) {
                if (!STATE_V2_DATA_VERIFIED.equals(currentState)) {
                    call.reject("Invalid migration transition to STORAGE_COMMITTED from " + currentState);
                    return;
                }
                assertValidTransition(currentState, STATE_STORAGE_COMMITTED);
                setJournalState(STATE_STORAGE_COMMITTED);
                ret.put("committed", true);
                ret.put("journalState", STATE_STORAGE_COMMITTED);
                ret.put("activeAlias", KEY_ALIAS_STRONGBOX_V2);
                call.resolve(ret);
                return;
            }

            if (STATE_ACTIVE_V2.equals(stage)) {
                // Verify migrationTxToken and v2CiphertextHash capability tokens
                String migrationTxToken = call.getString("migrationTxToken");
                String v2CiphertextHash = call.getString("v2CiphertextHash");

                if (migrationTxToken == null || mPendingMigrationTxToken == null || !mPendingMigrationTxToken.equals(migrationTxToken)) {
                    call.reject("MIGRATION_COMMIT_FAILED: Missing or invalid migration transaction capability token");
                    return;
                }

                if (v2CiphertextHash == null || mExpectedV2CiphertextHash == null
                        || (!mExpectedV2CiphertextHash.equalsIgnoreCase(v2CiphertextHash)
                            && (mExpectedV2CiphertextHashAlt == null || !mExpectedV2CiphertextHashAlt.equalsIgnoreCase(v2CiphertextHash)))) {
                    call.reject("MIGRATION_COMMIT_FAILED: Missing or mismatched V2 ciphertext integrity hash");
                    return;
                }

                Boolean mainStorageVerified = call.getBoolean("mainStorageVerified");
                if (mainStorageVerified == null || !mainStorageVerified) {
                    call.reject("MIGRATION_COMMIT_FAILED: mainStorageVerified must be true and current state must be STORAGE_COMMITTED to reach ACTIVE_V2 and delete KEY_ALIAS_V1");
                    return;
                }
                if (!STATE_STORAGE_COMMITTED.equals(currentState)) {
                    call.reject("MIGRATION_COMMIT_FAILED: mainStorageVerified must be true and current state must be STORAGE_COMMITTED to reach ACTIVE_V2 (was: " + currentState + ")");
                    return;
                }

                // Verify that Java can successfully decrypt the V2 ciphertext before deleting V1!
                String ctToVerify = call.getString("v2Ciphertext", call.getString("ciphertext", mPendingV2Ciphertext));
                String ivToVerify = call.getString("v2Iv", call.getString("iv", mPendingV2Iv));
                String aadToVerify = call.getString("aad", mPendingV2Aad);

                if (ctToVerify == null || ivToVerify == null) {
                    call.reject("MIGRATION_COMMIT_FAILED: Missing V2 ciphertext or IV for decryption verification");
                    return;
                }

                if (!keyStore.containsAlias(KEY_ALIAS_STRONGBOX_V2)) {
                    call.reject("MIGRATION_COMMIT_FAILED: StrongBox V2 key not found in keystore");
                    return;
                }

                SecretKey sbKey = (SecretKey) keyStore.getKey(KEY_ALIAS_STRONGBOX_V2, null);
                Cipher verifyCipher = Cipher.getInstance(TRANSFORMATION);
                byte[] ivBytes = Base64.decode(ivToVerify, Base64.NO_WRAP);
                byte[] ctBytes = Base64.decode(ctToVerify, Base64.NO_WRAP);
                GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_LENGTH, ivBytes);
                verifyCipher.init(Cipher.DECRYPT_MODE, sbKey, spec);
                if (aadToVerify != null && !aadToVerify.isEmpty()) {
                    verifyCipher.updateAAD(aadToVerify.getBytes(StandardCharsets.UTF_8));
                }
                byte[] decrypted = verifyCipher.doFinal(ctBytes);
                if (decrypted == null || decrypted.length == 0) {
                    call.reject("MIGRATION_COMMIT_FAILED: StrongBox V2 test decryption failed or produced empty plaintext");
                    return;
                }

                // All validations passed! Advance to ACTIVE_V2 and delete old keys
                assertValidTransition(currentState, STATE_ACTIVE_V2);
                setJournalState(STATE_ACTIVE_V2);
                boolean deletedOld = false;
                if (keyStore.containsAlias(KEY_ALIAS_STRONGBOX_V2)) {
                    if (keyStore.containsAlias(KEY_ALIAS_MASTER_V1)) {
                        keyStore.deleteEntry(KEY_ALIAS_MASTER_V1);
                        deletedOld = true;
                    }
                    if (keyStore.containsAlias(KEY_ALIAS_LEGACY)) {
                        keyStore.deleteEntry(KEY_ALIAS_LEGACY);
                        deletedOld = true;
                    }
                }

                // Invalidate single-use transaction token and pending migration buffers
                mPendingMigrationTxToken = null;
                mExpectedV2CiphertextHash = null;
                mExpectedV2CiphertextHashAlt = null;
                mPendingV2Ciphertext = null;
                mPendingV2Iv = null;
                mPendingV2Aad = null;

                ret.put("committed", true);
                ret.put("deletedOldKeys", deletedOld);
                ret.put("activeAlias", KEY_ALIAS_STRONGBOX_V2);
                ret.put("journalState", STATE_ACTIVE_V2);
                call.resolve(ret);
                return;
            }

            if (stage == null) {
                if (STATE_V2_DATA_VERIFIED.equals(currentState)) {
                    assertValidTransition(currentState, STATE_STORAGE_COMMITTED);
                    setJournalState(STATE_STORAGE_COMMITTED);
                    ret.put("committed", true);
                    ret.put("journalState", STATE_STORAGE_COMMITTED);
                    ret.put("activeAlias", KEY_ALIAS_STRONGBOX_V2);
                    call.resolve(ret);
                    return;
                } else if (STATE_STORAGE_COMMITTED.equals(currentState)) {
                    Boolean mainStorageVerified = call.getBoolean("mainStorageVerified");
                    if (mainStorageVerified == null || !mainStorageVerified) {
                        call.reject("MIGRATION_COMMIT_FAILED: mainStorageVerified must be true to reach ACTIVE_V2 and delete KEY_ALIAS_V1");
                        return;
                    }
                    call.reject("MIGRATION_COMMIT_FAILED: stage must be explicitly 'ACTIVE_V2' and include valid migrationTxToken & v2CiphertextHash to delete KEY_ALIAS_V1");
                    return;
                }
            }

            call.reject("MIGRATION_COMMIT_FAILED: invalid migration commit request for stage " + stage + " at current state " + currentState);
        } catch (IllegalStateException e) {
            call.reject(e.getMessage(), e);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    /**
     * Rolls back uncommitted StrongBox key migration if client storage fails.
     */
    @PluginMethod
    public synchronized void rollbackKeyMigration(PluginCall call) {
        if (!validateSessionBridgeToken(call)) {
            call.reject("NATIVE_AUTH_REQUIRED: Missing or invalid native bridge capability token");
            return;
        }
        JSObject ret = new JSObject();
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            String currentState = getJournalState(keyStore);
            if (STATE_STORAGE_COMMITTED.equals(currentState) || STATE_ACTIVE_V2.equals(currentState)) {
                call.reject("COMMIT_POINT_PASSED: Cannot rollback after STORAGE_COMMITTED");
                return;
            }
            if (keyStore.containsAlias(KEY_ALIAS_STRONGBOX_V2)) {
                keyStore.deleteEntry(KEY_ALIAS_STRONGBOX_V2);
            }
            setJournalState(STATE_ACTIVE_V1);
            mPendingMigrationTxToken = null;
            mExpectedV2CiphertextHash = null;
            mExpectedV2CiphertextHashAlt = null;
            mPendingV2Ciphertext = null;
            mPendingV2Iv = null;
            mPendingV2Aad = null;
            String activeAlias = getActiveKeyAlias(keyStore);
            ret.put("rolledBack", true);
            ret.put("activeAlias", activeAlias);
            ret.put("journalState", STATE_ACTIVE_V1);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Rollback failed: " + e.getMessage(), e);
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
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("recovered", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void encrypt(PluginCall call) {
        if (!validateSessionBridgeToken(call)) {
            call.reject("NATIVE_AUTH_REQUIRED: Missing or invalid native bridge capability token");
            return;
        }
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
        if (!validateSessionBridgeToken(call)) {
            call.reject("NATIVE_AUTH_REQUIRED: Missing or invalid native bridge capability token");
            return;
        }
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

    /**
     * Native Android Google Account Picker.
     * Launches the native system AccountPicker dialog directly without opening external browser tabs,
     * completely eliminating white screen deadlocks on mobile devices.
     */
    @PluginMethod
    public void pickGoogleAccount(PluginCall call) {
        try {
            Intent intent = AccountManager.newChooseAccountIntent(
                null,
                null,
                new String[]{"com.google"},
                false,
                null,
                null,
                null,
                null
            );
            startActivityForResult(call, intent, "accountPickerResult");
        } catch (Exception e) {
            call.reject("Failed to launch native account picker: " + e.getMessage(), e);
        }
    }

    @ActivityCallback
    public void accountPickerResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        try {
            if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                String email = result.getData().getStringExtra(AccountManager.KEY_ACCOUNT_NAME);
                if (email != null && !email.trim().isEmpty()) {
                    JSObject ret = new JSObject();
                    ret.put("email", email.trim());
                    String name = email.split("@")[0];
                    ret.put("name", name);
                    call.resolve(ret);
                    return;
                }
            }
            call.reject("User cancelled account picker");
        } catch (Exception e) {
            call.reject("Error in account picker result: " + e.getMessage(), e);
        }
    }
}
