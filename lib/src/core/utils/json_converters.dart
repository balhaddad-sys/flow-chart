/// Robust JSON converters for handling malformed AI responses.
///
/// These converters provide fail-safe deserialization, preventing crashes when
/// the backend AI generates slightly malformed JSON (e.g., string numbers, null
/// fields, or missing required properties).
///
/// Use these with `@freezed` models via the `@JsonConverter()` annotation.
library;

import 'package:json_annotation/json_annotation.dart';

/// Converts dynamic input to int, with fallback to 0 for invalid data.
///
/// Handles:
/// - int → int (direct pass-through)
/// - String → int (parses, fallback to 0)
/// - null → 0
/// - double → truncated int
///
/// Example:
/// ```dart
/// @freezed
/// class Question with _$Question {
///   const factory Question({
///     @SafeIntConverter() @Default(1) int difficulty,
///   }) = _Question;
/// }
/// ```
class SafeIntConverter implements JsonConverter<int, dynamic> {
  const SafeIntConverter();

  @override
  int fromJson(dynamic json) {
    if (json == null) return 0;
    if (json is int) return json;
    if (json is double) return json.truncate();
    if (json is String) {
      return int.tryParse(json) ?? 0;
    }
    return 0;
  }

  @override
  dynamic toJson(int object) => object;
}

/// Converts dynamic input to double, with fallback to 0.0.
///
/// Handles:
/// - double → double
/// - int → double
/// - String → double (parses, fallback to 0.0)
/// - null → 0.0
class SafeDoubleConverter implements JsonConverter<double, dynamic> {
  const SafeDoubleConverter();

  @override
  double fromJson(dynamic json) {
    if (json == null) return 0.0;
    if (json is double) return json;
    if (json is int) return json.toDouble();
    if (json is String) {
      return double.tryParse(json) ?? 0.0;
    }
    return 0.0;
  }

  @override
  dynamic toJson(double object) => object;
}

/// Converts dynamic input to String, with fallback to empty string.
///
/// Handles:
/// - String → String
/// - null → ""
/// - int/double/bool → String (converts via toString())
///
/// Use this when AI might occasionally return a number where you expect text.
class SafeStringConverter implements JsonConverter<String, dynamic> {
  const SafeStringConverter();

  @override
  String fromJson(dynamic json) {
    if (json == null) return '';
    if (json is String) return json;
    return json.toString();
  }

  @override
  String toJson(String object) => object;
}

/// Converts dynamic input to List<String>, with fallback to empty list.
///
/// Handles:
/// - List<dynamic> → List<String> (converts each item)
/// - null → []
/// - String → [String] (single-item list)
/// - Non-list → [] (invalid data)
class SafeStringListConverter implements JsonConverter<List<String>, dynamic> {
  const SafeStringListConverter();

  @override
  List<String> fromJson(dynamic json) {
    if (json == null) return [];
    if (json is List) {
      return json
          .map((item) => item == null ? '' : item.toString())
          .where((s) => s.isNotEmpty)
          .toList();
    }
    if (json is String) return [json];
    return [];
  }

  @override
  List<String> toJson(List<String> object) => object;
}

/// Converts dynamic input to bool, with fallback to false.
///
/// Handles:
/// - bool → bool
/// - int → bool (0 = false, non-zero = true)
/// - String → bool ("true"/"1" = true, else false)
/// - null → false
class SafeBoolConverter implements JsonConverter<bool, dynamic> {
  const SafeBoolConverter();

  @override
  bool fromJson(dynamic json) {
    if (json == null) return false;
    if (json is bool) return json;
    if (json is int) return json != 0;
    if (json is String) {
      final lower = json.toLowerCase();
      return lower == 'true' || lower == '1' || lower == 'yes';
    }
    return false;
  }

  @override
  dynamic toJson(bool object) => object;
}

/// Converts timestamp to DateTime, with fallback to epoch (1970).
///
/// Handles:
/// - Firestore Timestamp → DateTime
/// - ISO 8601 String → DateTime
/// - Unix milliseconds (int) → DateTime
/// - null → DateTime(1970)
class SafeDateTimeConverter implements JsonConverter<DateTime, dynamic> {
  const SafeDateTimeConverter();

  @override
  DateTime fromJson(dynamic json) {
    if (json == null) return DateTime.fromMillisecondsSinceEpoch(0);

    // Firestore Timestamp (has toDate method)
    if (json is Map && json.containsKey('_seconds')) {
      final seconds = json['_seconds'] as int;
      return DateTime.fromMillisecondsSinceEpoch(seconds * 1000);
    }

    // ISO 8601 String
    if (json is String) {
      return DateTime.tryParse(json) ?? DateTime.fromMillisecondsSinceEpoch(0);
    }

    // Unix milliseconds
    if (json is int) {
      return DateTime.fromMillisecondsSinceEpoch(json);
    }

    return DateTime.fromMillisecondsSinceEpoch(0);
  }

  @override
  dynamic toJson(DateTime object) => object.toIso8601String();
}

/// Converts enum-like strings to typed enums, with fallback default.
///
/// Usage:
/// ```dart
/// enum Status { pending, completed, failed }
///
/// @freezed
/// class Task with _$Task {
///   const factory Task({
///     @EnumConverter<Status>(Status.values, Status.pending)
///     required Status status,
///   }) = _Task;
/// }
/// ```
class EnumConverter<T> implements JsonConverter<T, String> {
  final List<T> values;
  final T defaultValue;

  const EnumConverter(this.values, this.defaultValue);

  @override
  T fromJson(String json) {
    try {
      return values.firstWhere(
        (v) => v.toString().split('.').last.toLowerCase() == json.toLowerCase(),
        orElse: () => defaultValue,
      );
    } catch (_) {
      return defaultValue;
    }
  }

  @override
  String toJson(T object) => object.toString().split('.').last;
}
