import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../services/cloud_functions_service.dart';

class ErrorHandler {
  ErrorHandler._();

  /// Convert any error to a user-friendly message.
  static String userMessage(Object error) {
    if (error is FirebaseAuthException) {
      return _authError(error);
    }
    if (error is FirebaseException) {
      return _firebaseError(error);
    }
    if (error is CloudFunctionException) {
      return error.message;
    }
    return 'Something went wrong. Please try again.';
  }

  static final Map<String, String> _authErrorMessages = {
    'user-not-found': 'No account found with this email.',
    'wrong-password': 'Incorrect password.',
    'email-already-in-use': 'An account already exists with this email.',
    'weak-password': 'Password is too weak. Use at least 6 characters.',
    'invalid-email': 'Invalid email address.',
    'too-many-requests': 'Too many attempts. Please wait and try again.',
    'popup-closed-by-user': 'Sign-in was cancelled.',
    'popup-blocked': 'Pop-up blocked by browser. Please allow pop-ups and try again.',
    'account-exists-with-different-credential':
        'An account already exists with this email using a different sign-in method.',
    'redirect-failed': 'Google Sign-In redirect did not complete. Please try again.',
  };

  static String _authError(FirebaseAuthException error) {
    return _authErrorMessages[error.code] ?? 'Authentication error. Please try again.';
  }

  static final Map<String, String> _firebaseErrorMessages = {
    'permission-denied': 'Permission denied. Please sign in again.',
    'unavailable': 'Service unavailable. Check your connection.',
    'not-found': 'The requested data was not found.',
  };

  static String _firebaseError(FirebaseException error) {
    return _firebaseErrorMessages[error.code] ?? 'A server error occurred. Please try again.';
  }

  /// Log error for debugging (non-production).
  static void logError(Object error, [StackTrace? stackTrace]) {
    if (kDebugMode) {
      debugPrint('ERROR: $error');
      if (stackTrace != null) {
        debugPrint('STACK: $stackTrace');
      }
    }
  }
}
