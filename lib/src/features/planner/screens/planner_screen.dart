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
import '../widgets/calendar_strip.dart';
import '../widgets/summary_dashboard.dart';
import '../widgets/task_row.dart';

class PlannerScreen extends ConsumerStatefulWidget {
  const PlannerScreen({super.key});

  @override
  ConsumerState<PlannerScreen> createState() => _PlannerScreenState();
}

class _PlannerScreenState extends ConsumerState<PlannerScreen> {
  bool _autoGenTriggered = false;
  String? _autoGenCourseId;
  DateTime _focusedDay = DateTime.now();

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

    if (_autoGenCourseId != courseId) {
      _autoGenCourseId = courseId;
      _autoGenTriggered = false;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          ref.read(plannerActionsProvider.notifier).reset();
        }
      });
    }

    final tasksAsync = ref.watch(allTasksProvider(courseId));
    final sectionsAsync = ref.watch(courseSectionsProvider(courseId));
    final actionsState = ref.watch(plannerActionsProvider);

    ref.listen<AsyncValue<void>>(plannerActionsProvider, (prev, next) {
      next.whenOrNull(
        error: (e, _) {
          _autoGenTriggered = false;
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
          actionsState is! AsyncLoading &&
          actionsState is! AsyncError) {
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
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            _PlannerHeader(
              tasks: tasks,
              isLoading: isLoading,
              isDark: isDark,
              courseId: courseId,
            ),

            // Calendar strip (only when tasks exist)
            if (tasks.isNotEmpty)
              CalendarStrip(
                focusedDay: _focusedDay,
                selectedDay: ref.watch(selectedDateProvider),
                taskDensity: ref.watch(taskDensityProvider(tasks)),
                onDaySelected: (date) {
                  ref.read(selectedDateProvider.notifier).state = date;
                  setState(() => _focusedDay = date);
                },
              ),

            // Content
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
                    return _buildEmptyState(
                      context,
                      courseId,
                      isLoading,
                      actionsState,
                      sections.length,
                      analyzedCount,
                      pendingCount,
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
      // FAB for actions
      floatingActionButton: tasks.isNotEmpty
          ? _PlannerFab(courseId: courseId, tasks: tasks, isLoading: isLoading)
          : null,
    );
  }

  Widget _buildEmptyState(
    BuildContext context,
    String courseId,
    bool isLoading,
    AsyncValue<void> actionsState,
    int sectionCount,
    int analyzedCount,
    int pendingCount,
  ) {
    final actionError = actionsState.asError;
    final errorMsg = actionError != null
        ? ErrorHandler.userMessage(actionError.error)
        : null;
    final hasError = errorMsg != null;

    String subtitle;
    if (isLoading) {
      subtitle = 'This usually takes a few seconds.';
    } else if (hasError) {
      subtitle = errorMsg;
    } else if (sectionCount == 0) {
      subtitle = 'Upload materials first, then generate a study plan.';
    } else if (analyzedCount == 0 && pendingCount > 0) {
      subtitle =
          'Your files are still being analysed ($pendingCount remaining). '
          'The plan will generate automatically when ready.';
    } else if (analyzedCount == 0) {
      subtitle = 'No analysed sections found. Upload and process files first.';
    } else {
      subtitle = 'Tap Generate Plan to create your study schedule.';
    }

    return EmptyState(
      icon: hasError ? Icons.error_outline : Icons.calendar_today,
      title: isLoading
          ? 'Generating your plan...'
          : hasError
              ? 'Generation failed'
              : 'No plan generated yet',
      subtitle: subtitle,
      actionLabel: isLoading
          ? null
          : hasError
              ? 'Retry'
              : analyzedCount > 0
                  ? 'Generate Plan'
                  : null,
      onAction: isLoading || (!hasError && analyzedCount == 0)
          ? null
          : () => ref
              .read(plannerActionsProvider.notifier)
              .generateSchedule(courseId),
    );
  }
}

// ── Header ──────────────────────────────────────────────────────────────────

class _PlannerHeader extends ConsumerWidget {
  final List<TaskModel> tasks;
  final bool isLoading;
  final bool isDark;
  final String courseId;

  const _PlannerHeader({
    required this.tasks,
    required this.isLoading,
    required this.isDark,
    required this.courseId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Study Plan',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.5,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  tasks.isEmpty
                      ? 'Generate your daily roadmap'
                      : '${tasks.length} tasks planned',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                      ),
                ),
              ],
            ),
          ),
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
              label: Text(isLoading ? 'Generating...' : 'Generate Plan'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                minimumSize: Size.zero,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                ),
                textStyle: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Plan Content ────────────────────────────────────────────────────────────

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
    final studyCount = tasks.where((t) => t.type == 'STUDY').length;
    final quizCount = tasks.where((t) => t.type == 'QUESTIONS').length;
    final reviewCount = tasks.where((t) => t.type == 'REVIEW').length;
    final totalMinutes = tasks.fold<int>(0, (sum, t) => sum + t.estMinutes);

    final now = DateTime.now();
    final todayKey = DateTime(now.year, now.month, now.day);

    // Today's tasks
    final todayTasks = tasks.where((t) {
      final d = DateTime(t.dueDate.year, t.dueDate.month, t.dueDate.day);
      return d == todayKey;
    }).toList();
    final todayDone = todayTasks.where((t) => t.status == 'DONE').length;

    final grouped = ref.watch(groupedTasksProvider(tasks));
    final overdue = ref.watch(overdueTasksProvider(tasks));

    // Filter by selected date if any
    final selectedDate = ref.watch(selectedDateProvider);
    final filteredEntries = selectedDate != null
        ? grouped.entries.where((e) {
            final key = DateTime(
                selectedDate.year, selectedDate.month, selectedDate.day);
            return e.key == key;
          }).toList()
        : grouped.entries.toList();

    return RefreshIndicator(
      onRefresh: () => ref
          .read(plannerActionsProvider.notifier)
          .regenSchedule(courseId),
      color: AppColors.primary,
      child: ListView.builder(
        padding: const EdgeInsets.only(bottom: 96),
        itemCount: filteredEntries.length + 1, // +1 for dashboard
        itemBuilder: (context, i) {
          if (i == 0) {
            return SummaryDashboard(
              doneCount: doneCount,
              totalCount: tasks.length,
              studyCount: studyCount,
              quizCount: quizCount,
              reviewCount: reviewCount,
              totalMinutes: totalMinutes,
              todayDone: todayDone,
              todayTotal: todayTasks.length,
            );
          }

          final entry = filteredEntries[i - 1];
          final date = entry.key;
          final dayTasks = entry.value;
          final isToday = date == todayKey;
          final isOverdue = date.isBefore(todayKey);
          final completedCount =
              dayTasks.where((t) => t.status == 'DONE').length;
          final dayMinutes =
              dayTasks.fold<int>(0, (sum, t) => sum + t.estMinutes);

          return _DayGroup(
            date: date,
            tasks: dayTasks,
            isToday: isToday,
            isOverdue: isOverdue,
            isDark: isDark,
            completedCount: completedCount,
            totalMinutes: dayMinutes,
          );
        },
      ),
    );
  }
}

// ── Day Group ───────────────────────────────────────────────────────────────

class _DayGroup extends StatelessWidget {
  final DateTime date;
  final List<TaskModel> tasks;
  final bool isToday;
  final bool isOverdue;
  final bool isDark;
  final int completedCount;
  final int totalMinutes;

  const _DayGroup({
    required this.date,
    required this.tasks,
    required this.isToday,
    required this.isOverdue,
    required this.isDark,
    required this.completedCount,
    required this.totalMinutes,
  });

  @override
  Widget build(BuildContext context) {
    final label = AppDateUtils.relativeDay(date);

    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: isToday
              ? AppColors.primary.withValues(alpha: 0.3)
              : isOverdue
                  ? AppColors.error.withValues(alpha: 0.2)
                  : (isDark ? AppColors.darkBorder : AppColors.border),
        ),
        boxShadow: isToday ? AppSpacing.shadowSm : null,
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Day header
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
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'Today',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                if (isOverdue && !isToday)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.error.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'Overdue',
                      style: TextStyle(
                        color: AppColors.error,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
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
                        color: completedCount == tasks.length
                            ? AppColors.success
                            : (isDark
                                ? AppColors.darkTextSecondary
                                : AppColors.textSecondary),
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            // Tasks
            ...tasks.map((task) => TaskRow(task: task)),
          ],
        ),
      ),
    );
  }
}

// ── FAB ─────────────────────────────────────────────────────────────────────

class _PlannerFab extends ConsumerWidget {
  final String courseId;
  final List<TaskModel> tasks;
  final bool isLoading;

  const _PlannerFab({
    required this.courseId,
    required this.tasks,
    required this.isLoading,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overdue = ref.watch(overdueTasksProvider(tasks));
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (isLoading) {
      return FloatingActionButton(
        onPressed: null,
        backgroundColor: AppColors.primary.withValues(alpha: 0.5),
        child: const SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: Colors.white,
          ),
        ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (overdue.isNotEmpty) ...[
          FloatingActionButton.small(
            heroTag: 'catchUp',
            onPressed: () =>
                ref.read(plannerActionsProvider.notifier).catchUp(courseId),
            backgroundColor: AppColors.warning,
            child: const Icon(Icons.bolt_rounded, color: Colors.white, size: 20),
          ),
          const SizedBox(height: 8),
        ],
        FloatingActionButton(
          heroTag: 'regen',
          onPressed: () =>
              ref.read(plannerActionsProvider.notifier).regenSchedule(courseId),
          backgroundColor: AppColors.primary,
          child: const Icon(Icons.refresh_rounded, color: Colors.white),
        ),
      ],
    );
  }
}
