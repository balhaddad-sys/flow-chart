import 'dart:convert';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Vercel-hosted BFF proxy for Firebase services blocked in restricted regions.
///
/// Some ISPs (e.g. certain Kuwait providers) block *.googleapis.com at DNS/IP
/// level, preventing Flutter's gRPC-based Firebase SDK from connecting.
/// This service routes critical operations through our Vercel deployment
/// (medqs.vercel.app) which is reachable from those regions.
///
/// Proxy endpoints:
///   GET  /api/m/ping   — health check
///   POST /api/m/auth   — Firebase Auth (signIn / signUp / refresh)
///   POST /api/m/fs     — Firestore reads (courses, tasks, stats, etc.)
class ProxyService {
  static const String _proxyBase = 'https://medqs.vercel.app/api/m';
  static const Duration _probeTimeout = Duration(seconds: 6);
  static const Duration _reqTimeout = Duration(seconds: 25);

  // SharedPreferences keys for persisting proxy session
  static const String _kUid = 'proxy_uid';
  static const String _kEmail = 'proxy_email';
  static const String _kDisplayName = 'proxy_display_name';
  static const String _kIdToken = 'proxy_id_token';
  static const String _kRefreshToken = 'proxy_refresh_token';
  static const String _kExpiresAt = 'proxy_expires_at_ms';

  final http.Client _client;

  ProxyService({http.Client? client}) : _client = client ?? http.Client();

  // ── Connectivity probes ────────────────────────────────────────────────────

  /// Returns true if the Vercel proxy endpoint is reachable.
  Future<bool> isProxyReachable() async {
    try {
      final res = await _client
          .get(Uri.parse('$_proxyBase/ping'))
          .timeout(_probeTimeout);
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  /// Returns true if Firebase Firestore's HTTPS endpoint is reachable.
  ///
  /// We probe the HTTPS port of firestore.googleapis.com. If the ISP blocks
  /// the host at DNS/IP level a [SocketException] or timeout is thrown.
  Future<bool> isFirebaseReachable() async {
    // Web always uses WebChannel (HTTP) which is not blocked; skip probe.
    if (kIsWeb) return true;

    try {
      // Any response (even 403) means the host resolved and connected.
      await _client
          .get(Uri.parse('https://firestore.googleapis.com/'))
          .timeout(_probeTimeout);
      return true;
    } catch (_) {
      return false;
    }
  }

  // ── Auth proxy ─────────────────────────────────────────────────────────────

  /// Signs in with email + password via the Vercel auth proxy.
  Future<ProxySession> signIn(String email, String password) async {
    final data = await _authPost({
      'action': 'signIn',
      'email': email,
      'password': password,
    });
    return _buildSession(data);
  }

  /// Signs up with email + password via the Vercel auth proxy.
  Future<ProxySession> signUp(
      String email, String password, String displayName) async {
    final data = await _authPost({
      'action': 'signUp',
      'email': email,
      'password': password,
      'displayName': displayName,
    });
    return _buildSession(data);
  }

  /// Refreshes an expired ID token using a stored refresh token.
  Future<ProxySession> refreshToken(String refreshToken) async {
    final data = await _authPost({
      'action': 'refresh',
      'refreshToken': refreshToken,
    });
    return _buildSession(data);
  }

  Future<Map<String, dynamic>> _authPost(Map<String, dynamic> body) async {
    final res = await _client
        .post(
          Uri.parse('$_proxyBase/auth'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode(body),
        )
        .timeout(_reqTimeout);
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode != 200) {
      throw ProxyException(
          data['error'] as String? ?? 'Auth request failed (${res.statusCode})');
    }
    return data;
  }

  // ── Firestore proxy ────────────────────────────────────────────────────────

  /// Reads documents from a Firestore collection via the proxy.
  ///
  /// Returns a flat list of JSON maps — same shape as Firestore SDK's
  /// [DocumentSnapshot.data()] plus an `id` field.
  Future<List<Map<String, dynamic>>> readCollection(
    String col,
    String idToken, {
    String? courseId,
    String? fileId,
    bool today = false,
  }) async {
    final body = <String, dynamic>{'col': col};
    if (courseId != null) body['courseId'] = courseId;
    if (fileId != null) body['fileId'] = fileId;
    if (today) body['today'] = true;

    final res = await _client
        .post(
          Uri.parse('$_proxyBase/fs'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $idToken',
          },
          body: jsonEncode(body),
        )
        .timeout(_reqTimeout);

    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode != 200) {
      throw ProxyException(data['error'] as String? ??
          'Firestore proxy error (${res.statusCode})');
    }

    final docs = data['docs'] as List? ?? [];
    return docs.cast<Map<String, dynamic>>();
  }

  // ── Session persistence ────────────────────────────────────────────────────

  Future<void> saveSession(ProxySession session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kUid, session.uid);
    await prefs.setString(_kEmail, session.email);
    await prefs.setString(_kDisplayName, session.displayName);
    await prefs.setString(_kIdToken, session.idToken);
    await prefs.setString(_kRefreshToken, session.refreshToken);
    await prefs.setInt(_kExpiresAt, session.expiresAt.millisecondsSinceEpoch);
  }

  Future<ProxySession?> loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    final uid = prefs.getString(_kUid);
    final idToken = prefs.getString(_kIdToken);
    final refreshTok = prefs.getString(_kRefreshToken);
    final expiresAtMs = prefs.getInt(_kExpiresAt);
    if (uid == null || idToken == null || refreshTok == null ||
        expiresAtMs == null) {
      return null;
    }
    return ProxySession(
      uid: uid,
      email: prefs.getString(_kEmail) ?? '',
      displayName: prefs.getString(_kDisplayName) ?? '',
      idToken: idToken,
      refreshToken: refreshTok,
      expiresAt: DateTime.fromMillisecondsSinceEpoch(expiresAtMs),
    );
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    for (final k in [_kUid, _kEmail, _kDisplayName, _kIdToken,
        _kRefreshToken]) {
      await prefs.remove(k);
    }
    await prefs.remove(_kExpiresAt);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  ProxySession _buildSession(Map<String, dynamic> data) {
    final expSec =
        int.tryParse(data['expiresIn']?.toString() ?? '3600') ?? 3600;
    return ProxySession(
      uid: data['localId'] as String? ?? '',
      email: data['email'] as String? ?? '',
      displayName: data['displayName'] as String? ?? '',
      idToken: data['idToken'] as String? ?? '',
      refreshToken: data['refreshToken'] as String? ?? '',
      expiresAt: DateTime.now().add(Duration(seconds: expSec)),
    );
  }
}

// ── Value objects ──────────────────────────────────────────────────────────

class ProxySession {
  final String uid;
  final String email;
  final String displayName;
  final String idToken;
  final String refreshToken;
  final DateTime expiresAt;

  const ProxySession({
    required this.uid,
    required this.email,
    required this.displayName,
    required this.idToken,
    required this.refreshToken,
    required this.expiresAt,
  });

  /// True if the token expires within 5 minutes.
  bool get isExpired =>
      DateTime.now().isAfter(expiresAt.subtract(const Duration(minutes: 5)));
}

class ProxyException implements Exception {
  final String message;
  const ProxyException(this.message);

  @override
  String toString() => 'ProxyException: $message';
}
