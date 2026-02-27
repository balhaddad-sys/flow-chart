# Flutter default rules
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**

# Firebase
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# gRPC (used by Firestore)
-keep class io.grpc.** { *; }
-dontwarn io.grpc.**

# OkHttp (used by Cloud Functions & DoH DNS helper)
-keep class okhttp3.** { *; }
-dontwarn okhttp3.**
-keep class okio.** { *; }
-dontwarn okio.**

# Google Sign-In
-keep class com.google.android.gms.auth.** { *; }

# Crashlytics — preserve line numbers for stack traces
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception

# Keep app's native DNS helper
-keep class io.medq.app.** { *; }

# Kotlin serialization / metadata
-keepattributes *Annotation*
-dontwarn kotlin.**
-keep class kotlin.** { *; }
