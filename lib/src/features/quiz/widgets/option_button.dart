import 'package:flutter/material.dart';

import '../../../core/icons/medq_icons.dart';
import '../../../core/theme/app_colors.dart';

/// A single answer option row for the quiz.
class AnswerOption extends StatelessWidget {
  final int index;
  final String text;
  final bool isSelected;
  final bool isSubmitted;
  final bool isCorrect;

  const AnswerOption({
    super.key,
    required this.index,
    required this.text,
    this.isSelected = false,
    this.isSubmitted = false,
    this.isCorrect = false,
  });

  static const _letters = ['A', 'B', 'C', 'D', 'E'];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tx = isDark ? AppColors.darkTextPrimary : AppColors.textPrimary;
    final ts = isDark ? AppColors.darkTextSecondary : AppColors.textSecondary;

    // Determine visual state
    Color bg, borderColor, labelBg, labelColor;
    Widget? trailing;
    String? trailType;
    double opacity = 1;

    if (isSubmitted) {
      if (isCorrect) {
        bg = AppColors.success.withValues(alpha: 0.06);
        borderColor = AppColors.success.withValues(alpha: 0.4);
        labelBg = AppColors.success;
        labelColor = Colors.white;
        trailType = 'check';
        trailing = MedQIcon(MedQIcons.checkCircle, size: 20, color: AppColors.success);
      } else if (isSelected) {
        bg = AppColors.error.withValues(alpha: 0.06);
        borderColor = AppColors.error.withValues(alpha: 0.4);
        labelBg = AppColors.error;
        labelColor = Colors.white;
        trailType = 'x';
        trailing = MedQIcon(MedQIcons.xCircle, size: 20, color: AppColors.error);
      } else {
        bg = isDark ? Colors.white.withValues(alpha: 0.01) : Colors.black.withValues(alpha: 0.01);
        borderColor = isDark ? Colors.white.withValues(alpha: 0.03) : Colors.black.withValues(alpha: 0.03);
        labelBg = isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant;
        labelColor = isDark ? AppColors.darkTextTertiary : AppColors.textTertiary;
        opacity = 0.4;
      }
    } else if (isSelected) {
      bg = isDark ? AppColors.teal600.withValues(alpha: 0.08) : AppColors.teal600.withValues(alpha: 0.05);
      borderColor = AppColors.teal500.withValues(alpha: 0.5);
      labelBg = AppColors.teal600;
      labelColor = Colors.white;
    } else {
      bg = isDark ? AppColors.darkSurface : AppColors.surface;
      borderColor = isDark ? Colors.white.withValues(alpha: 0.06) : Colors.black.withValues(alpha: 0.05);
      labelBg = isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant;
      labelColor = ts;
    }

    return AnimatedOpacity(
      duration: const Duration(milliseconds: 300),
      opacity: opacity,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderColor, width: 1.5),
          boxShadow: isSelected && !isSubmitted
              ? [BoxShadow(color: AppColors.teal500.withValues(alpha: 0.12), blurRadius: 12, offset: const Offset(0, 2))]
              : null,
        ),
        child: Row(
          children: [
            // Letter badge
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: labelBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: trailType == 'check'
                    ? MedQIcon(MedQIcons.check, size: 16, color: labelColor)
                    : trailType == 'x'
                        ? MedQIcon(MedQIcons.x, size: 16, color: labelColor)
                        : Text(
                            index < _letters.length ? _letters[index] : '${index + 1}',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: labelColor),
                          ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                text.isNotEmpty ? text : 'Option ${index + 1}',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                  color: tx,
                  height: 1.4,
                ),
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: 8), trailing],
          ],
        ),
      ),
    );
  }
}

