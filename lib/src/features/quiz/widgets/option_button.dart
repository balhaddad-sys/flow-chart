import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/constants/app_colors.dart';

/// Option button matching the web app's QuestionCard option layout exactly.
///
/// States:
///   Default  → muted badge, subtle border, hover-able
///   Pending  → primary border+badge, spinner in badge
///   Correct  → emerald border+badge (check icon), check_circle trailing
///   Wrong    → AMBER border+badge (close icon) — NOT red
///   Dimmed   → opacity 0.45 for non-selected non-correct after submit
class OptionButton extends StatelessWidget {
  final int index;
  final String text;
  final bool isSelected;
  final bool isCorrectOption;
  final bool isAnswered;
  final bool isPending;
  final VoidCallback onTap;

  const OptionButton({
    super.key,
    required this.index,
    required this.text,
    required this.isSelected,
    required this.isCorrectOption,
    required this.isAnswered,
    this.isPending = false,
    required this.onTap,
  });

  static const _labels = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Web colors
  static const _emerald500 = Color(0xFF10B981);
  static const _amber400 = Color(0xFFFBBF24);
  static const _amber500 = Color(0xFFF59E0B);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // ── Determine visual state (matches web's style variable) ──────────
    Color borderColor;
    Color bgColor;
    Color badgeBg;
    Color badgeText;
    Widget badgeChild;
    Widget? trailing;
    double opacity = 1.0;

    if (isPending) {
      // Pending: primary border, primary badge with spinner
      borderColor = AppColors.primary;
      bgColor = AppColors.primary.withValues(alpha: 0.05);
      badgeBg = AppColors.primary;
      badgeText = Colors.white;
      badgeChild = const SizedBox(
        width: 12,
        height: 12,
        child: CircularProgressIndicator(
          strokeWidth: 1.5,
          color: Colors.white,
        ),
      );
    } else if (isAnswered) {
      if (isCorrectOption) {
        // Correct option: emerald
        borderColor = _emerald500.withValues(alpha: 0.5);
        bgColor = isDark
            ? _emerald500.withValues(alpha: 0.10)
            : const Color(0xFFECFDF5).withValues(alpha: 0.8);
        badgeBg = _emerald500;
        badgeText = Colors.white;
        badgeChild = const Icon(Icons.check_rounded, size: 14, color: Colors.white);
        trailing = Icon(Icons.check_circle, size: 18, color: _emerald500);
      } else if (isSelected) {
        // Selected wrong: AMBER (not red — matches web exactly)
        borderColor = _amber400.withValues(alpha: 0.5);
        bgColor = isDark
            ? _amber500.withValues(alpha: 0.10)
            : const Color(0xFFFFFBEB).withValues(alpha: 0.8);
        badgeBg = _amber500;
        badgeText = Colors.white;
        badgeChild = const Icon(Icons.close_rounded, size: 14, color: Colors.white);
      } else {
        // Non-selected, non-correct after answer: dimmed
        borderColor = isDark
            ? Colors.white.withValues(alpha: 0.04)
            : Colors.black.withValues(alpha: 0.04);
        bgColor = isDark ? AppColors.darkSurface : AppColors.surface;
        badgeBg = isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant;
        badgeText = isDark ? AppColors.darkTextTertiary : AppColors.textTertiary;
        badgeChild = _letterWidget(badgeText);
        opacity = 0.45;
      }
    } else {
      // Default: subtle border, muted badge
      borderColor = isDark
          ? AppColors.darkBorder.withValues(alpha: 0.6)
          : AppColors.border.withValues(alpha: 0.6);
      bgColor = isDark ? AppColors.darkSurface : AppColors.surface;
      badgeBg = isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant;
      badgeText = isDark ? AppColors.darkTextSecondary : AppColors.textSecondary;
      badgeChild = _letterWidget(badgeText);
    }

    // If not pending and not a special state, build letter badge
    if (!isPending && !(isAnswered && (isCorrectOption || isSelected))) {
      badgeChild = _letterWidget(badgeText);
    }

    return GestureDetector(
      onTap: isAnswered
          ? null
          : () {
              HapticFeedback.selectionClick();
              onTap();
            },
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 150),
        opacity: opacity,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: bgColor,
            border: Border.all(color: borderColor, width: 1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Letter badge — 24x24 rounded-lg (matches web h-6 w-6 rounded-lg)
              Container(
                width: 24,
                height: 24,
                margin: const EdgeInsets.only(top: 1),
                decoration: BoxDecoration(
                  color: badgeBg,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Center(child: badgeChild),
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
              // Trailing icon (check circle for correct)
              if (trailing != null) ...[
                const SizedBox(width: 8),
                Padding(
                  padding: const EdgeInsets.only(top: 1),
                  child: trailing,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _letterWidget(Color color) {
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
