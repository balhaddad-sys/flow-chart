import 'package:flutter_test/flutter_test.dart';
import 'package:medq/src/core/utils/validators.dart';

void main() {
  group('Validators', () => {
    group('email', () {
      test('returns null for valid email', () {
        expect(Validators.email('test@example.com'), isNull);
      });

      test('returns error for empty email', () {
        expect(Validators.email(''), isNotNull);
      });

      test('returns error for null', () {
        expect(Validators.email(null), isNotNull);
      });

      test('returns error for invalid email', () {
        expect(Validators.email('notanemail'), isNotNull);
      });
    });

    group('password', () {
      test('returns null for valid password', () {
        expect(Validators.password('password123'), isNull);
      });

      test('returns error for short password', () {
        expect(Validators.password('abc'), isNotNull);
      });

      test('returns error for empty password', () {
        expect(Validators.password(''), isNotNull);
      });
    });

    group('required', () {
      test('returns null for non-empty string', () {
        expect(Validators.required('value'), isNull);
      });

      test('returns error for empty string', () {
        expect(Validators.required(''), isNotNull);
      });

      test('returns error for null', () {
        expect(Validators.required(null), isNotNull);
      });
    });

    group('courseTitle', () {
      test('returns null for valid title', () {
        expect(Validators.courseTitle('Anatomy 101'), isNull);
      });

      test('returns error for empty title', () {
        expect(Validators.courseTitle(''), isNotNull);
      });
    });

    group('minutes', () {
      test('returns null for valid minutes', () {
        expect(Validators.minutes('60'), isNull);
      });

      test('returns error for non-numeric', () {
        expect(Validators.minutes('abc'), isNotNull);
      });

      test('returns error for zero', () {
        expect(Validators.minutes('0'), isNotNull);
      });
    });
  });
}
