import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';

class OptionButton extends StatelessWidget {
  final int index;
  final String text;
  final bool isSelected;
  final bool hasSubmitted;
  final bool isCorrect;
  final VoidCallback? onTap;

  const OptionButton({
    super.key,
    required this.index,
    required this.text,
    required this.isSelected,
    required this.hasSubmitted,
    required this.isCorrect,
    this.onTap,
  });

  static const _labels = ['A', 'B', 'C', 'D', 'E'];

  @override
  Widget build(BuildContext context) {
    Color borderColor;
    Color bgColor;
    Color labelBg;
    Color labelColor;
    IconData? trailingIcon;
    Color? trailingColor;

    if (hasSubmitted) {
      if (isCorrect) {
        borderColor = AppColors.success;
        bgColor = AppColors.successSurface;
        labelBg = AppColors.success;
        labelColor = Colors.white;
        trailingIcon = Icons.check_circle_rounded;
        trailingColor = AppColors.success;
      } else if (isSelected) {
        borderColor = AppColors.error;
        bgColor = AppColors.errorSurface;
        labelBg = AppColors.error;
        labelColor = Colors.white;
        trailingIcon = Icons.cancel_rounded;
        trailingColor = AppColors.error;
      } else {
        borderColor = AppColors.border;
        bgColor = AppColors.surface;
        labelBg = AppColors.surfaceVariant;
        labelColor = AppColors.textTertiary;
      }
    } else if (isSelected) {
      borderColor = AppColors.primary;
      bgColor = AppColors.primarySurface;
      labelBg = AppColors.primary;
      labelColor = Colors.white;
    } else {
      borderColor = AppColors.border;
      bgColor = AppColors.surface;
      labelBg = AppColors.surfaceVariant;
      labelColor = AppColors.textSecondary;
    }

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(color: borderColor, width: 1.5),
        ),
        child: Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: labelBg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(
                child: Text(
                  index < _labels.length ? _labels[index] : '${index + 1}',
                  style: TextStyle(
                    color: labelColor,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
            ),
            AppSpacing.hGapMd,
            Expanded(
              child: Text(
                text,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight:
                          isSelected ? FontWeight.w500 : FontWeight.w400,
                    ),
              ),
            ),
            if (trailingIcon != null)
              Icon(trailingIcon, color: trailingColor, size: 22),
          ],
        ),
      ),
    );
  }
}
