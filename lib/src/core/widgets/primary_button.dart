// FILE: lib/src/core/widgets/primary_button.dart
import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_spacing.dart';

/// A versatile primary action button.
///
/// Parameters:
/// - [label]      Button text.
/// - [onPressed]  Callback; pass `null` to disable.
/// - [isLoading]  When true shows a spinner and disables interaction.
/// - [fullWidth]  When true (default) the button expands to fill its parent.
/// - [height]     Button height. Defaults to 48.
/// - [icon]       Optional leading icon; uses [ElevatedButton.icon] layout.
/// - [isOutlined] When true renders an outlined variant.
class PrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool fullWidth;
  final double height;
  final IconData? icon;
  final bool isOutlined;

  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.fullWidth = true,
    this.height = 52,
    this.icon,
    this.isOutlined = false,
  });

  bool get _enabled => onPressed != null && !isLoading;

  Widget _buildChild(BuildContext context) {
    if (isLoading) {
      return SizedBox(
        width: 20,
        height: 20,
        child: CircularProgressIndicator(
          strokeWidth: 2.2,
          valueColor: AlwaysStoppedAnimation<Color>(
            isOutlined ? AppColors.primary : Colors.white,
          ),
        ),
      );
    }
    if (icon != null) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18),
          AppSpacing.hGapSm,
          Text(
            label,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.15,
            ),
          ),
        ],
      );
    }
    return Text(
      label,
      style: const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.15,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
    );

    if (isOutlined) {
      return SizedBox(
        width: fullWidth ? double.infinity : null,
        height: height,
        child: OutlinedButton(
          onPressed: isLoading ? null : onPressed,
          style: OutlinedButton.styleFrom(
            backgroundColor: AppColors.primarySubtle.withValues(alpha: 0.35),
            foregroundColor: AppColors.primary,
            disabledForegroundColor: AppColors.primary.withValues(alpha: 0.45),
            side: BorderSide(
              color:
                  _enabled
                      ? AppColors.primary.withValues(alpha: 0.38)
                      : AppColors.border,
              width: 1.2,
            ),
            shape: shape,
            elevation: 0,
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          ),
          child: _buildChild(context),
        ),
      );
    }

    return SizedBox(
      width: fullWidth ? double.infinity : null,
      height: height,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient:
              _enabled
                  ? AppColors.primaryGradient
                  : LinearGradient(
                    colors: [
                      AppColors.primary.withValues(alpha: 0.55),
                      AppColors.accent.withValues(alpha: 0.45),
                    ],
                  ),
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          boxShadow: _enabled ? AppColors.primaryGradientShadow : null,
        ),
        child: ElevatedButton(
          onPressed: isLoading ? null : onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.transparent,
            foregroundColor: Colors.white,
            disabledBackgroundColor: Colors.transparent,
            disabledForegroundColor: Colors.white70,
            elevation: 0,
            shadowColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            shape: shape,
          ),
          child: _buildChild(context),
        ),
      ),
    );
  }
}
