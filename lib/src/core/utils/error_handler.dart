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

  static String _authError(FirebaseAuthException error) {
    switch (error.code) {
      case 'user-not-found':
        return 'No account found with this email.';
      case 'wrong-password':
        return 'Incorrect password.';
      case 'email-already-in-use':
        return 'An account already exists with this email.';
      case 'weak-password':
        return 'Password is too weak. Use at least 6 characters.';
      case 'invalid-email':
        return 'Invalid email address.';
      case 'too-many-requests':
        return 'Too many attempts. Please wait and try again.';
      default:
        return 'Authentication error. Please try again.';
    }
  }

  static String _firebaseError(FirebaseException error) {
    switch (error.code) {
      case 'permission-denied':
        return 'Permission denied. Please sign in again.';
      case 'unavailable':
        return 'Service unavailable. Check your connection.';
      case 'not-found':
        return 'The requested data was not found.';
      default:
        return 'A server error occurred. Please try again.';
    }
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
