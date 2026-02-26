import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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

    final hasFiles =
        filesAsync.valueOrNull?.isNotEmpty ?? false;
    final hasSections = sectionsAsync.valueOrNull
            ?.any((s) => s.aiStatus == 'ANALYZED') ??
        false;
    final tasks = tasksAsync.valueOrNull ?? [];
    final stats = statsAsync.valueOrNull;
    final hasPlan =
        tasks.isNotEmpty || (stats?.completionPercent ?? 0) > 0;
    final hasQuizAttempts = (stats?.totalQuestionsAnswered ?? 0) > 0;

    final activeStep = _getActiveStep(
        hasFiles, hasSections, hasPlan, hasQuizAttempts);

    // Hide once all steps are complete
    if (activeStep >= _steps.length) return const SizedBox.shrink();

    final progressPercent =
        ((activeStep / _steps.length) * 100).round();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Progress bar at top ──────────────────────────────────
          Stack(
            children: [
              Container(
                height: 4,
                color: isDark
                    ? AppColors.darkBorder
                    : AppColors.border,
              ),
              FractionallySizedBox(
                widthFactor: progressPercent / 100,
                child: Container(
                  height: 4,
                  decoration: const BoxDecoration(
                    gradient: AppColors.primaryGradient,
                  ),
                ),
              ),
            ],
          ),

          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Header row ──────────────────────────────────────
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Getting Started',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                          ),
                          const SizedBox(height: 1),
                          Text(
                            'Step ${activeStep + 1} of ${_steps.length} — '
                            '${_steps[activeStep].description}',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                  color: isDark
                                      ? AppColors.darkTextSecondary
                                      : AppColors.textSecondary,
                                  fontSize: 11,
                                ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: AppColors.primary
                            .withValues(alpha: 0.10),
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          '$progressPercent%',
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // ── Step chips ──────────────────────────────────────
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: List.generate(_steps.length * 2 - 1,
                        (index) {
                      if (index.isOdd) {
                        final stepIndex = (index - 1) ~/ 2;
                        final isDone = stepIndex < activeStep;
                        return Container(
                          width: 16,
                          height: 1,
                          color: isDone
                              ? const Color(0xFF6EE7B7)
                              : (isDark
                                  ? AppColors.darkBorder
                                  : AppColors.border),
                        );
                      }
                      final stepIndex = index ~/ 2;
                      final step = _steps[stepIndex];
                      final isComplete = stepIndex < activeStep;
                      final isCurrent = stepIndex == activeStep;

                      Color bg;
                      Color fg;
                      if (isComplete) {
                        bg = isDark
                            ? const Color(0xFF065F46)
                                .withValues(alpha: 0.5)
                            : const Color(0xFFD1FAE5);
                        fg = isDark
                            ? const Color(0xFF34D399)
                            : const Color(0xFF059669);
                      } else if (isCurrent) {
                        bg = AppColors.primary;
                        fg = Colors.white;
                      } else {
                        bg = isDark
                            ? AppColors.darkSurfaceVariant
                            : const Color(0xFFF5F5F4);
                        fg = isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary;
                      }

                      return GestureDetector(
                        onTap: () => context.go(step.route),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: bg,
                            borderRadius:
                                BorderRadius.circular(6),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                isComplete
                                    ? Icons.check_rounded
                                    : step.icon,
                                size: 12,
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
                    }),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  int _getActiveStep(bool hasFiles, bool hasSections, bool hasPlan,
      bool hasQuizAttempts) {
    if (!hasFiles) return 0;
    if (!hasSections) return 1;
    if (!hasPlan) return 2;
    if (!hasQuizAttempts) return 3;
    return 5; // done
  }
}

class _Step {
  final String label;
  final String description;
  final IconData icon;
  final String route;

  const _Step({
    required this.label,
    required this.description,
    required this.icon,
    required this.route,
  });
}

const _steps = [
  _Step(
    label: 'Upload',
    description: 'Add study materials',
    icon: Icons.upload_file_rounded,
    route: '/library',
  ),
  _Step(
    label: 'Process',
    description: 'AI analyses content',
    icon: Icons.memory_rounded,
    route: '/library',
  ),
  _Step(
    label: 'Plan',
    description: 'Generate your schedule',
    icon: Icons.calendar_month_rounded,
    route: '/planner',
  ),
  _Step(
    label: 'Study',
    description: 'Work through sessions',
    icon: Icons.menu_book_rounded,
    route: '/planner',
  ),
  _Step(
    label: 'Quiz',
    description: 'Test your knowledge',
    icon: Icons.help_outline_rounded,
    route: '/practice',
  ),
];
