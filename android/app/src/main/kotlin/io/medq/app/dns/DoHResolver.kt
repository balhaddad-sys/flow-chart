package io.medq.app.dns

import android.util.Log
import org.json.JSONObject
import java.net.InetAddress
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import javax.net.ssl.HttpsURLConnection

/**
 * Core DNS-over-HTTPS resolver with multiple server fallbacks.
 *
 * Tries Cloudflare (1.1.1.1), Google (8.8.8.8), and Cloudflare alternate (1.0.0.1)
 * in sequence. Connects directly by IP — no DNS needed to reach the resolvers.
 * Caches results for 30 minutes. Serves stale cache while re-resolving in background.
 */
object DoHResolver {
    private const val TAG = "DoHResolver"
    private const val CACHE_TTL_MS = 30 * 60 * 1000L  // 30 minutes
    private const val STALE_TTL_MS = 60 * 60 * 1000L  // serve stale up to 1 hour
    private const val TIMEOUT_MS = 3000                // 3s per server

    // DoH servers tried in order. Each entry: Pair(serverIP, hostHeader for TLS SNI)
    private val DOH_SERVERS = listOf(
        Pair("1.1.1.1",    "cloudflare-dns.com"),
        Pair("8.8.8.8",    "dns.google"),
        Pair("1.0.0.1",    "cloudflare-dns.com"),
        Pair("8.8.4.4",    "dns.google"),
    )

    private data class CacheEntry(
        val addresses: List<InetAddress>,
        val expiresAt: Long,
        val staleAt: Long
    )

    private val cache = ConcurrentHashMap<String, CacheEntry>()

    /**
     * Resolve a hostname via DNS-over-HTTPS.
     * Returns cached result (even stale) on DoH failure.
     * Falls back to system DNS only when cache is completely empty.
     */
    fun resolve(hostname: String): List<InetAddress> {
        val now = System.currentTimeMillis()
        val cached = cache[hostname]

        // Fresh cache hit — return immediately
        if (cached != null && now < cached.expiresAt) {
            Log.d(TAG, "Cache hit: $hostname -> ${cached.addresses.map { it.hostAddress }}")
            return cached.addresses
        }

        // Stale cache hit — serve old result but refresh in background
        if (cached != null && now < cached.staleAt) {
            Log.d(TAG, "Stale cache for $hostname — serving old result, refreshing in background")
            Thread { resolveAndCache(hostname) }.start()
            return cached.addresses
        }

        // No usable cache — resolve now (blocking)
        return resolveAndCache(hostname).ifEmpty {
            // Last resort: system DNS (ISP may block, but worth trying)
            systemResolve(hostname)
        }
    }

    private fun resolveAndCache(hostname: String): List<InetAddress> {
        return try {
            val addresses = mutableListOf<InetAddress>()

            // Query A records (IPv4) — try each DoH server until one works
            addresses.addAll(queryDoHWithFallback(hostname, "A"))

            // Query AAAA records (IPv6) — non-fatal
            try {
                addresses.addAll(queryDoHWithFallback(hostname, "AAAA"))
            } catch (e: Exception) {
                Log.d(TAG, "AAAA query failed for $hostname (non-fatal): ${e.message}")
            }

            if (addresses.isNotEmpty()) {
                val now = System.currentTimeMillis()
                cache[hostname] = CacheEntry(
                    addresses = addresses,
                    expiresAt = now + CACHE_TTL_MS,
                    staleAt = now + STALE_TTL_MS,
                )
                Log.i(TAG, "DoH resolved $hostname -> ${addresses.map { it.hostAddress }}")
            }

            addresses
        } catch (e: Exception) {
            Log.e(TAG, "All DoH servers failed for $hostname: ${e.message}")
            emptyList()
        }
    }

    /**
     * Try each DoH server in order, returning the first successful result.
     */
    private fun queryDoHWithFallback(hostname: String, type: String): List<InetAddress> {
        for ((serverIp, hostHeader) in DOH_SERVERS) {
            try {
                val result = queryDoHServer(serverIp, hostHeader, hostname, type)
                if (result.isNotEmpty()) return result
            } catch (e: Exception) {
                Log.w(TAG, "DoH $serverIp failed for $hostname ($type): ${e.message}")
            }
        }
        return emptyList()
    }

    /**
     * Query a single DoH server by IP. Uses Host header for correct TLS SNI.
     */
    private fun queryDoHServer(
        serverIp: String,
        hostHeader: String,
        hostname: String,
        type: String
    ): List<InetAddress> {
        val url = URL("https://$serverIp/dns-query?name=$hostname&type=$type")
        val conn = url.openConnection() as HttpsURLConnection

        return try {
            conn.requestMethod = "GET"
            conn.setRequestProperty("Accept", "application/dns-json")
            conn.setRequestProperty("Host", hostHeader)
            conn.connectTimeout = TIMEOUT_MS
            conn.readTimeout = TIMEOUT_MS

            if (conn.responseCode != 200) {
                throw RuntimeException("DoH HTTP ${conn.responseCode} from $serverIp")
            }

            val body = conn.inputStream.bufferedReader().readText()
            val json = JSONObject(body)
            val answers = json.optJSONArray("Answer") ?: return emptyList()

            val addresses = mutableListOf<InetAddress>()
            for (i in 0 until answers.length()) {
                val answer = answers.getJSONObject(i)
                val answerType = answer.getInt("type")
                if ((type == "A" && answerType == 1) || (type == "AAAA" && answerType == 28)) {
                    val data = answer.getString("data")
                    try {
                        addresses.add(InetAddress.getByName(data))
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to parse address: $data")
                    }
                }
            }
            addresses
        } finally {
            conn.disconnect()
        }
    }

    private fun systemResolve(hostname: String): List<InetAddress> {
        return try {
            InetAddress.getAllByName(hostname).toList()
        } catch (e: Exception) {
            Log.e(TAG, "System DNS also failed for $hostname: ${e.message}")
            emptyList()
        }
    }

    /**
     * Pre-resolve critical hostnames at app startup to warm the cache.
     */
    fun warmCache(hostnames: List<String>) {
        Thread {
            for (hostname in hostnames) {
                try {
                    resolve(hostname)
                } catch (e: Exception) {
                    Log.w(TAG, "Warm cache failed for $hostname: ${e.message}")
                }
            }
            Log.i(TAG, "Cache warmed for ${hostnames.size} hostnames")
        }.start()
    }
}
