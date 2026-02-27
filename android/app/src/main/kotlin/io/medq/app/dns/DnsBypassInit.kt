package io.medq.app.dns

import android.content.Context
import android.util.Log
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodChannel
import io.grpc.NameResolverRegistry
import okhttp3.OkHttpClient

/**
 * One-time initialization that:
 *  1. Seeds the Firebase App Check debug token (prevents 403 after reinstall).
 *  2. Registers the DoH-based gRPC NameResolver (fixes Firestore DNS).
 *  3. Pre-warms the DNS cache for critical Firebase hostnames.
 *  4. Registers a Flutter MethodChannel so Dart can also call DoH.
 *  5. Patches Firebase Functions OkHttpClient to use DoH (fixes Cloud Functions).
 *
 * Call [initialize] BEFORE super.onCreate() in MainActivity.
 * Call [patchFunctionsDns] AFTER super.onCreate() in MainActivity.
 * Call [registerMethodChannel] inside configureFlutterEngine.
 */
object DnsBypassInit {

    private const val TAG = "DnsBypassInit"
    private const val CHANNEL_NAME = "io.medq.app/dns"
    private var initialized = false

    // ── App Check ──────────────────────────────────────────────────────────────
    /**
     * Debug token registered in Firebase Console.
     * Update if you ever rotate the token in the Console.
     */
    private const val APP_CHECK_DEBUG_TOKEN = "6be8b27f-2d4e-4786-90a9-58be222a1178"
    private const val APP_CHECK_PREFS = "com.google.firebase.appcheck.debug.store.[DEFAULT]"
    private const val APP_CHECK_KEY   = "firebase_app_check_debug_secret"

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Register the DoH NameResolverProvider with gRPC and seed App Check token.
     * Call BEFORE super.onCreate() in MainActivity.
     */
    fun initialize(context: Context) {
        if (initialized) {
            Log.d(TAG, "Already initialized, skipping")
            return
        }

        try {
            seedAppCheckDebugToken(context)

            // Register custom resolver with gRPC at priority 6 (overrides default at 5)
            NameResolverRegistry.getDefaultRegistry()
                .register(DoHNameResolverProvider())

            initialized = true
            Log.i(TAG, "✅ DoH NameResolverProvider registered with gRPC (priority 6)")

            // Pre-warm DNS cache for critical Firebase hostnames
            DoHResolver.warmCache(
                listOf(
                    "firestore.googleapis.com",
                    "identitytoolkit.googleapis.com",
                    "securetoken.googleapis.com",
                    "firebasestorage.googleapis.com",
                    "storage.googleapis.com",
                    "oauth2.googleapis.com",
                    "firebase.googleapis.com",
                    "us-central1-medq-a6cc6.cloudfunctions.net",
                    "us-central1-medq-production.cloudfunctions.net",
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to register DoH bypass: ${e.message}", e)
        }
    }

    /**
     * Register Flutter method channel so Dart code can also resolve via DoH.
     * Call inside configureFlutterEngine in MainActivity.
     */
    fun registerMethodChannel(messenger: BinaryMessenger) {
        val channel = MethodChannel(messenger, CHANNEL_NAME)
        channel.setMethodCallHandler { call, result ->
            when (call.method) {
                "resolve" -> {
                    val hostname = call.argument<String>("hostname")
                    if (hostname == null) {
                        result.error("INVALID_ARG", "hostname is required", null)
                        return@setMethodCallHandler
                    }
                    Thread {
                        try {
                            val addresses = DoHResolver.resolve(hostname)
                            val ips = addresses.map { it.hostAddress }
                            android.os.Handler(android.os.Looper.getMainLooper()).post {
                                result.success(ips)
                            }
                        } catch (e: Exception) {
                            android.os.Handler(android.os.Looper.getMainLooper()).post {
                                result.error("DNS_ERROR", e.message, null)
                            }
                        }
                    }.start()
                }
                "needsDoH" -> {
                    val hostname = call.argument<String>("hostname")
                    result.success(hostname != null && DoHNameResolverProvider.isBlocked(hostname))
                }
                "isInitialized" -> {
                    result.success(initialized)
                }
                // Called from Dart after Firebase.initializeApp() to patch Functions OkHttp.
                "patchFunctions" -> {
                    patchFunctionsDns()
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }

    /**
     * Patches the OkHttpClient inside [com.google.firebase.functions.FirebaseFunctions]
     * to use [DoHOkHttpDns], routing blocked domains through DNS-over-HTTPS.
     *
     * Call AFTER super.onCreate() in MainActivity (Firebase App is ready by then).
     */
    fun patchFunctionsDns() {
        try {
            val functionsClass = Class.forName("com.google.firebase.functions.FirebaseFunctions")
            val instance = functionsClass.getMethod("getInstance").invoke(null)

            var clazz: Class<*>? = functionsClass
            var patched = false

            while (clazz != null && !patched) {
                for (field in clazz.declaredFields) {
                    if (field.type.name == "okhttp3.OkHttpClient") {
                        field.isAccessible = true
                        val existing = field.get(instance) as? OkHttpClient ?: continue
                        val patchedClient = existing.newBuilder()
                            .dns(DoHOkHttpDns())
                            .build()
                        writeField(instance, field, patchedClient)
                        Log.i(TAG, "✅ Firebase Functions OkHttp DNS patched (field: ${field.name})")
                        patched = true
                        break
                    }
                }
                clazz = clazz.superclass
            }

            if (!patched) Log.w(TAG, "OkHttpClient field not found in FirebaseFunctions — patch skipped")
        } catch (ite: java.lang.reflect.InvocationTargetException) {
            val cause = ite.cause
            Log.e(TAG, "patchFunctionsDns ITE → ${cause?.javaClass?.simpleName}: ${cause?.message}", cause)
        } catch (e: Exception) {
            Log.e(TAG, "patchFunctionsDns failed: ${e.javaClass.simpleName}: ${e.message}", e)
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    /** Pre-populate SharedPreferences with a stable debug token before Firebase reads it. */
    private fun seedAppCheckDebugToken(context: Context) {
        try {
            val prefs = context.getSharedPreferences(APP_CHECK_PREFS, Context.MODE_PRIVATE)
            val stored = prefs.getString(APP_CHECK_KEY, null)
            if (stored != APP_CHECK_DEBUG_TOKEN) {
                prefs.edit().putString(APP_CHECK_KEY, APP_CHECK_DEBUG_TOKEN).apply()
                Log.i(TAG, "App Check debug token seeded: $APP_CHECK_DEBUG_TOKEN")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to seed App Check token: ${e.message}")
        }
    }

    /**
     * Writes [value] into [field] on [obj], bypassing the final modifier via
     * sun.misc.Unsafe if a direct field.set() fails.
     */
    @Suppress("DiscouragedPrivateApi")
    private fun writeField(obj: Any, field: java.lang.reflect.Field, value: Any) {
        try {
            field.set(obj, value)
        } catch (_: Exception) {
            val unsafeClass = Class.forName("sun.misc.Unsafe")
            val theUnsafeField = unsafeClass.getDeclaredField("theUnsafe")
            theUnsafeField.isAccessible = true
            val unsafe = theUnsafeField.get(null)

            val offsetMethod = unsafeClass.getMethod(
                "objectFieldOffset", java.lang.reflect.Field::class.java
            )
            val offset = offsetMethod.invoke(unsafe, field) as Long

            val putMethod = unsafeClass.getMethod(
                "putObject", Any::class.java, Long::class.javaPrimitiveType, Any::class.java
            )
            putMethod.invoke(unsafe, obj, offset, value)
        }
    }
}
