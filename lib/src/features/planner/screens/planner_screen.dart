import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/utils/date_utils.dart';
import '../../../core/utils/error_handler.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../models/task_model.dart';
import '../../home/providers/home_provider.dart';
import '../../practice/providers/practice_provider.dart';
import '../providers/planner_provider.dart';
import '../widgets/task_row.dart';

class PlannerScreen extends ConsumerStatefulWidget {
  const PlannerScreen({super.key});

  @override
  ConsumerState<PlannerScreen> createState() => _PlannerScreenState();
}

class _PlannerScreenState extends ConsumerState<PlannerScreen> {
  bool _autoGenTriggered = false;
  String? _autoGenCourseId;

  @override
  Widget build(BuildContext context) {
    var activeCourseId = ref.watch(activeCourseIdProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (activeCourseId == null) {
      final courses = ref.watch(coursesProvider).valueOrNull ?? [];
      if (courses.isNotEmpty) {
        activeCourseId = courses.first.id;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          ref.read(activeCourseIdProvider.notifier).state = activeCourseId;
        });
      }
    }

    if (activeCourseId == null) {
      return const Scaffold(
        body: EmptyState(
          icon: Icons.calendar_today,
          title: 'No course selected',
          subtitle: 'Select a course to view the plan',
        ),
      );
    }

    final String courseId = activeCourseId;

    // Reset auto-gen flag when the active course changes
    if (_autoGenCourseId != courseId) {
      _autoGenCourseId = courseId;
      _autoGenTriggered = false;
    }

    final tasksAsync = ref.watch(allTasksProvider(courseId));
    final sectionsAsync = ref.watch(courseSectionsProvider(courseId));
    final actionsState = ref.watch(plannerActionsProvider);

    ref.listen<AsyncValue<void>>(plannerActionsProvider, (prev, next) {
      next.whenOrNull(
        error: (e, _) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(ErrorHandler.userMessage(e))),
            );
          }
        },
        data: (_) {
          if (prev is AsyncLoading && context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Schedule updated'),
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        },
      );
    });

    // Auto-generate when sections are analysed but no tasks exist yet
    final sections = sectionsAsync.valueOrNull ?? [];
    final analyzedCount =
        sections.where((s) => s.aiStatus == 'ANALYZED').length;
    final pendingCount = sections
        .where((s) => s.aiStatus == 'PENDING' || s.aiStatus == 'PROCESSING')
        .length;

    tasksAsync.whenData((tasks) {
      if (!_autoGenTriggered &&
          tasks.isEmpty &&
          analyzedCount > 0 &&
          pendingCount == 0 &&
          actionsState is! AsyncLoading) {
        _autoGenTriggered = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          ref
              .read(plannerActionsProvider.notifier)
              .generateSchedule(courseId);
        });
      }
    });

    final tasks = tasksAsync.valueOrNull ?? [];
    final isLoading = actionsState is AsyncLoading;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ─────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Row(
                children: [
                  Flexible(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Study Plan',
                          style:
                              Theme.of(context).textTheme.headlineMedium?.copyWith(
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: -0.5,
                                  ),
                        ),
                        Text(
                          'Generate and track your daily roadmap',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: isDark
                                    ? AppColors.darkTextSecondary
                                    : AppColors.textSecondary,
                              ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  if (tasks.isEmpty)
                    ElevatedButton.icon(
                      onPressed: isLoading
                          ? null
                          : () => ref
                              .read(plannerActionsProvider.notifier)
                              .generateSchedule(courseId),
                      icon: isLoading
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 1.5,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.add_rounded, size: 16),
                      label:
                          Text(isLoading ? 'Generating...' : 'Generate Plan'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        minimumSize: Size.zero,
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppSpacing.radiusMd),
                        ),
                        textStyle: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    )
                  else
                    Material(
                      color: isDark
                          ? AppColors.darkSurfaceVariant
                          : AppColors.surfaceVariant,
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusMd),
                      child: InkWell(
                        borderRadius:
                            BorderRadius.circular(AppSpacing.radiusMd),
                        onTap: isLoading
                            ? null
                            : () => ref
                                .read(plannerActionsProvider.notifier)
                                .regenSchedule(courseId),
                        child: Padding(
                          padding: const EdgeInsets.all(AppSpacing.sm),
                          child: isLoading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2),
                                )
                              : Icon(
                                  Icons.refresh_rounded,
                                  size: 20,
                                  color: isDark
                                      ? AppColors.darkTextSecondary
                                      : AppColors.textSecondary,
                                ),
                        ),
                      ),
                    ),
                ],
              ),
            ),

            // ── Content ─────────────────────────────────────────────
            Expanded(
              child: tasksAsync.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => EmptyState(
                  icon: Icons.error_outline,
                  title: 'Something went wrong',
                  subtitle: ErrorHandler.userMessage(e),
                  actionLabel: 'Retry',
                  onAction: () => ref.invalidate(allTasksProvider(courseId)),
                ),
                data: (tasks) {
                  if (tasks.isEmpty) {
                    final actionError = actionsState.asError;
                    final errorMsg = actionError != null
                        ? ErrorHandler.userMessage(actionError.error)
                        : null;
                    final hasError = errorMsg != null;

                    // Determine contextual subtitle
                    String subtitle;
                    if (isLoading) {
                      subtitle = 'This usually takes a few seconds.';
                    } else if (hasError) {
                      subtitle = errorMsg!;
                    } else if (sections.isEmpty) {
                      subtitle =
                          'Upload materials first, then generate a study plan.';
                    } else if (analyzedCount == 0 && pendingCount > 0) {
                      subtitle =
                          'Your files are still being analysed ($pendingCount remaining). '
                          'The plan will generate automatically when ready.';
                    } else if (analyzedCount == 0) {
                      final failedCount = sections
                          .where((s) => s.aiStatus == 'FAILED')
                          .length;
                      subtitle = failedCount > 0
                          ? '$failedCount section(s) failed analysis. '
                              'Try re-uploading your files from the Library.'
                          : 'No analysed sections found. Upload and process files first.';
                    } else {
                      subtitle = 'Tap Generate Plan to create your study schedule.';
                    }

                    return EmptyState(
                      icon: hasError
                          ? Icons.error_outline
                          : Icons.calendar_today,
                      title: isLoading
                          ? 'Generating your plan…'
                          : 'No plan generated yet',
                      subtitle: subtitle,
                      actionLabel: isLoading
                          ? null
                          : analyzedCount > 0
                              ? 'Generate Plan'
                              : null,
                      onAction: isLoading || analyzedCount == 0
                          ? null
                          : () => ref
                              .read(plannerActionsProvider.notifier)
                              .generateSchedule(courseId),
                    );
                  }

                  return _PlanContent(
                    tasks: tasks,
                    courseId: courseId,
                    isDark: isDark,
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Plan Content ─────────────────────────────────────────────────────────────

class _PlanContent extends ConsumerWidget {
  final List<TaskModel> tasks;
  final String courseId;
  final bool isDark;

  const _PlanContent({
    required this.tasks,
    required this.courseId,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final doneCount = tasks.where((t) => t.status == 'DONE').length;
    final pct = tasks.isNotEmpty ? doneCount / tasks.length : 0.0;
    final studyCount = tasks.where((t) => t.type == 'STUDY').length;
    final quizCount = tasks.where((t) => t.type == 'QUESTIONS').length;
    final reviewCount = tasks.where((t) => t.type == 'REVIEW').length;
    final totalMinutes = tasks.fold<int>(0, (sum, t) => sum + t.estMinutes);

    final grouped = ref.watch(groupedTasksProvider(tasks));
    final now = DateTime.now();
    final todayKey = DateTime(now.year, now.month, now.day);

    final entries = grouped.entries.toList();

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      itemCount: entries.length + 1, // +1 for summary card
      itemBuilder: (context, i) {
        if (i == 0) {
          return _SummaryCard(
            pct: pct,
            doneCount: doneCount,
            totalCount: tasks.length,
            studyCount: studyCount,
            quizCount: quizCount,
            reviewCount: reviewCount,
            totalMinutes: totalMinutes,
            isDark: isDark,
          );
        }

        final entry = entries[i - 1];
        final date = entry.key;
        final dayTasks = entry.value;
        final isToday = date == todayKey;
        final completedCount =
            dayTasks.where((t) => t.status == 'DONE').length;
        final dayMinutes =
            dayTasks.fold<int>(0, (sum, t) => sum + t.estMinutes);

        return _DayGroup(
          date: date,
          tasks: dayTasks,
          isToday: isToday,
          isDark: isDark,
          completedCount: completedCount,
          totalMinutes: dayMinutes,
        );
      },
    );
  }
}

// ── Summary Card ─────────────────────────────────────────────────────────────

class _SummaryCard extends StatelessWidget {
  final double pct;
  final int doneCount;
  final int totalCount;
  final int studyCount;
  final int quizCount;
  final int reviewCount;
  final int totalMinutes;
  final bool isDark;

  const _SummaryCard({
    required this.pct,
    required this.doneCount,
    required this.totalCount,
    required this.studyCount,
    required this.quizCount,
    required this.reviewCount,
    required this.totalMinutes,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final pctInt = (pct * 100).round();

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
      ),
      child: Column(
        children: [
          // Progress row
          Row(
            children: [
              // Circular progress
              SizedBox(
                width: 52,
                height: 52,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CircularProgressIndicator(
                      value: pct,
                      strokeWidth: 5,
                      backgroundColor: isDark
                          ? AppColors.darkBorder
                          : const Color(0xFFE5E7EB),
                      color: AppColors.primary,
                    ),
                    Center(
                      child: Text(
                        '$pctInt%',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    RichText(
                      text: TextSpan(
                        style: Theme.of(context).textTheme.bodyMedium,
                        children: [
                          TextSpan(
                            text: '$doneCount',
                            style: const TextStyle(
                                fontWeight: FontWeight.w700),
                          ),
                          const TextSpan(text: ' of '),
                          TextSpan(
                            text: '$totalCount',
                            style: const TextStyle(
                                fontWeight: FontWeight.w700),
                          ),
                          const TextSpan(text: ' tasks done'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '~${(totalMinutes / 60).round()}h total study time',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: isDark
                                ? AppColors.darkTextTertiary
                                : AppColors.textTertiary,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Task type breakdown
          Row(
            children: [
              _TypeChip(
                icon: Icons.menu_book_rounded,
                count: studyCount,
                label: 'study',
                color: AppColors.primary,
              ),
              const SizedBox(width: 16),
              _TypeChip(
                icon: Icons.quiz_rounded,
                count: quizCount,
                label: 'quiz',
                color: AppColors.secondary,
              ),
              const SizedBox(width: 16),
              _TypeChip(
                icon: Icons.refresh_rounded,
                count: reviewCount,
                label: 'review',
                color: AppColors.warning,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TypeChip extends StatelessWidget {
  final IconData icon;
  final int count;
  final String label;
  final Color color;

  const _TypeChip({
    required this.icon,
    required this.count,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(
          '$count $label',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).brightness == Brightness.dark
                    ? AppColors.darkTextSecondary
                    : AppColors.textSecondary,
              ),
        ),
      ],
    );
  }
}

// ── Day Group ────────────────────────────────────────────────────────────────

class _DayGroup extends StatelessWidget {
  final DateTime date;
  final List<TaskModel> tasks;
  final bool isToday;
  final bool isDark;
  final int completedCount;
  final int totalMinutes;

  const _DayGroup({
    required this.date,
    required this.tasks,
    required this.isToday,
    required this.isDark,
    required this.completedCount,
    required this.totalMinutes,
  });

  @override
  Widget build(BuildContext context) {
    final label = AppDateUtils.relativeDay(date);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: isToday
              ? AppColors.primary.withValues(alpha: 0.25)
              : (isDark ? AppColors.darkBorder : AppColors.border),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Day header ────────────────────────────────────────
            Row(
              children: [
                Flexible(
                  child: Text(
                    label,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
                const SizedBox(width: 8),
                if (isToday)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${tasks.length}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  )
                else
                  Text(
                    '${tasks.length}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: isDark
                              ? AppColors.darkTextTertiary
                              : AppColors.textTertiary,
                        ),
                  ),
                const Spacer(),
                Text(
                  AppDateUtils.formatDuration(totalMinutes),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary,
                      ),
                ),
                const SizedBox(width: 8),
                Text(
                  '$completedCount/${tasks.length}',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            // ── Tasks ─────────────────────────────────────────────
            ...tasks.map((task) => TaskRow(task: task)),
          ],
        ),
      ),
    );
  }
}
