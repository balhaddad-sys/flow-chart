// FILE: lib/src/features/dashboard/widgets/fix_plan_card.dart
import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../models/task_model.dart';

/// Card displaying an AI-generated remediation (fix) plan.
///
/// Accepts either a [fixPlanTasks] list of [TaskModel] objects and an
/// [onViewPlan] callback, OR a raw [fixPlan] map from Cloud Functions.
/// Both signatures are supported for backwards-compat.
class FixPlanCard extends StatelessWidget {
  /// Structured TaskModel list from the planner. Used by new callers.
  final List<TaskModel>? fixPlanTasks;

  /// Called when the user taps "View Full Plan". Ignored if null.
  final VoidCallback? onViewPlan;

  /// Raw map from Cloud Functions response. Used by legacy callers.
  final Map<String, dynamic>? fixPlan;

  const FixPlanCard({
    super.key,
    this.fixPlanTasks,
    this.onViewPlan,
    this.fixPlan,
  }) : assert(
          fixPlanTasks != null || fixPlan != null,
          'Provide either fixPlanTasks or fixPlan.',
        );

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Prefer structured task list
    if (fixPlanTasks != null) {
      return _StructuredFixPlanCard(
        tasks: fixPlanTasks!,
        onViewPlan: onViewPlan,
        isDark: isDark,
      );
    }

    // Fallback: raw map
    return _RawFixPlanCard(
      fixPlan: fixPlan!,
      isDark: isDark,
    );
  }
}

// ── Structured card (from TaskModel list) ─────────────────────────────────────

class _StructuredFixPlanCard extends StatelessWidget {
  final List<TaskModel> tasks;
  final VoidCallback? onViewPlan;
  final bool isDark;

  const _StructuredFixPlanCard({
    required this.tasks,
    required this.onViewPlan,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final preview = tasks.take(3).toList();

    return Container(
      padding: AppSpacing.cardPaddingLg,
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: AppColors.success.withValues(alpha: isDark ? 0.2 : 0.15),
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                ),
                child: const Icon(
                  Icons.build_circle_rounded,
                  color: AppColors.success,
                  size: 20,
                ),
              ),
              AppSpacing.hGapSm,
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Remediation Plan',
                      style: Theme.of(context)
                          .textTheme
                          .titleSmall
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    Text(
                      '${tasks.length} targeted task${tasks.length == 1 ? '' : 's'}',
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(
                            color: isDark
                                ? AppColors.darkTextSecondary
                                : AppColors.textSecondary,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          AppSpacing.gapMd,

          // Task preview (up to 3)
          ...preview.map(
            (task) => _StructuredTaskItem(task: task, isDark: isDark),
          ),

          if (tasks.length > 3) ...[
            AppSpacing.gapSm,
            Text(
              '+${tasks.length - 3} more task${tasks.length - 3 == 1 ? '' : 's'}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary,
                  ),
            ),
          ],

          // View full plan button
          if (onViewPlan != null) ...[
            AppSpacing.gapMd,
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onViewPlan,
                icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                label: const Text('View Full Plan'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.success,
                  side: BorderSide(
                    color: AppColors.success.withValues(alpha: 0.4),
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(AppSpacing.radiusMd),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _StructuredTaskItem extends StatelessWidget {
  final TaskModel task;
  final bool isDark;

  const _StructuredTaskItem({required this.task, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final isDone = task.status == 'DONE';
    final color = _typeColor(task.type);

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.xs),
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm, vertical: AppSpacing.xs + 2),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.darkSurfaceVariant.withValues(alpha: 0.5)
            : AppColors.surfaceVariant.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border(
          left: BorderSide(color: color, width: 3),
        ),
      ),
      child: Row(
        children: [
          Icon(
            isDone ? Icons.check_circle_rounded : _typeIcon(task.type),
            color: isDone ? AppColors.success : color,
            size: 16,
          ),
          AppSpacing.hGapSm,
          Expanded(
            child: Text(
              task.title.isNotEmpty ? task.title : 'Untitled',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w500,
                    decoration:
                        isDone ? TextDecoration.lineThrough : null,
                    color: isDone
                        ? (isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary)
                        : null,
                  ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 8),
          // Due date
          Text(
            _formatDue(task.dueDate),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextTertiary
                      : AppColors.textTertiary,
                ),
          ),
          const SizedBox(width: 4),
          // Minutes
          Text(
            '${task.estMinutes}m',
            style: TextStyle(
              fontSize: 11,
              color: isDark
                  ? AppColors.darkTextTertiary
                  : AppColors.textTertiary,
            ),
          ),
        ],
      ),
    );
  }

  Color _typeColor(String type) {
    return switch (type) {
      'STUDY' => AppColors.primary,
      'QUESTIONS' => AppColors.secondary,
      'REVIEW' => AppColors.warning,
      'MOCK' => AppColors.error,
      _ => AppColors.textTertiary,
    };
  }

  IconData _typeIcon(String type) {
    return switch (type) {
      'STUDY' => Icons.menu_book_rounded,
      'QUESTIONS' => Icons.quiz_rounded,
      'REVIEW' => Icons.refresh_rounded,
      'MOCK' => Icons.assignment_rounded,
      _ => Icons.task_alt_rounded,
    };
  }

  String _formatDue(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final due = DateTime(date.year, date.month, date.day);
    final diff = due.difference(today).inDays;
    if (diff == 0) return 'Today';
    if (diff == 1) return 'Tomorrow';
    if (diff < 0) return '${-diff}d ago';
    return '${date.day}/${date.month}';
  }
}

// ── Raw map card (legacy / Cloud Functions response) ──────────────────────────

class _RawFixPlanCard extends StatelessWidget {
  final Map<String, dynamic> fixPlan;
  final bool isDark;

  const _RawFixPlanCard({
    required this.fixPlan,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final plan = fixPlan['fix_plan'] as Map<String, dynamic>?;
    if (plan == null) return const SizedBox.shrink();

    final summary = plan['summary'] as String? ?? '';
    final tasks = (plan['tasks'] as List<dynamic>?) ?? [];

    return Container(
      padding: AppSpacing.cardPaddingLg,
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: AppColors.secondary.withValues(alpha: isDark ? 0.2 : 0.15),
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.secondary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                ),
                child: const Icon(
                  Icons.auto_fix_high_rounded,
                  color: AppColors.secondary,
                  size: 20,
                ),
              ),
              AppSpacing.hGapSm,
              Text(
                'Remediation Plan',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
          ),

          if (summary.isNotEmpty) ...[
            AppSpacing.gapMd,
            Text(
              summary,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                    height: 1.5,
                  ),
            ),
          ],

          if (tasks.isNotEmpty) ...[
            AppSpacing.gapMd,
            ...tasks.take(3).map((task) {
              final t = task as Map<String, dynamic>;
              final isReview = t['type'] == 'REVIEW';
              return Container(
                margin: const EdgeInsets.only(bottom: AppSpacing.xs),
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: isDark
                      ? AppColors.darkSurfaceVariant.withValues(alpha: 0.5)
                      : AppColors.surfaceVariant.withValues(alpha: 0.5),
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusSm),
                ),
                child: Row(
                  children: [
                    Icon(
                      isReview ? Icons.refresh_rounded : Icons.quiz_rounded,
                      color: isReview
                          ? AppColors.warning
                          : AppColors.primary,
                      size: 16,
                    ),
                    AppSpacing.hGapSm,
                    Expanded(
                      child: Text(
                        t['title'] as String? ?? '',
                        style: Theme.of(context).textTheme.bodySmall,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      'Day ${t['dayOffset'] ?? 0} · ${t['estMinutes'] ?? 0}m',
                      style:
                          Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: isDark
                                    ? AppColors.darkTextTertiary
                                    : AppColors.textTertiary,
                              ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}
