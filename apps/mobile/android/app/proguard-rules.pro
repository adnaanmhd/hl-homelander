# Add project specific ProGuard rules here.
# For React Native applications, we need to ensure that native methods and JS-bridged
# components are not obfuscated or stripped out by R8/ProGuard.

-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Keep React Native specific classes
-keep class com.facebook.react.bridge.Systrace { *; }
-keep class com.facebook.react.devsupport.JSCHeapCapture { *; }

# Keep OkHttp & Okio classes (used by React Native networking)
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.Nullable
-dontwarn javax.annotation.ParametersAreNonnullByDefault

# Ignore missing compile-time annotation processor / code generator dependencies
-dontwarn javax.lang.model.**

# Ignore warnings to prevent other harmless missing-class references from breaking the build
-ignorewarnings

# Keep react-native-config and the main app's BuildConfig class from being obfuscated/stripped by R8
-keep class com.lugg.RNCConfig.BuildConfig { *; }
-keep class ai.humynlabs.capture.BuildConfig { *; }
-keep class ai.humynlabs.capture.apk.BuildConfig { *; }

# MediaPipe specific rules
-keep class com.google.mediapipe.proto.** { *; }
-keep class com.google.mediapipe.** { *; }
-keep class com.google.mediapipe.framework.Graph { *; }

# Protobuf rules
-keepclassmembers class * extends com.google.protobuf.GeneratedMessageLite { *; }

# Guava/Flogger rules (often required to prevent crashes in logging/framework)
-keep class com.google.common.flogger.** { *; }
-keep public class com.google.common.** { *; }
-keep public interface com.google.common.** { *; }

