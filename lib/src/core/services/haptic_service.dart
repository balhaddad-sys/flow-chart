import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Centralized haptic feedback service.
///
/// Provides consistent haptic patterns across the app. All methods are no-ops
/// on web where vibration APIs aren't available.
class HapticService {
  HapticService._();

  /// Light tap — used for selections, toggles, tab switches.
  static void light() {
    if (kIsWeb) return;
    HapticFeedback.lightImpact();
  }

  /// Medium tap — used for button presses, confirming actions.
  static void medium() {
    if (kIsWeb) return;
    HapticFeedback.mediumImpact();
  }

  /// Heavy tap — used for errors, destructive actions, important alerts.
  static void heavy() {
    if (kIsWeb) return;
    HapticFeedback.heavyImpact();
  }

  /// Selection tick — used for scrolling through pickers, steppers.
  static void selection() {
    if (kIsWeb) return;
    HapticFeedback.selectionClick();
  }

  /// Success vibration — double light tap.
  static void success() {
    if (kIsWeb) return;
    HapticFeedback.lightImpact();
  }

  /// Error vibration — heavy impact for failures.
  static void error() {
    if (kIsWeb) return;
    HapticFeedback.heavyImpact();
  }
}
