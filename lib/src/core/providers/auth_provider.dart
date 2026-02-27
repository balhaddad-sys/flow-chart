import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/auth_service.dart';
import 'proxy_provider.dart';

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});

final authStateProvider = StreamProvider<User?>((ref) {
  final authService = ref.watch(authServiceProvider);
  return authService.authStateChanges;
});

final currentUserProvider = Provider<User?>((ref) {
  return ref.watch(authStateProvider).valueOrNull;
});

/// Returns the currently authenticated user's UID.
///
/// Falls back to the proxy session UID when Firebase Auth is unavailable
/// (e.g. identitytoolkit.googleapis.com is blocked by the ISP).
final uidProvider = Provider<String?>((ref) {
  final firebaseUid = ref.watch(currentUserProvider)?.uid;
  if (firebaseUid != null) return firebaseUid;
  return ref.watch(proxySessionProvider)?.uid;
});
