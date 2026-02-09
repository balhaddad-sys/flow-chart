import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medq/src/core/utils/error_handler.dart';

void main() {
  group('ErrorHandler', () {
    test('returns user-friendly message for generic error', () {
      final message = ErrorHandler.userMessage(Exception('Something'));
      expect(message, equals('Something went wrong. Please try again.'));
    });

    test('returns specific message for auth user-not-found', () {
      final error = FirebaseAuthException(
        code: 'user-not-found',
        message: 'internal error',
      );
      final message = ErrorHandler.userMessage(error);
      expect(message, contains('No account'));
    });

    test('returns specific message for wrong-password', () {
      final error = FirebaseAuthException(
        code: 'wrong-password',
        message: 'internal error',
      );
      final message = ErrorHandler.userMessage(error);
      expect(message, contains('Incorrect password'));
    });

    test('returns specific message for email-already-in-use', () {
      final error = FirebaseAuthException(
        code: 'email-already-in-use',
        message: 'internal error',
      );
      final message = ErrorHandler.userMessage(error);
      expect(message, contains('already exists'));
    });

    test('returns specific message for too-many-requests', () {
      final error = FirebaseAuthException(
        code: 'too-many-requests',
        message: 'internal error',
      );
      final message = ErrorHandler.userMessage(error);
      expect(message, contains('Too many'));
    });
  });
}
