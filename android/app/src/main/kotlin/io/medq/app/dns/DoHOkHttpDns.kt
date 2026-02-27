package io.medq.app.dns

import android.util.Log
import okhttp3.Dns
import java.net.InetAddress

/**
 * OkHttp [Dns] implementation that routes blocked domains through
 * DNS-over-HTTPS (Cloudflare 1.1.1.1 / Google 8.8.8.8) so that
 * Firebase Cloud Functions HTTP calls work despite ISP DNS blocking.
 *
 * Used by [DnsBypassInit.patchFunctionsDns] to inject into the
 * OkHttpClient inside Firebase Functions.
 */
class DoHOkHttpDns : Dns {

    companion object {
        private const val TAG = "DoHOkHttpDns"
        private val BLOCKED_SUFFIXES = listOf(
            ".googleapis.com",
            ".cloudfunctions.net",
            ".firebase.com",
            ".firebaseio.com",
        )
    }

    override fun lookup(hostname: String): List<InetAddress> {
        val needsDoH = BLOCKED_SUFFIXES.any { hostname.endsWith(it) }
        if (!needsDoH) return Dns.SYSTEM.lookup(hostname)

        // DoHResolver.resolve() returns List<InetAddress> directly
        val addresses = DoHResolver.resolve(hostname)
        return if (addresses.isEmpty()) {
            Log.w(TAG, "DoH returned no IPs for $hostname — falling back to system DNS")
            Dns.SYSTEM.lookup(hostname)
        } else {
            Log.d(TAG, "DoH resolved $hostname → ${addresses.map { it.hostAddress }}")
            addresses
        }
    }
}
