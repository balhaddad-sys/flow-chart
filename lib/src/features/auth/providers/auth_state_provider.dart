import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/utils/error_handler.dart';

enum AuthScreenState { idle, loading, success, error }

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
      await authService.updateDisplayName(name);

      final firestoreService = _ref.read(firestoreServiceProvider);
      await firestoreService.createUser(credential.user!.uid, {
        'name': name,
        'email': email,
        'timezone': 'UTC',
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
      final user = credential.user!;

      // Check if user exists in Firestore, if not create them
      final existingUser = await firestoreService.getUser(user.uid);
      if (existingUser == null) {
        await firestoreService.createUser(user.uid, {
          'name': user.displayName ?? 'User',
          'email': user.email,
          'timezone': 'UTC',
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

class AuthScreenData {
  final AuthScreenState state;
  final String? errorMessage;

  const AuthScreenData({
    this.state = AuthScreenState.idle,
    this.errorMessage,
  });

  AuthScreenData copyWith({
    AuthScreenState? state,
    String? errorMessage,
  }) {
    return AuthScreenData(
      state: state ?? this.state,
      errorMessage: errorMessage,
    );
  }
}

final authScreenProvider =
    StateNotifierProvider<AuthScreenNotifier, AuthScreenData>((ref) {
  return AuthScreenNotifier(ref);
});
