// FILE: lib/src/features/home/widgets/today_checklist.dart

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/utils/date_utils.dart';
import '../../../core/utils/error_handler.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../models/course_model.dart';
import '../../../models/task_model.dart';
import '../../planner/providers/planner_provider.dart';
import '../../practice/providers/practice_provider.dart';
import '../providers/home_provider.dart';

class TodayChecklist extends ConsumerStatefulWidget {
  final String courseId;

  const TodayChecklist({super.key, required this.courseId});

  @override
  ConsumerState<TodayChecklist> createState() => _TodayChecklistState();
}

class _TodayChecklistState extends ConsumerState<TodayChecklist> {
  final Set<String> _completing = {};
  bool _generating = false;

  Future<void> _generatePlan() async {
    if (_generating) return;
    setState(() => _generating = true);
    try {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                ),
                SizedBox(width: 12),
                Text('Generating your study plan...'),
              ],
            ),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            ),
          ),
        );
      }

      final availability = await loadScheduleAvailability(
        widget.courseId,
        courses: ref.read(coursesProvider).valueOrNull ?? const <CourseModel>[],
        uid: ref.read(uidProvider),
        firestoreService: ref.read(firestoreServiceProvider),
      );

      final result = await ref
          .read(cloudFunctionsServiceProvider)
          .generateSchedule(
            courseId: widget.courseId,
            availability: availability,
            revisionPolicy: 'standard',
          );

      if (!mounted) return;

      if (result['feasible'] == false) {
        final deficit = result['deficit'] ?? 0;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Not enough study time to fit the plan ($deficit minutes over capacity).',
            ),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            ),
          ),
        );
        return;
      }

      ref.invalidate(todayTasksProvider(widget.courseId));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Plan generated!'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.success,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ErrorHandler.userMessage(e)),
            behavior: SnackBarBehavior.floating,
            backgroundColor: AppColors.error,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Future<void> _completeTask(TaskModel task) async {
    if (_completing.contains(task.id)) return;
    setState(() => _completing.add(task.id));
    try {
      final uid = ref.read(uidProvider);
      if (uid != null) {
        await ref.read(firestoreServiceProvider).completeTask(uid, task.id);
      }
    } catch (e) {
      ErrorHandler.logError(e);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to complete task: ${e.toString()}'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: AppColors.error,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _completing.discard(task.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tasksAsync = ref.watch(todayTasksProvider(widget.courseId));
    final sectionsAsync = ref.watch(courseSectionsProvider(widget.courseId));

    final sections = sectionsAsync.valueOrNull ?? [];
    final analyzedCount = sections.where((s) => s.aiStatus == 'ANALYZED').length;
    final pendingCount = sections
        .where((s) => s.aiStatus == 'PENDING' || s.aiStatus == 'PROCESSING')
        .length;
    final hasAnySections = sections.isNotEmpty;

    if (_generating) {
      return _GeneratingState(isDark: isDark);
    }

    return tasksAsync.when(
      loading: () => const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      ),
      error: (e, _) {
        return EmptyState(
          icon: Icons.error_outline,
          title: 'Unable to load plan',
          subtitle: 'Please try again or check your connection',
          actionLabel: 'Retry',
          onAction: () => ref.invalidate(todayTasksProvider(widget.courseId)),
        );
      },
      data: (tasks) {
        if (tasks.isEmpty) {
          // Not enough info yet — sections still loading
          if (sectionsAsync.isLoading) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(color: AppColors.primary),
              ),
            );
          }
          // No sections at all → prompt to upload
          if (!hasAnySections) {
            return EmptyState(
              icon: Icons.upload_file_outlined,
              title: 'Upload study materials',
              subtitle:
                  'Upload your first PDF or document in the Library tab to generate a personalised plan.',
              actionLabel: 'Go to Library',
              onAction: () => GoRouter.of(context).go('/library'),
            );
          }
          // Sections exist but none analyzed yet → still processing
          if (analyzedCount == 0 && pendingCount > 0) {
            return EmptyState(
              icon: Icons.hourglass_top_rounded,
              title: 'Analyzing your materials',
              subtitle:
                  '$pendingCount section${pendingCount > 1 ? 's' : ''} being analyzed. '
                  'Come back in a few minutes to generate your plan.',
            );
          }
          // Sections exist but none analyzed and none pending → something went wrong
          if (analyzedCount == 0) {
            return EmptyState(
              icon: Icons.hourglass_empty_rounded,
              title: 'Materials still processing',
              subtitle:
                  'Your uploaded files are being processed. '
                  'Check the Library tab for status.',
              actionLabel: 'Open Library',
              onAction: () => GoRouter.of(context).go('/library'),
            );
          }
          // Analyzed sections available → show generate button
          return _EmptyChecklist(
            isDark: isDark,
            analyzedCount: analyzedCount,
            onGenerate: _generatePlan,
          );
        }

        // Split into pending and done
        final pendingTasks = tasks
            .where((t) => t.status != 'DONE' && t.status != 'SKIPPED')
            .toList();
        final doneTasks = tasks
            .where((t) => t.status == 'DONE' || t.status == 'SKIPPED')
            .toList();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ...pendingTasks.map(
              (task) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: _TaskRow(
                  task: task,
                  isDark: isDark,
                  isCompleting: _completing.contains(task.id),
                  onComplete: () => _completeTask(task),
                ),
              ),
            ),
            if (doneTasks.isNotEmpty && pendingTasks.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: Row(
                  children: [
                    Expanded(
                      child: Divider(
                        color: isDark ? AppColors.darkBorder : AppColors.border,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      child: Text(
                        'Completed (${doneTasks.length})',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: isDark
                                  ? AppColors.darkTextTertiary
                                  : AppColors.textTertiary,
                              fontSize: 11,
                            ),
                      ),
                    ),
                    Expanded(
                      child: Divider(
                        color: isDark ? AppColors.darkBorder : AppColors.border,
                      ),
                    ),
                  ],
                ),
              ),
            ...doneTasks.map(
              (task) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: _TaskRow(
                  task: task,
                  isDark: isDark,
                  isCompleting: false,
                  onComplete: null,
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

// ── Empty state for checklist ─────────────────────────────────────────────────

class _EmptyChecklist extends StatelessWidget {
  final bool isDark;
  final int analyzedCount;
  final VoidCallback onGenerate;

  const _EmptyChecklist({
    required this.isDark,
    required this.analyzedCount,
    required this.onGenerate,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
      ),
      child: Column(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.check_circle_outline_rounded,
              color: AppColors.primary,
              size: 24,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'No tasks for today',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 6),
          Text(
            '$analyzedCount section${analyzedCount > 1 ? 's' : ''} ready. '
            'Tap below to generate your personalised study plan.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                  fontSize: 12,
                ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: onGenerate,
              icon: const Icon(Icons.auto_awesome_rounded, size: 15),
              label: const Text('Generate Plan'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 11),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                ),
                textStyle: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Generating state placeholder ──────────────────────────────────────────────

class _GeneratingState extends StatelessWidget {
  final bool isDark;

  const _GeneratingState({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
      ),
      child: Column(
        children: [
          const SizedBox(
            width: 32,
            height: 32,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'Generating your study plan...',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
          ),
        ],
      ),
    );
  }
}

// ── Task row ─────────────────────────────────────────────────────────────────

class _TaskRow extends StatelessWidget {
  final TaskModel task;
  final bool isDark;
  final bool isCompleting;
  final VoidCallback? onComplete;

  const _TaskRow({
    required this.task,
    required this.isDark,
    required this.isCompleting,
    required this.onComplete,
  });

  @override
  Widget build(BuildContext context) {
    final isDone = task.status == 'DONE' || task.status == 'SKIPPED';
    final isSkipped = task.status == 'SKIPPED';

    return Container(
      decoration: BoxDecoration(
        color: isDone
            ? (isDark
                ? AppColors.darkSurface.withValues(alpha: 0.6)
                : AppColors.successLight.withValues(alpha: 0.3))
            : (isDark ? AppColors.darkSurface : AppColors.surface),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDone
              ? AppColors.success.withValues(alpha: 0.20)
              : (isDark ? AppColors.darkBorder : AppColors.border),
        ),
        boxShadow: isDone ? null : AppSpacing.shadowSm,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Checkbox
            GestureDetector(
              onTap: (!isDone && onComplete != null) ? onComplete : null,
              child: Container(
                width: 24,
                height: 24,
                margin: const EdgeInsets.only(top: 1),
                decoration: BoxDecoration(
                  color: isDone ? AppColors.success : Colors.transparent,
                  shape: BoxShape.circle,
                  border: isDone
                      ? null
                      : Border.all(
                          color: isDark ? AppColors.darkBorder : AppColors.border,
                          width: 1.75,
                        ),
                ),
                child: isCompleting
                    ? const Padding(
                        padding: EdgeInsets.all(4),
                        child: CircularProgressIndicator(
                          strokeWidth: 1.5,
                          color: Colors.white,
                        ),
                      )
                    : isDone
                        ? const Icon(
                            Icons.check_rounded,
                            color: Colors.white,
                            size: 14,
                          )
                        : null,
              ),
            ),
            const SizedBox(width: 12),

            // Task content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    task.title,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                          decoration: isDone
                              ? TextDecoration.lineThrough
                              : TextDecoration.none,
                          color: isDone
                              ? (isDark
                                  ? AppColors.darkTextTertiary
                                  : AppColors.textTertiary)
                              : (isDark
                                  ? AppColors.darkTextPrimary
                                  : AppColors.textPrimary),
                          decorationColor: isDark
                              ? AppColors.darkTextTertiary
                              : AppColors.textTertiary,
                        ),
                  ),
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      Icon(
                        Icons.access_time_rounded,
                        size: 12,
                        color: isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary,
                      ),
                      const SizedBox(width: 3),
                      Text(
                        AppDateUtils.formatDuration(task.estMinutes),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: isDark
                                  ? AppColors.darkTextTertiary
                                  : AppColors.textTertiary,
                              fontSize: 11,
                            ),
                      ),
                      if (isSkipped) ...[
                        const SizedBox(width: 8),
                        const Text(
                          'Skipped',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppColors.warning,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (task.topicTags.isNotEmpty) ...[
                    const SizedBox(height: 7),
                    Wrap(
                      spacing: 5,
                      runSpacing: 5,
                      children: task.topicTags.take(3).map((tag) {
                        return Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: isDark
                                ? AppColors.darkSurfaceVariant
                                : AppColors.surfaceVariant,
                            borderRadius:
                                BorderRadius.circular(AppSpacing.radiusFull),
                            border: Border.all(
                              color: isDark
                                  ? AppColors.darkBorder
                                  : AppColors.border,
                            ),
                          ),
                          child: Text(
                            tag,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              color: isDark
                                  ? AppColors.darkTextSecondary
                                  : AppColors.textSecondary,
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ],
              ),
            ),

            // Est. minutes badge
            Container(
              margin: const EdgeInsets.only(left: 8, top: 1),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: isDone
                    ? AppColors.success.withValues(alpha: 0.10)
                    : AppColors.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
              ),
              child: Text(
                '${task.estMinutes}m',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: isDone ? AppColors.success : AppColors.primary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Helper extension to avoid lint issue with Set.remove returning bool
extension _SetDiscard<T> on Set<T> {
  void discard(T element) => remove(element);
}
