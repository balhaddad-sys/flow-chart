import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// DNS-over-HTTPS helper for resolving blocked hostnames on Android.
///
/// Uses the native DoH resolver via method channel. Falls back to direct
/// connection on non-Android platforms or when DoH is unavailable.
class DnsHelper {
  static const _channel = MethodChannel('io.medq.app/dns');

  static final Map<String, _CacheEntry> _cache = {};
  static const _cacheTtl = Duration(minutes: 5);

  /// Resolve a hostname via DoH (Android only).
  /// Returns list of IP addresses as strings.
  static Future<List<String>> resolve(String hostname) async {
    if (!Platform.isAndroid) return [hostname];

    // Check local cache
    final cached = _cache[hostname];
    if (cached != null && DateTime.now().isBefore(cached.expiresAt)) {
      return cached.ips;
    }

    try {
      final result = await _channel.invokeMethod('resolve', {'hostname': hostname});
      final ips = List<String>.from(result as List);
      if (ips.isNotEmpty) {
        _cache[hostname] = _CacheEntry(
          ips: ips,
          expiresAt: DateTime.now().add(_cacheTtl),
        );
      }
      return ips;
    } catch (e) {
      debugPrint('DnsHelper.resolve($hostname) failed: $e');
      return [hostname]; // Fall back to hostname (let system DNS try)
    }
  }

  /// Check if a hostname needs DoH resolution.
  static Future<bool> needsDoH(String hostname) async {
    if (!Platform.isAndroid) return false;
    try {
      return await _channel.invokeMethod('needsDoH', {'hostname': hostname}) as bool;
    } catch (e) {
      return false;
    }
  }

  /// Make an HTTPS request to a Cloud Functions endpoint via DoH-resolved IP.
  ///
  /// This is needed because `cloud_functions` package uses gRPC (handled by
  /// the native resolver), but if you need raw HTTP calls (e.g., for streaming
  /// or custom endpoints), use this method.
  static Future<Map<String, dynamic>> callCloudFunction({
    required String projectRegion,
    required String functionName,
    Map<String, dynamic>? data,
    String? idToken,
  }) async {
    final hostname = '$projectRegion.cloudfunctions.net';
    final ips = await resolve(hostname);

    if (ips.isEmpty) {
      throw Exception('Could not resolve $hostname');
    }

    final ip = ips.first;
    final url = Uri.parse('https://$ip/$projectRegion/$functionName');

    final client = HttpClient()
      ..badCertificateCallback = (cert, host, port) => host == ip;

    try {
      final request = await client.postUrl(url);
      request.headers.set('Host', hostname);
      request.headers.set('Content-Type', 'application/json');
      if (idToken != null) {
        request.headers.set('Authorization', 'Bearer $idToken');
      }

      if (data != null) {
        request.write(jsonEncode({'data': data}));
      }

      final response = await request.close();
      final body = await response.transform(utf8.decoder).join();
      return jsonDecode(body) as Map<String, dynamic>;
    } finally {
      client.close();
    }
  }
}

class _CacheEntry {
  final List<String> ips;
  final DateTime expiresAt;
  _CacheEntry({required this.ips, required this.expiresAt});
}
