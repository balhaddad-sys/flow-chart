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
    Color borderColor;
    Color? bgColor;

    if (hasSubmitted) {
      if (isCorrect == true) {
        borderColor = AppColors.success;
        bgColor = AppColors.success.withValues(alpha: 0.08);
      } else if (isSelected && isCorrect == false) {
        borderColor = AppColors.error;
        bgColor = AppColors.error.withValues(alpha: 0.08);
      } else {
        borderColor = AppColors.border;
        bgColor = null;
      }
    } else {
      borderColor = isSelected ? AppColors.primary : AppColors.border;
      bgColor = isSelected ? AppColors.primary.withValues(alpha: 0.05) : null;
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
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected ? borderColor : AppColors.surfaceVariant,
              ),
              child: Center(
                child: Text(
                  index < _optionLabels.length
                      ? _optionLabels[index]
                      : '${index + 1}',
                  style: TextStyle(
                    color: isSelected ? Colors.white : AppColors.textSecondary,
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
              const Icon(Icons.check_circle, color: AppColors.success, size: 20),
            if (hasSubmitted && isSelected && isCorrect == false)
              const Icon(Icons.cancel, color: AppColors.error, size: 20),
          ],
        ),
      ),
    );
  }
}
