import 'package:intl/intl.dart';

class AppDateUtils {
  AppDateUtils._();

  static final DateFormat _dayFormat = DateFormat('EEE, MMM d');
  static final DateFormat _fullFormat = DateFormat('EEEE, MMMM d, y');
  static final DateFormat _timeFormat = DateFormat('h:mm a');
  static final DateFormat _isoFormat = DateFormat('yyyy-MM-dd');

  static String formatDay(DateTime date) => _dayFormat.format(date);
  static String formatFull(DateTime date) => _fullFormat.format(date);
  static String formatTime(DateTime date) => _timeFormat.format(date);
  static String formatIso(DateTime date) => _isoFormat.format(date);

  static bool isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  static bool isToday(DateTime date) {
    return isSameDay(date, DateTime.now());
  }

  static bool isTomorrow(DateTime date) {
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    return isSameDay(date, tomorrow);
  }

  static int daysUntil(DateTime target) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final targetDay = DateTime(target.year, target.month, target.day);
    return targetDay.difference(today).inDays;
  }

  static String formatDuration(int minutes) {
    if (minutes < 60) return '${minutes}m';
    final hours = minutes ~/ 60;
    final mins = minutes % 60;
    if (mins == 0) return '${hours}h';
    return '${hours}h ${mins}m';
  }

  static String relativeDay(DateTime date) {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    final daysAway = daysUntil(date);
    if (daysAway < 0) return '${-daysAway}d overdue';
    if (daysAway <= 7) return formatDay(date);
    return formatFull(date);
  }
}
