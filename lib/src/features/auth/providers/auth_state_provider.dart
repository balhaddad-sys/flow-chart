import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
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
      ErrorHandler.logError(e);
      state = state.copyWith(
        state: AuthScreenState.error,
        errorMessage: ErrorHandler.userMessage(e),
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
      ErrorHandler.logError(e);
      state = state.copyWith(
        state: AuthScreenState.error,
        errorMessage: ErrorHandler.userMessage(e),
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
