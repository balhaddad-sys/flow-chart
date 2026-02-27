import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/proxy_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/services/proxy_service.dart';
import '../../../core/utils/error_handler.dart';

enum AuthScreenState { idle, loading, success, error }

const Map<String, dynamic> _defaultPreferences = {
  'pomodoroStyle': '25/5',
  'revisionPolicy': 'standard',
  'dailyMinutesDefault': 120,
  'catchUpBufferPercent': 15,
};

class AuthScreenNotifier extends StateNotifier<AuthScreenData> {
  final Ref _ref;

  AuthScreenNotifier(this._ref) : super(const AuthScreenData());

  Future<void> signIn(String email, String password) async {
    state = state.copyWith(state: AuthScreenState.loading, errorMessage: null);
    try {
      final authService = _ref.read(authServiceProvider);
      await authService.signInWithEmail(email, password);
      state = state.copyWith(state: AuthScreenState.success);
    } catch (e) {
      // If Firebase Auth is blocked by the ISP, fall back to proxy.
      if (_ref.read(networkModeProvider) == NetworkMode.proxy) {
        await _proxySignIn(email, password);
      } else {
        ErrorHandler.logError(e);
        state = state.copyWith(
          state: AuthScreenState.error,
          errorMessage: ErrorHandler.userMessage(e),
        );
      }
    }
  }

  Future<void> _proxySignIn(String email, String password) async {
    try {
      final proxy = _ref.read(proxyServiceProvider);
      final session = await proxy.signIn(email, password);
      await _ref.read(proxySessionProvider.notifier).setSession(session);
      state = state.copyWith(state: AuthScreenState.success);
    } catch (e) {
      ErrorHandler.logError(e);
      final msg =
          e is ProxyException ? e.message : ErrorHandler.userMessage(e);
      state = state.copyWith(
        state: AuthScreenState.error,
        errorMessage: msg,
      );
    }
  }

  Future<void> signUp(String name, String email, String password) async {
    state = state.copyWith(state: AuthScreenState.loading, errorMessage: null);
    try {
      final authService = _ref.read(authServiceProvider);
      final credential = await authService.signUpWithEmail(email, password);
      final user = credential.user;
      if (user == null) {
        throw Exception('Sign-up succeeded but no user was returned.');
      }
      await authService.updateDisplayName(name);

      final firestoreService = _ref.read(firestoreServiceProvider);
      await firestoreService.createUser(user.uid, {
        'name': name,
        'email': email,
        'timezone': 'UTC',
        'preferences': _defaultPreferences,
        'subscriptionTier': 'free',
      });

      state = state.copyWith(state: AuthScreenState.success);
    } catch (e) {
      // If Firebase Auth is blocked, fall back to proxy sign-up.
      if (_ref.read(networkModeProvider) == NetworkMode.proxy) {
        await _proxySignUp(name, email, password);
      } else {
        ErrorHandler.logError(e);
        state = state.copyWith(
          state: AuthScreenState.error,
          errorMessage: ErrorHandler.userMessage(e),
        );
      }
    }
  }

  Future<void> _proxySignUp(
      String name, String email, String password) async {
    try {
      final proxy = _ref.read(proxyServiceProvider);
      final session = await proxy.signUp(email, password, name);
      await _ref.read(proxySessionProvider.notifier).setSession(session);
      // Note: user profile creation in Firestore is handled by Cloud Functions
      // (cloudfunctions.net), which remain reachable even in proxy mode.
      state = state.copyWith(state: AuthScreenState.success);
    } catch (e) {
      ErrorHandler.logError(e);
      final msg =
          e is ProxyException ? e.message : ErrorHandler.userMessage(e);
      state = state.copyWith(
        state: AuthScreenState.error,
        errorMessage: msg,
      );
    }
  }

  Future<void> signInWithGoogle() async {
    state = state.copyWith(state: AuthScreenState.loading, errorMessage: null);
    try {
      final authService = _ref.read(authServiceProvider);
      final credential = await authService.signInWithGoogle();

      final firestoreService = _ref.read(firestoreServiceProvider);
      final user = credential.user;
      if (user == null) {
        throw Exception('Google Sign-In succeeded but no user was returned.');
      }

      // Check if user exists in Firestore, if not create them
      final existingUser = await firestoreService.getUser(user.uid);
      if (existingUser == null) {
        await firestoreService.createUser(user.uid, {
          'name': user.displayName ?? 'User',
          'email': user.email,
          'timezone': 'UTC',
          'preferences': _defaultPreferences,
          'subscriptionTier': 'free',
        });
      }

      state = state.copyWith(state: AuthScreenState.success);
    } catch (e) {
      ErrorHandler.logError(e);
      state = state.copyWith(
        state: AuthScreenState.error,
        errorMessage: ErrorHandler.userMessage(e),
      );
    }
  }

  void clearError() {
    state = state.copyWith(errorMessage: null, state: AuthScreenState.idle);
  }
}

class _Absent {
  const _Absent();
}

const _absent = _Absent();

class AuthScreenData {
  final AuthScreenState state;
  final String? errorMessage;

  const AuthScreenData({this.state = AuthScreenState.idle, this.errorMessage});

  AuthScreenData copyWith({
    AuthScreenState? state,
    Object? errorMessage = _absent,
  }) {
    return AuthScreenData(
      state: state ?? this.state,
      errorMessage:
          errorMessage is _Absent ? this.errorMessage : errorMessage as String?,
    );
  }
}

final authScreenProvider =
    StateNotifierProvider<AuthScreenNotifier, AuthScreenData>((ref) {
      return AuthScreenNotifier(ref);
    });
