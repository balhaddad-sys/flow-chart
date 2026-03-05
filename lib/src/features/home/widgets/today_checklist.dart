import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../models/user_model.dart';
import '../../planner/widgets/task_row.dart';
import '../providers/home_provider.dart';

class TodayChecklist extends ConsumerWidget {
  final String courseId;

  const TodayChecklist({super.key, required this.courseId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasksAsync = ref.watch(todayTasksProvider(courseId));

    return tasksAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => _buildError(context, ref, e),
      data: (tasks) {
        if (tasks.isEmpty) {
          return _buildEmpty(context, ref);
        }

        final doneCount = tasks.where((t) => t.status == 'DONE').length;
        final allDone = doneCount == tasks.length;

        return Column(
          children: [
            // Progress header
            _ProgressHeader(
              done: doneCount,
              total: tasks.length,
            ),
            const SizedBox(height: 8),

            // Celebration or task list
            if (allDone)
              _CelebrationCard()
            else
              ...tasks.map(
                (task) => TaskRow(task: task, compact: true),
              ),
          ],
        );
      },
    );
  }

  Widget _buildError(BuildContext context, WidgetRef ref, Object e) {
    final errorStr = e.toString().toLowerCase();

    if (errorStr.contains('no_sections') ||
        errorStr.contains('no analyzed sections')) {
      return EmptyState(
        icon: Icons.upload_file_outlined,
        title: 'Get started',
        subtitle:
            'Upload your first study material to generate a personalized plan',
        actionLabel: 'Upload File',
        onAction: () => GoRouter.of(context).go('/library'),
      );
    }

    return EmptyState(
      icon: Icons.error_outline,
      title: 'Unable to load plan',
      subtitle: 'Please try again or check your connection',
      actionLabel: 'Retry',
      onAction: () => ref.invalidate(todayTasksProvider(courseId)),
    );
  }

  Widget _buildEmpty(BuildContext context, WidgetRef ref) {
    return EmptyState(
      icon: Icons.check_circle_outline,
      title: 'No tasks for today',
      subtitle: 'Generate a plan to get started',
      actionLabel: 'Generate Plan',
      onAction: () => _generatePlan(context, ref),
    );
  }

  Future<void> _generatePlan(BuildContext context, WidgetRef ref) async {
    try {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Generating study plan...')),
        );
      }
      final user = await ref.read(userModelProvider.future);
      final prefs = user?.preferences ?? const UserPreferences();
      final courses = ref.read(coursesProvider).valueOrNull ?? [];
      final course = courses.where((c) => c.id == courseId).firstOrNull;
      await ref.read(cloudFunctionsServiceProvider).generateSchedule(
            courseId: courseId,
            availability: <String, dynamic>{
              'defaultMinutesPerDay': prefs.dailyMinutesDefault,
              if (course != null &&
                  course.availability.perDayOverrides.isNotEmpty)
                'perDayOverrides': course.availability.perDayOverrides,
              if (course != null && course.availability.perDay.isNotEmpty)
                'perDay': course.availability.perDay,
              if (course != null &&
                  course.availability.excludedDates.isNotEmpty)
                'excludedDates': course.availability.excludedDates,
            },
            revisionPolicy: prefs.revisionPolicy,
          );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Plan generated!')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Progress header with gradient bar + motivational message
// ---------------------------------------------------------------------------
class _ProgressHeader extends StatelessWidget {
  final int done;
  final int total;

  const _ProgressHeader({required this.done, required this.total});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final pct = total > 0 ? done / total : 0.0;
    final message = _motivationalMessage(done, total);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 4),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        boxShadow: AppSpacing.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              Icon(
                Icons.today_rounded,
                size: 18,
                color: AppColors.primary,
              ),
              const SizedBox(width: 8),
              Text(
                "Today's Progress",
                style: TextStyle(
                  color: isDark
                      ? AppColors.darkTextPrimary
                      : AppColors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              Text(
                '$done/$total',
                style: TextStyle(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Gradient progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: pct),
              duration: AppSpacing.animSlow,
              curve: Curves.easeOutCubic,
              builder: (_, value, __) => Stack(
                children: [
                  // Track
                  Container(
                    height: 8,
                    decoration: BoxDecoration(
                      color: isDark
                          ? Colors.white.withValues(alpha: 0.08)
                          : AppColors.primary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                  // Fill
                  FractionallySizedBox(
                    widthFactor: value.clamp(0, 1),
                    child: Container(
                      height: 8,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppColors.primary,
                            AppColors.primary.withValues(alpha: 0.7),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(6),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),

          // Motivational message
          Text(
            message,
            style: TextStyle(
              color: isDark
                  ? AppColors.darkTextSecondary
                  : AppColors.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  String _motivationalMessage(int done, int total) {
    if (total == 0) return 'No tasks scheduled';
    final pct = done / total;
    if (pct >= 1.0) return 'All done for today!';
    if (pct >= 0.75) return 'Almost there! Just ${total - done} left';
    if (pct >= 0.5) return 'Halfway through! Keep it up';
    if (done > 0) return 'Good start! ${total - done} tasks remaining';
    return '$total tasks waiting. Let\'s begin!';
  }
}

// ---------------------------------------------------------------------------
// Celebration card when all tasks are done
// ---------------------------------------------------------------------------
class _CelebrationCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? [
                  AppColors.success.withValues(alpha: 0.15),
                  AppColors.primary.withValues(alpha: 0.08),
                ]
              : [
                  AppColors.success.withValues(alpha: 0.08),
                  AppColors.primary.withValues(alpha: 0.04),
                ],
        ),
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: AppColors.success.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.celebration_rounded,
              color: AppColors.success,
              size: 28,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'Great work today!',
            style: TextStyle(
              color: isDark
                  ? AppColors.darkTextPrimary
                  : AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'All tasks completed. Time to relax or review.',
            style: TextStyle(
              color: isDark
                  ? AppColors.darkTextSecondary
                  : AppColors.textSecondary,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}
