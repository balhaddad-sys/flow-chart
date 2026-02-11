import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';

class OptionButton extends StatelessWidget {
  final int index;
  final String text;
  final bool isSelected;
  final bool? isCorrect;
  final bool hasSubmitted;
  final VoidCallback onTap;

  const OptionButton({
    super.key,
    required this.index,
    required this.text,
    required this.isSelected,
    this.isCorrect,
    required this.hasSubmitted,
    required this.onTap,
  });

  static const _optionLabels = ['A', 'B', 'C', 'D', 'E'];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Color borderColor;
    Color? bgColor;

    if (hasSubmitted) {
      if (isCorrect == true) {
        borderColor = AppColors.success;
        bgColor = AppColors.successLight.withValues(alpha: isDark ? 0.15 : 0.5);
      } else if (isSelected && isCorrect == false) {
        borderColor = AppColors.error;
        bgColor = AppColors.errorLight.withValues(alpha: isDark ? 0.15 : 0.5);
      } else {
        borderColor = isDark ? AppColors.darkBorder : AppColors.border;
        bgColor = null;
      }
    } else {
      borderColor = isSelected
          ? AppColors.primary
          : isDark
              ? AppColors.darkBorder
              : AppColors.border;
      bgColor = isSelected
          ? AppColors.primarySubtle.withValues(alpha: isDark ? 0.15 : 1.0)
          : null;
    }

    return InkWell(
      onTap: hasSubmitted ? null : onTap,
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: bgColor,
          border: Border.all(color: borderColor, width: isSelected ? 2 : 1),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        ),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected
                    ? borderColor
                    : isDark
                        ? AppColors.darkSurfaceVariant
                        : AppColors.surfaceVariant,
              ),
              child: Center(
                child: Text(
                  index < _optionLabels.length
                      ? _optionLabels[index]
                      : '${index + 1}',
                  style: TextStyle(
                    color: isSelected
                        ? Colors.white
                        : isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
              ),
            ),
            AppSpacing.hGapMd,
            Expanded(
              child: Text(
                text,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
            ),
            if (hasSubmitted && isCorrect == true)
              const Icon(Icons.check_circle, color: AppColors.success, size: 22),
            if (hasSubmitted && isSelected && isCorrect == false)
              const Icon(Icons.cancel, color: AppColors.error, size: 22),
          ],
        ),
      ),
    );
  }
}
