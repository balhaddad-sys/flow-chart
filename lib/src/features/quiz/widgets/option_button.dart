// FILE: lib/src/features/quiz/widgets/option_button.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/constants/app_colors.dart';

/// Visual state of an option button.
enum OptionState {
  /// Default — question not yet answered.
  idle,

  /// User tapped this option, awaiting backend confirmation (brief flash).
  pending,

  /// This is the correct option (shown after answering).
  correct,

  /// User selected this option and it is wrong.
  wrong,

  /// Another option that was neither selected nor correct (dimmed).
  unselected,
}

/// Option button matching the web app QuestionCard option layout.
///
/// - idle      → white/dark bg, subtle border, letter badge
/// - pending   → primary border + badge with spinner
/// - correct   → emerald bg, check icon
/// - wrong     → amber bg, close icon (NOT red — matches web)
/// - unselected → dimmed, opacity 0.45
class OptionButton extends StatelessWidget {
  final int index;
  final String text;
  final OptionState state;
  final VoidCallback? onTap;

  const OptionButton({
    super.key,
    required this.index,
    required this.text,
    required this.state,
    this.onTap,
  });

  static const _labels = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Web palette
  static const _emerald500 = Color(0xFF10B981);
  static const _emeraldBg = Color(0xFFECFDF5);
  static const _amber400 = Color(0xFFFBBF24);
  static const _amber500 = Color(0xFFF59E0B);
  static const _amberBg = Color(0xFFFFFBEB);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Resolve visual properties per state
    final _Appearance ap = _resolve(isDark);

    return GestureDetector(
      onTap: state == OptionState.idle
          ? () {
              HapticFeedback.mediumImpact();
              onTap?.call();
            }
          : null,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 150),
        opacity: state == OptionState.unselected ? 0.45 : 1.0,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: ap.bgColor,
            border: Border.all(color: ap.borderColor, width: 1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Letter / state badge (24 × 24, rounded-lg matches web h-6 w-6)
              AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 24,
                height: 24,
                margin: const EdgeInsets.only(top: 1),
                decoration: BoxDecoration(
                  color: ap.badgeBg,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Center(child: ap.badgeChild),
              ),
              const SizedBox(width: 12),

              // Option text
              Expanded(
                child: Text(
                  text.isNotEmpty ? text : 'Option ${index + 1}',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w400,
                    height: 1.5,
                    color: isDark
                        ? AppColors.darkTextPrimary
                        : AppColors.textPrimary,
                  ),
                ),
              ),

              // Trailing icon (correct only)
              if (ap.trailing != null) ...[
                const SizedBox(width: 8),
                Padding(
                  padding: const EdgeInsets.only(top: 1),
                  child: ap.trailing,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  _Appearance _resolve(bool isDark) {
    switch (state) {
      case OptionState.pending:
        return _Appearance(
          bgColor: AppColors.primary.withValues(alpha: 0.05),
          borderColor: AppColors.primary,
          badgeBg: AppColors.primary,
          badgeChild: const SizedBox(
            width: 12,
            height: 12,
            child: CircularProgressIndicator(
              strokeWidth: 1.5,
              color: Colors.white,
            ),
          ),
          trailing: null,
        );

      case OptionState.correct:
        return _Appearance(
          bgColor: isDark
              ? _emerald500.withValues(alpha: 0.10)
              : _emeraldBg.withValues(alpha: 0.8),
          borderColor: _emerald500.withValues(alpha: 0.5),
          badgeBg: _emerald500,
          badgeChild: const Icon(
            Icons.check_rounded,
            size: 14,
            color: Colors.white,
          ),
          trailing: Icon(Icons.check_circle, size: 18, color: _emerald500),
        );

      case OptionState.wrong:
        return _Appearance(
          bgColor: isDark
              ? _amber500.withValues(alpha: 0.10)
              : _amberBg.withValues(alpha: 0.8),
          borderColor: _amber400.withValues(alpha: 0.5),
          badgeBg: _amber500,
          badgeChild: const Icon(
            Icons.close_rounded,
            size: 14,
            color: Colors.white,
          ),
          trailing: null,
        );

      case OptionState.unselected:
        return _Appearance(
          bgColor: isDark ? AppColors.darkSurface : AppColors.surface,
          borderColor: isDark
              ? Colors.white.withValues(alpha: 0.04)
              : Colors.black.withValues(alpha: 0.04),
          badgeBg:
              isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
          badgeChild: _letter(
              isDark ? AppColors.darkTextTertiary : AppColors.textTertiary),
          trailing: null,
        );

      case OptionState.idle:
        return _Appearance(
          bgColor: isDark ? AppColors.darkSurface : AppColors.surface,
          borderColor: isDark
              ? AppColors.darkBorder.withValues(alpha: 0.6)
              : AppColors.border.withValues(alpha: 0.6),
          badgeBg:
              isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
          badgeChild: _letter(
              isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
          trailing: null,
        );
    }
  }

  Widget _letter(Color color) {
    return Text(
      index < _labels.length ? _labels[index] : '${index + 1}',
      style: TextStyle(
        color: color,
        fontWeight: FontWeight.w700,
        fontSize: 11,
      ),
    );
  }
}

class _Appearance {
  final Color bgColor;
  final Color borderColor;
  final Color badgeBg;
  final Widget badgeChild;
  final Widget? trailing;

  const _Appearance({
    required this.bgColor,
    required this.borderColor,
    required this.badgeBg,
    required this.badgeChild,
    required this.trailing,
  });
}
