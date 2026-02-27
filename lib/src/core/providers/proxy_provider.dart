import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/proxy_service.dart';

// ── Network mode ───────────────────────────────────────────────────────────

enum NetworkMode {
  checking, // Connectivity probe in progress
  direct, // Firebase reachable — normal SDK path
  proxy, // Firebase blocked — Vercel proxy used
  offline, // Neither Firebase nor proxy reachable
}

class NetworkModeNotifier extends StateNotifier<NetworkMode> {
  final ProxyService _proxy;

  NetworkModeNotifier(this._proxy) : super(NetworkMode.checking) {
    _probe();
  }

  Future<void> _probe() async {
    // Web uses WebChannel (HTTP), not gRPC — always reachable.
    if (kIsWeb) {
      state = NetworkMode.direct;
      return;
    }

    final firebaseOk = await _proxy.isFirebaseReachable();
    if (firebaseOk) {
      state = NetworkMode.direct;
      return;
    }

    final proxyOk = await _proxy.isProxyReachable();
    state = proxyOk ? NetworkMode.proxy : NetworkMode.offline;
  }

  /// Re-run the connectivity probe (e.g. after the user toggles network).
  Future<void> recheck() => _probe();
}

// ── Proxy session ──────────────────────────────────────────────────────────

/// Persisted auth session used when Firebase Auth is blocked.
///
/// On startup the notifier loads any stored session from SharedPreferences.
/// After proxy sign-in / sign-up the session is written here and persisted.
class ProxySessionNotifier extends StateNotifier<ProxySession?> {
  final ProxyService _proxy;

  ProxySessionNotifier(this._proxy) : super(null) {
    _load();
  }

  Future<void> _load() async {
    final session = await _proxy.loadSession();
    if (session != null && !session.isExpired) {
      state = session;
    }
  }

  Future<void> setSession(ProxySession session) async {
    await _proxy.saveSession(session);
    state = session;
  }

  Future<void> clear() async {
    await _proxy.clearSession();
    state = null;
  }

  /// Returns the current ID token, refreshing it via proxy if expired.
  ///
  /// Returns null if there is no session or the refresh fails.
  Future<String?> getValidIdToken() async {
    final session = state;
    if (session == null) return null;

    if (!session.isExpired) return session.idToken;

    // Try to refresh
    try {
      final refreshed = await _proxy.refreshToken(session.refreshToken);
      await setSession(refreshed);
      return refreshed.idToken;
    } catch (_) {
      await clear();
      return null;
    }
  }
}

// ── Providers ──────────────────────────────────────────────────────────────

final proxyServiceProvider = Provider<ProxyService>((ref) => ProxyService());

final networkModeProvider =
    StateNotifierProvider<NetworkModeNotifier, NetworkMode>((ref) {
  return NetworkModeNotifier(ref.watch(proxyServiceProvider));
});

final proxySessionProvider =
    StateNotifierProvider<ProxySessionNotifier, ProxySession?>((ref) {
  return ProxySessionNotifier(ref.watch(proxyServiceProvider));
});
