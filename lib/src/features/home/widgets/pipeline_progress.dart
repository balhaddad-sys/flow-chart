// FILE: lib/src/features/home/widgets/pipeline_progress.dart

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../library/providers/library_provider.dart';
import '../../practice/providers/practice_provider.dart';
import '../providers/home_provider.dart';

class PipelineProgress extends ConsumerWidget {
  final String courseId;

  const PipelineProgress({super.key, required this.courseId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filesAsync = ref.watch(filesProvider(courseId));
    final sectionsAsync = ref.watch(courseSectionsProvider(courseId));
    final tasksAsync = ref.watch(todayTasksProvider(courseId));
    final statsAsync = ref.watch(courseStatsProvider(courseId));

    final files = filesAsync.valueOrNull ?? [];
    final sections = sectionsAsync.valueOrNull ?? [];
    final tasks = tasksAsync.valueOrNull ?? [];
    final stats = statsAsync.valueOrNull;

    final hasFiles = files.isNotEmpty;
    final analyzedSections =
        sections.where((s) => s.aiStatus == 'ANALYZED').length;
    final totalSections = sections.length;
    final hasSections = analyzedSections > 0;
    final hasPlan = tasks.isNotEmpty || (stats?.completionPercent ?? 0) > 0;
    final hasQuizAttempts = (stats?.totalQuestionsAnswered ?? 0) > 0;

    // Determine if any processing is actively happening
    final hasProcessingFiles = files.any(
      (f) => f.status == 'PROCESSING' || f.status == 'UPLOADED',
    );
    final hasAnalyzingSections = sections.any(
      (s) => s.aiStatus == 'PROCESSING' || s.questionsStatus == 'GENERATING',
    );

    // Only show this widget when there's active processing to report
    final activeStep =
        _getActiveStep(hasFiles, hasSections, hasPlan, hasQuizAttempts);
    final isProcessing = hasProcessingFiles || hasAnalyzingSections;

    // Hide if all steps done and no active processing
    if (activeStep >= _steps.length && !isProcessing) {
      return const SizedBox.shrink();
    }
    // Also hide if no files at all (empty state handled elsewhere)
    if (!hasFiles && !hasProcessingFiles) {
      return const SizedBox.shrink();
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final progressPercent =
        ((activeStep.clamp(0, _steps.length) / _steps.length) * 100).round();

    // Build a human-readable status message
    final String statusText;
    if (hasProcessingFiles) {
      final processingCount = files
          .where((f) => f.status == 'PROCESSING' || f.status == 'UPLOADED')
          .length;
      statusText = 'Processing $processingCount file${processingCount == 1 ? '' : 's'}...';
    } else if (hasAnalyzingSections) {
      statusText = '$analyzedSections of $totalSections sections analysed';
    } else if (activeStep < _steps.length) {
      statusText = _steps[activeStep.clamp(0, _steps.length - 1)].description;
    } else {
      statusText = 'All materials ready';
    }

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark
              ? AppColors.primary.withValues(alpha: 0.20)
              : AppColors.primary.withValues(alpha: 0.15),
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Thin teal progress bar at the top
          _AnimatedProgressBar(
            progress: progressPercent / 100,
            isDark: isDark,
            isIndeterminate: isProcessing,
          ),

          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Animated processing indicator or check icon
                SizedBox(
                  width: 36,
                  height: 36,
                  child: isProcessing
                      ? Stack(
                          alignment: Alignment.center,
                          children: [
                            Container(
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.10),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        )
                      : Container(
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.10),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.memory_rounded,
                            color: AppColors.primary,
                            size: 18,
                          ),
                        ),
                ),
                const SizedBox(width: 12),

                // Title + status
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isProcessing
                            ? 'Processing your materials'
                            : 'Getting Started',
                        style:
                            Theme.of(context).textTheme.bodySmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        statusText,
                        style:
                            Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: isDark
                                      ? AppColors.darkTextSecondary
                                      : AppColors.textSecondary,
                                  fontSize: 11,
                                ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),

                // Progress percent badge
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.10),
                    borderRadius:
                        BorderRadius.circular(AppSpacing.radiusFull),
                  ),
                  child: Text(
                    '$progressPercent%',
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Step pills (scrollable)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _buildStepPills(context, activeStep, isDark),
              ),
            ),
          ),

          // "Running in background" helper text
          if (isProcessing)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    size: 12,
                    color: isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary,
                  ),
                  const SizedBox(width: 5),
                  Text(
                    'Running in background — you can keep studying',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: isDark
                              ? AppColors.darkTextTertiary
                              : AppColors.textTertiary,
                          fontSize: 11,
                        ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  List<Widget> _buildStepPills(
    BuildContext context,
    int activeStep,
    bool isDark,
  ) {
    final widgets = <Widget>[];
    for (var i = 0; i < _steps.length; i++) {
      if (i > 0) {
        // connector line
        widgets.add(
          Container(
            width: 16,
            height: 1,
            color: i < activeStep
                ? const Color(0xFF6EE7B7)
                : (isDark ? AppColors.darkBorder : AppColors.border),
          ),
        );
      }

      final step = _steps[i];
      final isComplete = i < activeStep;
      final isCurrent = i == activeStep;

      final Color bg;
      final Color fg;
      if (isComplete) {
        bg = isDark
            ? const Color(0xFF065F46).withValues(alpha: 0.5)
            : const Color(0xFFD1FAE5);
        fg = isDark ? const Color(0xFF34D399) : const Color(0xFF059669);
      } else if (isCurrent) {
        bg = AppColors.primary;
        fg = Colors.white;
      } else {
        bg = isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant;
        fg = isDark ? AppColors.darkTextSecondary : AppColors.textSecondary;
      }

      widgets.add(
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                isComplete ? Icons.check_rounded : step.icon,
                size: 11,
                color: fg,
              ),
              const SizedBox(width: 4),
              Text(
                step.label,
                style: TextStyle(
                  color: fg,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      );
    }
    return widgets;
  }

  int _getActiveStep(
    bool hasFiles,
    bool hasSections,
    bool hasPlan,
    bool hasQuizAttempts,
  ) {
    if (!hasFiles) return 0;
    if (!hasSections) return 1;
    if (!hasPlan) return 2;
    if (!hasQuizAttempts) return 3;
    return _steps.length; // all done
  }
}

// ── Animated progress bar ─────────────────────────────────────────────────────

class _AnimatedProgressBar extends StatelessWidget {
  final double progress; // 0.0 to 1.0
  final bool isDark;
  final bool isIndeterminate;

  const _AnimatedProgressBar({
    required this.progress,
    required this.isDark,
    required this.isIndeterminate,
  });

  @override
  Widget build(BuildContext context) {
    if (isIndeterminate) {
      return LinearProgressIndicator(
        minHeight: 3,
        backgroundColor:
            isDark ? AppColors.darkBorder : AppColors.border,
        valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
      );
    }

    return Stack(
      children: [
        Container(
          height: 3,
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        FractionallySizedBox(
          widthFactor: progress.clamp(0.0, 1.0),
          child: Container(
            height: 3,
            decoration: const BoxDecoration(
              gradient: AppColors.primaryGradient,
            ),
          ),
        ),
      ],
    );
  }
}

// ── Step definitions ──────────────────────────────────────────────────────────

class _Step {
  final String label;
  final String description;
  final IconData icon;

  const _Step({
    required this.label,
    required this.description,
    required this.icon,
  });
}

const _steps = [
  _Step(
    label: 'Upload',
    description: 'Add study materials',
    icon: Icons.upload_file_rounded,
  ),
  _Step(
    label: 'Process',
    description: 'AI analyses your content',
    icon: Icons.memory_rounded,
  ),
  _Step(
    label: 'Plan',
    description: 'Generate your schedule',
    icon: Icons.calendar_month_rounded,
  ),
  _Step(
    label: 'Study',
    description: 'Work through sessions',
    icon: Icons.menu_book_rounded,
  ),
  _Step(
    label: 'Quiz',
    description: 'Test your knowledge',
    icon: Icons.help_outline_rounded,
  ),
];
