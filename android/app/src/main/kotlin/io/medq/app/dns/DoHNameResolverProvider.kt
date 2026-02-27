package io.medq.app.dns

import android.util.Log
import io.grpc.Attributes
import io.grpc.EquivalentAddressGroup
import io.grpc.NameResolver
import io.grpc.NameResolverProvider
import java.net.InetSocketAddress
import java.net.URI

/**
 * Custom gRPC NameResolverProvider that uses DNS-over-HTTPS for blocked hostnames.
 *
 * Registered at priority 6 to override the default DnsNameResolverProvider (priority 5).
 * This intercepts ALL gRPC DNS lookups including Firebase Firestore.
 *
 * CRITICAL: Must handle ALL hostnames since it replaces the default resolver entirely.
 * Non-blocked hostnames fall through to system DNS via DoHResolver's fallback.
 */
class DoHNameResolverProvider : NameResolverProvider() {

    companion object {
        private const val TAG = "DoHNameResolverProvider"

        /**
         * Hostnames known to be blocked by Kuwait ISP DNS.
         * Add your Cloud Functions region hostname here too.
         */
        val BLOCKED_HOSTNAMES = setOf(
            "firestore.googleapis.com",
            "firebaseinstallations.googleapis.com",
            "firebaseremoteconfig.googleapis.com",
            "fcmregistrations.googleapis.com",
            "identitytoolkit.googleapis.com",
            "securetoken.googleapis.com",
            "firebasestorage.googleapis.com",
            "storage.googleapis.com",
            "oauth2.googleapis.com",
            "www.googleapis.com",
            "firebase.googleapis.com",
            "cloudfunctions.net",
            // Cloud Functions regional endpoints
            "us-central1-medq-production.cloudfunctions.net",
            "us-central1-medq-app.cloudfunctions.net",
        )

        fun isBlocked(hostname: String): Boolean {
            return BLOCKED_HOSTNAMES.any { blocked ->
                hostname == blocked || hostname.endsWith(".$blocked")
            }
        }
    }

    override fun getDefaultScheme(): String = "dns"

    override fun isAvailable(): Boolean = true

    // Priority 6 overrides default DnsNameResolverProvider at priority 5
    override fun priority(): Int = 6

    override fun newNameResolver(targetUri: URI, args: NameResolver.Args): NameResolver? {
        if (targetUri.scheme != "dns") return null

        // gRPC may pass:
        //   dns:firestore.googleapis.com:443       (opaque — path/host both null)
        //   dns:///firestore.googleapis.com:443    (hierarchical — host is in path)
        // Parse whichever is non-empty.
        val rawTarget = when {
            !targetUri.path.isNullOrBlank() -> targetUri.path.trimStart('/')
            !targetUri.schemeSpecificPart.isNullOrBlank() ->
                targetUri.schemeSpecificPart.trimStart('/')
            else -> return null
        }
        if (rawTarget.isBlank()) return null

        val host = rawTarget.substringBeforeLast(":")
        val portStr = if (rawTarget.contains(":")) rawTarget.substringAfterLast(":") else null
        val port = portStr?.toIntOrNull() ?: args.defaultPort

        if (host.isBlank()) return null
        return DoHNameResolver(host, port)
    }

    /**
     * NameResolver that resolves via DoH for blocked hosts, system DNS for others.
     */
    private class DoHNameResolver(
        private val host: String,
        private val port: Int
    ) : NameResolver() {

        private var listener: Listener2? = null
        private var shutdown = false

        override fun getServiceAuthority(): String = host

        override fun start(listener: Listener2) {
            this.listener = listener
            resolve()
        }

        override fun refresh() {
            resolve()
        }

        override fun shutdown() {
            shutdown = true
        }

        private fun resolve() {
            if (shutdown) return

            Thread {
                try {
                    val addresses = DoHResolver.resolve(host)

                    if (addresses.isEmpty()) {
                        listener?.onError(
                            io.grpc.Status.UNAVAILABLE.withDescription(
                                "No addresses resolved for $host"
                            )
                        )
                        return@Thread
                    }

                    val eags = addresses.map { addr ->
                        EquivalentAddressGroup(InetSocketAddress(addr, port))
                    }

                    val result = ResolutionResult.newBuilder()
                        .setAddresses(eags)
                        .setAttributes(Attributes.EMPTY)
                        .build()

                    listener?.onResult(result)

                    if (isBlocked(host)) {
                        Log.d(TAG, "Resolved blocked host $host via DoH -> ${addresses.map { it.hostAddress }}")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to resolve $host: ${e.message}")
                    listener?.onError(
                        io.grpc.Status.UNAVAILABLE.withDescription(
                            "DNS resolution failed for $host: ${e.message}"
                        ).withCause(e)
                    )
                }
            }.start()
        }
    }
}
