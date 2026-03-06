import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';

class OptionButton extends StatefulWidget {
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

  static const _optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  @override
  State<OptionButton> createState() => _OptionButtonState();
}

class _OptionButtonState extends State<OptionButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    );
    _scaleAnim = Tween<double>(begin: 1.0, end: 0.97).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleTap() {
    if (widget.hasSubmitted) return;
    HapticFeedback.selectionClick();
    _controller.forward().then((_) => _controller.reverse());
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final bool isThisCorrect = widget.hasSubmitted && widget.isCorrect == true;
    final bool isThisWrong =
        widget.hasSubmitted && widget.isSelected && widget.isCorrect == false;
    final bool isOtherWrong =
        widget.hasSubmitted && !widget.isSelected && widget.isCorrect != true;

    Color borderColor;
    Color? bgColor;
    Color labelBg;
    Color labelText;

    if (isThisCorrect) {
      borderColor = AppColors.success;
      bgColor = AppColors.success.withValues(alpha: isDark ? 0.12 : 0.08);
      labelBg = AppColors.success;
      labelText = Colors.white;
    } else if (isThisWrong) {
      borderColor = AppColors.error;
      bgColor = AppColors.error.withValues(alpha: isDark ? 0.12 : 0.08);
      labelBg = AppColors.error;
      labelText = Colors.white;
    } else if (widget.isSelected && !widget.hasSubmitted) {
      borderColor = AppColors.primary;
      bgColor = AppColors.primary.withValues(alpha: isDark ? 0.12 : 0.06);
      labelBg = AppColors.primary;
      labelText = Colors.white;
    } else {
      borderColor = isDark ? AppColors.darkBorder : AppColors.border;
      bgColor = isDark ? AppColors.darkSurface : AppColors.surface;
      labelBg =
          isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant;
      labelText =
          isDark ? AppColors.darkTextSecondary : AppColors.textSecondary;
    }

    final textOpacity = isOtherWrong ? 0.45 : 1.0;

    return ScaleTransition(
      scale: _scaleAnim,
      child: GestureDetector(
        onTap: _handleTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: bgColor,
            border: Border.all(
              color: borderColor,
              width: (widget.isSelected || isThisCorrect) ? 2 : 1,
            ),
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            boxShadow: widget.isSelected && !widget.hasSubmitted
                ? [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.15),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Row(
            children: [
              // Letter badge
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: labelBg,
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Center(
                  child: Text(
                    widget.index < OptionButton._optionLabels.length
                        ? OptionButton._optionLabels[widget.index]
                        : '${widget.index + 1}',
                    style: TextStyle(
                      color: labelText,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),

              // Option text
              Expanded(
                child: Opacity(
                  opacity: textOpacity,
                  child: Text(
                    widget.text.isNotEmpty
                        ? widget.text
                        : 'Option ${widget.index + 1}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontSize: 13,
                          fontWeight: widget.isSelected
                              ? FontWeight.w600
                              : FontWeight.w400,
                          decoration:
                              isThisWrong ? TextDecoration.lineThrough : null,
                          decorationColor:
                              AppColors.error.withValues(alpha: 0.5),
                          height: 1.35,
                        ),
                  ),
                ),
              ),

              // Result icon
              if (isThisCorrect)
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.check_rounded,
                      color: AppColors.success, size: 16),
                ),
              if (isThisWrong)
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: AppColors.error.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.close_rounded,
                      color: AppColors.error, size: 16),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
