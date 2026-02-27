// FILE: lib/src/features/planner/screens/planner_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/utils/date_utils.dart';
import '../../../core/utils/error_handler.dart';
import '../../../core/widgets/course_selector_sheet.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../models/task_model.dart';
import '../../home/providers/home_provider.dart';
import '../../library/providers/library_provider.dart';
import '../../practice/providers/practice_provider.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../providers/planner_provider.dart';
import '../widgets/task_row.dart';

class PlannerScreen extends ConsumerStatefulWidget {
  const PlannerScreen({super.key});

  @override
  ConsumerState<PlannerScreen> createState() => _PlannerScreenState();
}

class _PlannerScreenState extends ConsumerState<PlannerScreen> {
  bool _autoGenTriggered = false;

  @override
  Widget build(BuildContext context) {
    var activeCourseId = ref.watch(activeCourseIdProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Auto-select first course if none selected
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
      return Scaffold(
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        body: EmptyState(
          icon: Icons.calendar_today_outlined,
          title: 'No course selected',
          subtitle: 'Create a course to generate your study plan.',
          actionLabel: 'Get Started',
          onAction: () => CourseSelectorSheet.show(context),
        ),
      );
    }

    final String courseId = activeCourseId;
    final courses = ref.watch(coursesProvider).valueOrNull ?? [];
    final activeCourse = courses.where((c) => c.id == courseId).firstOrNull;

    final tasksAsync = ref.watch(allTasksProvider(courseId));
    final sectionsAsync = ref.watch(courseSectionsProvider(courseId));
    final filesAsync = ref.watch(filesProvider(courseId));
    final actionsState = ref.watch(plannerActionsProvider);

    // Listen for action results and show snackbars
    ref.listen<AsyncValue<void>>(plannerActionsProvider, (prev, next) {
      next.whenOrNull(
        error: (e, _) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(ErrorHandler.userMessage(e)),
                backgroundColor: AppColors.error,
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        },
        data: (_) {
          if (prev is AsyncLoading && context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Schedule updated successfully'),
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        },
      );
    });

    // Compute section readiness
    final sections = sectionsAsync.valueOrNull ?? [];
    final analyzedCount =
        sections.where((s) => s.aiStatus == 'ANALYZED').length;
    final pendingCount = sections
        .where((s) => s.aiStatus == 'PENDING' || s.aiStatus == 'PROCESSING')
        .length;

    // Auto-generate when conditions are met
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
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ─────────────────────────────────────────────────────
            _PlannerHeader(
              courseTitle: activeCourse?.title,
              hasTasks: tasks.isNotEmpty,
              isLoading: isLoading,
              analyzedCount: analyzedCount,
              isDark: isDark,
              onSwitchCourse: () => CourseSelectorSheet.show(context),
              onRegen: () => _confirmRegen(context, courseId),
              onGenerate: () => ref
                  .read(plannerActionsProvider.notifier)
                  .generateSchedule(courseId),
            ),

            // ── Loading banner ─────────────────────────────────────────────
            if (isLoading)
              _GeneratingBanner(isDark: isDark),

            // ── Error banner ────────────────────────────────────────────────
            if (actionsState.hasError && !isLoading)
              _ErrorBanner(
                message: ErrorHandler.userMessage(actionsState.error!),
                isDark: isDark,
                onDismiss: () =>
                    ref.read(plannerActionsProvider.notifier).clearError(),
              ),

            // ── Content ────────────────────────────────────────────────────
            Expanded(
              child: tasksAsync.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => EmptyState(
                  icon: Icons.error_outline_rounded,
                  title: 'Something went wrong',
                  subtitle: ErrorHandler.userMessage(e),
                  actionLabel: 'Retry',
                  onAction: () =>
                      ref.invalidate(allTasksProvider(courseId)),
                ),
                data: (tasks) {
                  if (tasks.isEmpty) {
                    return _EmptyPlanContent(
                      isLoading: isLoading,
                      hasError: actionsState.hasError,
                      errorMsg: actionsState.hasError
                          ? ErrorHandler.userMessage(actionsState.error!)
                          : null,
                      analyzedCount: analyzedCount,
                      pendingCount: pendingCount,
                      hasFiles:
                          filesAsync.valueOrNull?.isNotEmpty ?? false,
                      onGenerate: () => ref
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

  Future<void> _confirmRegen(BuildContext context, String courseId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Regenerate Schedule?'),
        content: const Text(
          'This will delete all pending tasks and create a fresh schedule. '
          'Completed tasks will be preserved.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Regenerate'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      ref
          .read(plannerActionsProvider.notifier)
          .regenSchedule(courseId);
    }
  }
}

// ── Header ────────────────────────────────────────────────────────────────────

class _PlannerHeader extends StatelessWidget {
  final String? courseTitle;
  final bool hasTasks;
  final bool isLoading;
  final int analyzedCount;
  final bool isDark;
  final VoidCallback onSwitchCourse;
  final VoidCallback onRegen;
  final VoidCallback onGenerate;

  const _PlannerHeader({
    required this.courseTitle,
    required this.hasTasks,
    required this.isLoading,
    required this.analyzedCount,
    required this.isDark,
    required this.onSwitchCourse,
    required this.onRegen,
    required this.onGenerate,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title + action button row
          Row(
            children: [
              Expanded(
                child: Text(
                  'Study Plan',
                  style: Theme.of(context)
                      .textTheme
                      .headlineMedium
                      ?.copyWith(
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.5,
                      ),
                ),
              ),
              const SizedBox(width: 8),
              if (!hasTasks)
                ElevatedButton.icon(
                  onPressed: isLoading || analyzedCount == 0
                      ? null
                      : onGenerate,
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
                  label: Text(
                    isLoading
                        ? 'Generating...'
                        : analyzedCount == 0
                            ? 'No sections ready'
                            : 'Generate Plan',
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor:
                        AppColors.primary.withValues(alpha: 0.5),
                    disabledForegroundColor: Colors.white60,
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
                // Regen button
                Material(
                  color: isDark
                      ? AppColors.darkSurfaceVariant
                      : AppColors.surfaceVariant,
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusMd),
                  child: InkWell(
                    borderRadius:
                        BorderRadius.circular(AppSpacing.radiusMd),
                    onTap: isLoading ? null : onRegen,
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

          const SizedBox(height: 8),

          // Course selector row
          GestureDetector(
            onTap: onSwitchCourse,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: isDark
                    ? AppColors.darkSurfaceVariant
                    : AppColors.surfaceVariant,
                borderRadius:
                    BorderRadius.circular(AppSpacing.radiusFull),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.school_rounded,
                    size: 14,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      courseTitle ?? 'Select Course',
                      style: Theme.of(context)
                          .textTheme
                          .labelMedium
                          ?.copyWith(
                            color: isDark
                                ? AppColors.darkTextSecondary
                                : AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    Icons.expand_more_rounded,
                    size: 16,
                    color: isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Banners ───────────────────────────────────────────────────────────────────

class _GeneratingBanner extends StatelessWidget {
  final bool isDark;
  const _GeneratingBanner({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.2),
        ),
      ),
      child: Row(
        children: [
          const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Generating your schedule...',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  final String message;
  final bool isDark;
  final VoidCallback onDismiss;

  const _ErrorBanner({
    required this.message,
    required this.isDark,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: AppColors.error.withValues(alpha: 0.2),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded,
              size: 16, color: AppColors.error),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.error,
                  ),
            ),
          ),
          GestureDetector(
            onTap: onDismiss,
            child: const Icon(Icons.close_rounded,
                size: 16, color: AppColors.error),
          ),
        ],
      ),
    );
  }
}

// ── Empty plan states ─────────────────────────────────────────────────────────

class _EmptyPlanContent extends StatelessWidget {
  final bool isLoading;
  final bool hasError;
  final String? errorMsg;
  final int analyzedCount;
  final int pendingCount;
  final bool hasFiles;
  final VoidCallback onGenerate;

  const _EmptyPlanContent({
    required this.isLoading,
    required this.hasError,
    required this.errorMsg,
    required this.analyzedCount,
    required this.pendingCount,
    required this.hasFiles,
    required this.onGenerate,
  });

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const EmptyState(
        icon: Icons.calendar_today_outlined,
        title: 'Generating your plan...',
        subtitle: 'This usually takes a few seconds.',
      );
    }

    if (hasError) {
      return EmptyState(
        icon: Icons.error_outline_rounded,
        title: 'Generation failed',
        subtitle: errorMsg ?? 'An error occurred. Please try again.',
        actionLabel: analyzedCount > 0 ? 'Try Again' : null,
        onAction: analyzedCount > 0 ? onGenerate : null,
      );
    }

    if (pendingCount > 0 && analyzedCount == 0) {
      return EmptyState(
        icon: Icons.hourglass_top_rounded,
        title: 'Analyzing your materials...',
        subtitle:
            '$pendingCount section${pendingCount > 1 ? 's' : ''} being analyzed. '
            'Come back in a few minutes.',
      );
    }

    if (analyzedCount == 0) {
      return EmptyState(
        icon: hasFiles
            ? Icons.hourglass_empty_rounded
            : Icons.upload_file_rounded,
        title: hasFiles
            ? 'Materials still processing'
            : 'No materials uploaded',
        subtitle: hasFiles
            ? 'Your uploaded files are being processed. '
                'Check the Library tab for status.'
            : 'Upload study materials in the Library tab first.',
      );
    }

    // Ready to generate — show a prominent card
    return _GenerateReadyCard(
      analyzedCount: analyzedCount,
      onGenerate: onGenerate,
    );
  }
}

class _GenerateReadyCard extends StatelessWidget {
  final int analyzedCount;
  final VoidCallback onGenerate;

  const _GenerateReadyCard({
    required this.analyzedCount,
    required this.onGenerate,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkSurface : AppColors.surface,
            borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
            border: Border.all(
              color: AppColors.primary.withValues(alpha: 0.2),
            ),
            boxShadow: AppSpacing.shadowMd,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  gradient: AppColors.primaryGradient,
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusXl),
                ),
                child: const Icon(
                  Icons.calendar_today_rounded,
                  color: Colors.white,
                  size: 36,
                ),
              ),
              AppSpacing.gapMd,
              Text(
                'Ready to generate your plan!',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                textAlign: TextAlign.center,
              ),
              AppSpacing.gapSm,
              Text(
                '$analyzedCount section${analyzedCount > 1 ? 's' : ''} analyzed and '
                'ready to schedule. Your personalized study plan will '
                'be generated based on your availability.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textSecondary,
                      height: 1.5,
                    ),
                textAlign: TextAlign.center,
              ),
              AppSpacing.gapLg,
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: onGenerate,
                  icon: const Icon(Icons.auto_awesome_rounded, size: 18),
                  label: const Text('Generate Schedule'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Plan Content ──────────────────────────────────────────────────────────────

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
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
      itemCount: entries.length + 1,
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
        final isPast = date.isBefore(todayKey);
        final completedCount =
            dayTasks.where((t) => t.status == 'DONE').length;
        final dayMinutes =
            dayTasks.fold<int>(0, (sum, t) => sum + t.estMinutes);

        return _DayGroup(
          date: date,
          tasks: dayTasks,
          isToday: isToday,
          isPast: isPast,
          isDark: isDark,
          completedCount: completedCount,
          totalMinutes: dayMinutes,
        );
      },
    );
  }
}

// ── Summary Card ──────────────────────────────────────────────────────────────

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
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Column(
        children: [
          Row(
            children: [
              SizedBox(
                width: 56,
                height: 56,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CircularProgressIndicator(
                      value: pct,
                      strokeWidth: 5,
                      backgroundColor: isDark
                          ? AppColors.darkBorder
                          : const Color(0xFFE5E7EB),
                      color: pct >= 1.0
                          ? AppColors.success
                          : AppColors.primary,
                    ),
                    Center(
                      child: Text(
                        '$pctInt%',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: pct >= 1.0
                              ? AppColors.success
                              : AppColors.primary,
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
                    const SizedBox(height: 3),
                    Text(
                      '~${(totalMinutes / 60).toStringAsFixed(1)}h total study time',
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(
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

// ── Day Group ─────────────────────────────────────────────────────────────────

class _DayGroup extends ConsumerWidget {
  final DateTime date;
  final List<TaskModel> tasks;
  final bool isToday;
  final bool isPast;
  final bool isDark;
  final int completedCount;
  final int totalMinutes;

  const _DayGroup({
    required this.date,
    required this.tasks,
    required this.isToday,
    required this.isPast,
    required this.isDark,
    required this.completedCount,
    required this.totalMinutes,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final label = AppDateUtils.relativeDay(date);
    final uid = ref.read(uidProvider);

    // Sort: active tasks first, then done/skipped
    final activeTasks = tasks
        .where((t) => t.status != 'DONE' && t.status != 'SKIPPED')
        .toList();
    final doneTasks = tasks
        .where((t) => t.status == 'DONE' || t.status == 'SKIPPED')
        .toList();

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: isToday
              ? AppColors.primary.withValues(alpha: 0.3)
              : isPast && completedCount < tasks.length
                  ? AppColors.warning.withValues(alpha: 0.2)
                  : (isDark ? AppColors.darkBorder : AppColors.border),
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Day header
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                if (isToday)
                  Container(
                    width: 8,
                    height: 8,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                Flexible(
                  child: Text(
                    label,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context)
                        .textTheme
                        .titleSmall
                        ?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: isToday
                              ? AppColors.primary
                              : isPast && completedCount < tasks.length
                                  ? (isDark
                                      ? AppColors.darkTextSecondary
                                      : AppColors.textSecondary)
                                  : null,
                        ),
                  ),
                ),
                const SizedBox(width: 8),
                // Task count badge
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: isToday
                        ? AppColors.primary
                        : (isDark
                            ? AppColors.darkSurfaceVariant
                            : AppColors.surfaceVariant),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${tasks.length}',
                    style: TextStyle(
                      color: isToday
                          ? Colors.white
                          : (isDark
                              ? AppColors.darkTextTertiary
                              : AppColors.textTertiary),
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
                  style: Theme.of(context)
                      .textTheme
                      .labelSmall
                      ?.copyWith(
                        color: completedCount == tasks.length
                            ? AppColors.success
                            : (isDark
                                ? AppColors.darkTextSecondary
                                : AppColors.textSecondary),
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ),
          ),

          Divider(
            height: 1,
            color: isDark ? AppColors.darkBorder : AppColors.borderLight,
          ),

          // Active tasks
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 4),
            child: Column(
              children: [
                ...activeTasks.map(
                  (task) => TaskRow(
                    task: task,
                    onComplete: () {
                      if (uid != null) {
                        ref
                            .read(firestoreServiceProvider)
                            .completeTask(uid, task.id);
                      }
                    },
                    onSkip: () {
                      if (uid != null) {
                        ref
                            .read(firestoreServiceProvider)
                            .updateTask(
                                uid, task.id, {'status': 'SKIPPED'});
                      }
                    },
                  ),
                ),

                // Done tasks greyed at bottom
                if (doneTasks.isNotEmpty) ...[
                  if (activeTasks.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Divider(
                        height: 1,
                        color: isDark
                            ? AppColors.darkBorder
                            : AppColors.borderLight,
                      ),
                    ),
                  ...doneTasks.map(
                    (task) => TaskRow(
                      task: task,
                      onComplete: () {},
                      onSkip: () {},
                    ),
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 4),
        ],
      ),
    );
  }
}
