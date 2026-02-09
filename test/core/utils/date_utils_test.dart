import 'package:flutter_test/flutter_test.dart';
import 'package:medq/src/core/utils/date_utils.dart';

void main() {
  group('AppDateUtils', () {
    test('isSameDay returns true for same day', () {
      final a = DateTime(2025, 3, 15, 10, 30);
      final b = DateTime(2025, 3, 15, 22, 0);
      expect(AppDateUtils.isSameDay(a, b), isTrue);
    });

    test('isSameDay returns false for different days', () {
      final a = DateTime(2025, 3, 15);
      final b = DateTime(2025, 3, 16);
      expect(AppDateUtils.isSameDay(a, b), isFalse);
    });

    test('daysUntil returns correct count', () {
      final now = DateTime.now();
      final future = now.add(const Duration(days: 5));
      expect(AppDateUtils.daysUntil(future), equals(5));
    });

    test('daysUntil returns 0 for today', () {
      final now = DateTime.now();
      expect(AppDateUtils.daysUntil(now), equals(0));
    });

    test('formatDuration handles minutes only', () {
      expect(AppDateUtils.formatDuration(45), equals('45 min'));
    });

    test('formatDuration handles hours and minutes', () {
      expect(AppDateUtils.formatDuration(90), equals('1h 30min'));
    });

    test('formatIso returns ISO format', () {
      final date = DateTime(2025, 3, 15);
      expect(AppDateUtils.formatIso(date), equals('2025-03-15'));
    });

    test('relativeDay returns Today for today', () {
      final today = DateTime.now();
      expect(AppDateUtils.relativeDay(today), equals('Today'));
    });

    test('relativeDay returns Tomorrow for tomorrow', () {
      final tomorrow = DateTime.now().add(const Duration(days: 1));
      expect(AppDateUtils.relativeDay(tomorrow), equals('Tomorrow'));
    });
  });
}
