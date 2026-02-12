import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';

/// Displays animated processing indicator with phase message and progress.
///
/// Phases:
/// - EXTRACTING: Reading and parsing document
/// - ANALYZING: Generating AI blueprint
/// - GENERATING_QUESTIONS: Creating practice questions
class ProcessingIndicator extends StatefulWidget {
  final String? phase;
  final bool showLabel;
  final bool compact;

  const ProcessingIndicator({
    super.key,
    this.phase,
    this.showLabel = false,
    this.compact = false,
  });

  @override
  State<ProcessingIndicator> createState() => _ProcessingIndicatorState();
}

class _ProcessingIndicatorState extends State<ProcessingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  int get _currentStep {
    switch (widget.phase) {
      case 'EXTRACTING':
        return 0;
      case 'ANALYZING':
        return 1;
      case 'GENERATING_QUESTIONS':
        return 2;
      default:
        return 0;
    }
  }

  static const _phases = [
    _PhaseInfo('Extracting', Icons.content_paste_search_rounded, AppColors.info),
    _PhaseInfo('Analyzing', Icons.auto_awesome_rounded, AppColors.secondary),
    _PhaseInfo('Generating', Icons.quiz_outlined, AppColors.accent),
  ];

  String get _phaseLabel {
    if (_currentStep < _phases.length) {
      return '${_phases[_currentStep].label}...';
    }
    return 'Processing...';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (!widget.showLabel) {
      return const SizedBox(
        width: 20,
        height: 20,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: AppColors.primary,
        ),
      );
    }

    if (widget.compact) {
      return _buildCompact(context, isDark);
    }

    return _buildExpanded(context, isDark);
  }

  Widget _buildCompact(BuildContext context, bool isDark) {
    final phase = _currentStep < _phases.length ? _phases[_currentStep] : null;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: phase?.color ?? AppColors.primary,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          _phaseLabel,
          style: TextStyle(
            fontSize: 12,
            color: phase?.color ?? AppColors.textSecondary,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildExpanded(BuildContext context, bool isDark) {
    final totalSteps = _phases.length;
    final progress = ((_currentStep + 0.5) / totalSteps).clamp(0.0, 1.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Progress bar with step dots
        Row(
          children: [
            Expanded(
              child: _SteppedProgressBar(
                progress: progress,
                totalSteps: totalSteps,
                currentStep: _currentStep,
                isDark: isDark,
              ),
            ),
            const SizedBox(width: 10),
            AnimatedBuilder(
              animation: _pulseController,
              builder: (context, child) {
                return Opacity(
                  opacity: 0.5 + (_pulseController.value * 0.5),
                  child: Text(
                    '${(_currentStep + 1)}/$totalSteps',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                  ),
                );
              },
            ),
          ],
        ),
        const SizedBox(height: 10),

        // Phase chips
        Row(
          children: List.generate(_phases.length, (i) {
            final phase = _phases[i];
            final isActive = i == _currentStep;
            final isComplete = i < _currentStep;

            return Expanded(
              child: Padding(
                padding: EdgeInsets.only(right: i < _phases.length - 1 ? 4 : 0),
                child: _PhaseChip(
                  label: phase.label,
                  icon: phase.icon,
                  color: phase.color,
                  isActive: isActive,
                  isComplete: isComplete,
                  isDark: isDark,
                ),
              ),
            );
          }),
        ),
      ],
    );
  }
}

class _PhaseInfo {
  final String label;
  final IconData icon;
  final Color color;

  const _PhaseInfo(this.label, this.icon, this.color);
}

class _SteppedProgressBar extends StatelessWidget {
  final double progress;
  final int totalSteps;
  final int currentStep;
  final bool isDark;

  const _SteppedProgressBar({
    required this.progress,
    required this.totalSteps,
    required this.currentStep,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 6,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(3),
        child: Stack(
          children: [
            Container(
              color: isDark
                  ? AppColors.darkSurfaceVariant
                  : AppColors.surfaceVariant,
            ),
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
                  gradient: AppColors.primaryGradient,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PhaseChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final bool isActive;
  final bool isComplete;
  final bool isDark;

  const _PhaseChip({
    required this.label,
    required this.icon,
    required this.color,
    required this.isActive,
    required this.isComplete,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: AppSpacing.animFast,
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 6),
      decoration: BoxDecoration(
        color: isActive
            ? color.withValues(alpha: 0.1)
            : isComplete
                ? AppColors.success.withValues(alpha: 0.06)
                : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isActive
              ? color.withValues(alpha: 0.3)
              : isComplete
                  ? AppColors.success.withValues(alpha: 0.2)
                  : (isDark
                      ? AppColors.darkBorder.withValues(alpha: 0.3)
                      : AppColors.border.withValues(alpha: 0.3)),
          width: isActive ? 1.5 : 1,
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isComplete ? Icons.check_circle_rounded : icon,
            size: 13,
            color: isComplete
                ? AppColors.success
                : isActive
                    ? color
                    : (isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary),
          ),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                color: isComplete
                    ? AppColors.success
                    : isActive
                        ? color
                        : (isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary),
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
