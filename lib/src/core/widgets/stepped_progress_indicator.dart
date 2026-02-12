import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_spacing.dart';

/// A step in the processing pipeline.
class ProcessingStep {
  final String label;
  final String description;
  final IconData icon;

  const ProcessingStep({
    required this.label,
    required this.description,
    required this.icon,
  });
}

/// Displays an animated multi-step progress indicator for file processing.
///
/// Shows each step of the pipeline (Upload, Extract, Analyze, Generate)
/// with animated transitions between states.
class SteppedProgressIndicator extends StatelessWidget {
  final int currentStep;
  final int totalSteps;
  final List<ProcessingStep> steps;
  final bool hasError;
  final String? errorMessage;

  const SteppedProgressIndicator({
    super.key,
    required this.currentStep,
    required this.totalSteps,
    required this.steps,
    this.hasError = false,
    this.errorMessage,
  });

  /// Default file processing steps.
  static const List<ProcessingStep> fileProcessingSteps = [
    ProcessingStep(
      label: 'Uploading',
      description: 'Sending file to cloud',
      icon: Icons.cloud_upload_outlined,
    ),
    ProcessingStep(
      label: 'Extracting',
      description: 'Reading document content',
      icon: Icons.content_paste_search_rounded,
    ),
    ProcessingStep(
      label: 'Analyzing',
      description: 'AI generating blueprint',
      icon: Icons.auto_awesome_rounded,
    ),
    ProcessingStep(
      label: 'Generating',
      description: 'Creating practice questions',
      icon: Icons.quiz_outlined,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final progress = totalSteps > 0
        ? (currentStep / totalSteps).clamp(0.0, 1.0)
        : 0.0;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: hasError
              ? AppColors.error.withValues(alpha: 0.3)
              : AppColors.primary.withValues(alpha: isDark ? 0.2 : 0.15),
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Overall progress bar
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      hasError
                          ? 'Processing Failed'
                          : currentStep >= totalSteps
                              ? 'Processing Complete'
                              : 'Processing...',
                      style:
                          Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: hasError ? AppColors.error : null,
                              ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      hasError
                          ? (errorMessage ?? 'An error occurred')
                          : currentStep < steps.length
                              ? steps[currentStep].description
                              : 'All steps completed',
                      style:
                          Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: hasError
                                    ? AppColors.error
                                    : (isDark
                                        ? AppColors.darkTextTertiary
                                        : AppColors.textTertiary),
                              ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '${(progress * 100).round()}%',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: hasError ? AppColors.error : AppColors.primary,
                    ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Animated progress bar
          _AnimatedProgressBar(
            progress: progress,
            hasError: hasError,
            isDark: isDark,
          ),

          const SizedBox(height: 20),

          // Step indicators
          ...List.generate(steps.length, (index) {
            final step = steps[index];
            _StepState state;
            if (hasError && index == currentStep) {
              state = _StepState.error;
            } else if (index < currentStep) {
              state = _StepState.completed;
            } else if (index == currentStep) {
              state = _StepState.active;
            } else {
              state = _StepState.pending;
            }

            return _StepRow(
              step: step,
              state: state,
              isDark: isDark,
              isLast: index == steps.length - 1,
            );
          }),
        ],
      ),
    );
  }
}

class _AnimatedProgressBar extends StatelessWidget {
  final double progress;
  final bool hasError;
  final bool isDark;

  const _AnimatedProgressBar({
    required this.progress,
    required this.hasError,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: SizedBox(
        height: 8,
        child: Stack(
          children: [
            // Track
            Container(
              decoration: BoxDecoration(
                color: isDark
                    ? AppColors.darkSurfaceVariant
                    : AppColors.surfaceVariant,
              ),
            ),
            // Fill
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: progress),
              duration: AppSpacing.animNormal,
              curve: Curves.easeInOut,
              builder: (context, value, child) {
                return FractionallySizedBox(
                  widthFactor: value.clamp(0.0, 1.0),
                  alignment: Alignment.centerLeft,
                  child: child,
                );
              },
              child: Container(
                decoration: BoxDecoration(
                  gradient: hasError
                      ? AppColors.urgentGradient
                      : AppColors.primaryGradient,
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum _StepState { pending, active, completed, error }

class _StepRow extends StatelessWidget {
  final ProcessingStep step;
  final _StepState state;
  final bool isDark;
  final bool isLast;

  const _StepRow({
    required this.step,
    required this.state,
    required this.isDark,
    required this.isLast,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
      child: Row(
        children: [
          // Step circle
          _StepCircle(state: state, icon: step.icon, isDark: isDark),
          const SizedBox(width: 14),

          // Step label
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  step.label,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: state == _StepState.active ||
                                state == _StepState.completed
                            ? FontWeight.w600
                            : FontWeight.w400,
                        color: _labelColor(isDark),
                      ),
                ),
                if (state == _StepState.active) ...[
                  const SizedBox(height: 1),
                  Text(
                    step.description,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontSize: 11,
                          color: isDark
                              ? AppColors.darkTextTertiary
                              : AppColors.textTertiary,
                        ),
                  ),
                ],
              ],
            ),
          ),

          // Status text
          if (state == _StepState.completed)
            const Icon(Icons.check_circle_rounded,
                color: AppColors.success, size: 18)
          else if (state == _StepState.active)
            SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.primary,
                backgroundColor: AppColors.primary.withValues(alpha: 0.15),
              ),
            )
          else if (state == _StepState.error)
            const Icon(Icons.error_rounded,
                color: AppColors.error, size: 18),
        ],
      ),
    );
  }

  Color _labelColor(bool isDark) {
    switch (state) {
      case _StepState.completed:
        return AppColors.success;
      case _StepState.active:
        return AppColors.primary;
      case _StepState.error:
        return AppColors.error;
      case _StepState.pending:
        return isDark ? AppColors.darkTextTertiary : AppColors.textTertiary;
    }
  }
}

class _StepCircle extends StatelessWidget {
  final _StepState state;
  final IconData icon;
  final bool isDark;

  const _StepCircle({
    required this.state,
    required this.icon,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    Color bgColor;
    Color iconColor;

    switch (state) {
      case _StepState.completed:
        bgColor = AppColors.success.withValues(alpha: 0.12);
        iconColor = AppColors.success;
        break;
      case _StepState.active:
        bgColor = AppColors.primary.withValues(alpha: 0.12);
        iconColor = AppColors.primary;
        break;
      case _StepState.error:
        bgColor = AppColors.error.withValues(alpha: 0.12);
        iconColor = AppColors.error;
        break;
      case _StepState.pending:
        bgColor = isDark
            ? AppColors.darkSurfaceVariant
            : AppColors.surfaceVariant;
        iconColor =
            isDark ? AppColors.darkTextTertiary : AppColors.textTertiary;
        break;
    }

    return AnimatedContainer(
      duration: AppSpacing.animFast,
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, color: iconColor, size: 18),
    );
  }
}
