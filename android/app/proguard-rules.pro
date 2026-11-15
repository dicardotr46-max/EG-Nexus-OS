# Proguard and R8 optimization rules for EG Nexus OS

# Keep all Capacitor core, bridge, and plugin classes
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    public <methods>;
}

# Keep EG Nexus custom native keystore plugin and application classes
-keep class com.eg.nexus.** { *; }
-keepclassmembers class com.eg.nexus.** {
    public *;
    protected *;
    private *;
}
-keep class com.eg.nexus.NexusKeystorePlugin { *; }
-keepclassmembers class com.eg.nexus.NexusKeystorePlugin {
    public <methods>;
}

# Keep Android KeyStore and cryptographic provider interfaces
-keep class android.security.keystore.** { *; }
-keep interface android.security.keystore.** { *; }
-keep class javax.crypto.** { *; }

# Keep Cordova plugins if used
-keep class org.apache.cordova.** { *; }

# Preserve annotations and attributes needed by reflection in plugins
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod
