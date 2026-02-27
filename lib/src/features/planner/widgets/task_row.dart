// FILE: lib/src/features/planner/widgets/task_row.dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_slidable/flutter_slidable.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/utils/date_utils.dart';
import '../../../models/task_model.dart';

class TaskRow extends StatelessWidget {
  final TaskModel task;
  final VoidCallback onComplete;
  final VoidCallback onSkip;

  const TaskRow({
    super.key,
    required this.task,
    required this.onComplete,
    required this.onSkip,
  });

  @override
  Widget build(BuildContext context) {
    return _TaskRowInner(
      task: task,
      onComplete: onComplete,
      onSkip: onSkip,
    );
  }
}

class _TaskRowInner extends ConsumerWidget {
  final TaskModel task;
  final VoidCallback onComplete;
  final VoidCallback onSkip;

  const _TaskRowInner({
    required this.task,
    required this.onComplete,
    required this.onSkip,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDone = task.status == 'DONE';
    final isSkipped = task.status == 'SKIPPED';
    final isInProgress = task.status == 'IN_PROGRESS';
    final isInactive = isDone || isSkipped;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Slidable(
      endActionPane: ActionPane(
        motion: const ScrollMotion(),
        children: [
          SlidableAction(
            onPressed: (_) async {
              final picked = await showDatePicker(
                context: context,
                initialDate: task.dueDate.add(const Duration(days: 1)),
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 365)),
              );
              if (picked != null) {
                final uid = ref.read(uidProvider);
                if (uid != null) {
                  unawaited(
                    ref.read(firestoreServiceProvider).updateTask(
                      uid,
                      task.id,
                      {'dueDate': picked},
                    ),
                  );
                }
              }
            },
            backgroundColor: AppColors.info,
            foregroundColor: Colors.white,
            icon: Icons.schedule_rounded,
            label: 'Reschedule',
          ),
          SlidableAction(
            onPressed: (_) {
              onSkip();
            },
            backgroundColor: AppColors.warning,
            foregroundColor: Colors.white,
            icon: Icons.skip_next_rounded,
            label: 'Skip',
          ),
        ],
      ),
      child: GestureDetector(
        onLongPress: () => _showTaskOptions(context, ref, isDark),
        child: Container(
          margin: const EdgeInsets.only(bottom: AppSpacing.xs),
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: isInactive
                ? (isDark
                    ? AppColors.darkSurface.withValues(alpha: 0.5)
                    : AppColors.surfaceVariant.withValues(alpha: 0.5))
                : (isDark ? AppColors.darkSurface : AppColors.surface),
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: Border.all(
              color: isInactive
                  ? (isDark ? AppColors.darkBorder : AppColors.borderLight)
                  : (isDark ? AppColors.darkBorder : AppColors.border),
              width: isInactive ? 0.5 : 1.0,
            ),
            boxShadow:
                isInactive || isDark ? null : AppSpacing.shadowSm,
          ),
          child: Container(
            decoration: BoxDecoration(
              border: Border(
                left: BorderSide(
                  color: isInactive
                      ? Colors.transparent
                      : _accentColor(task.type),
                  width: 3,
                ),
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: 12, vertical: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Status indicator ──────────────────────────────
                  Padding(
                    padding: const EdgeInsets.only(top: 1),
                    child: _StatusCircle(
                      isDone: isDone,
                      isSkipped: isSkipped,
                      isInProgress: isInProgress,
                      onTap: isDone ? null : onComplete,
                    ),
                  ),
                  const SizedBox(width: 10),

                  // ── Content ───────────────────────────────────────
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Title
                        Text(
                          task.title.isNotEmpty
                              ? task.title
                              : 'Untitled Task',
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(
                                fontWeight: isInactive
                                    ? FontWeight.w400
                                    : FontWeight.w600,
                                decoration: isDone
                                    ? TextDecoration.lineThrough
                                    : null,
                                color: isInactive
                                    ? (isDark
                                        ? AppColors.darkTextTertiary
                                        : AppColors.textTertiary)
                                    : null,
                              ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 5),

                        // Subtitle row
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            // Type badge
                            _TypeBadge(type: task.type, isDark: isDark),

                            // Minutes badge
                            _MinutesBadge(
                              minutes: task.estMinutes,
                              isDark: isDark,
                            ),

                            // Status badge for skipped
                            if (isSkipped)
                              _StatusBadge(
                                label: 'Skipped',
                                color: AppColors.warning,
                                isDark: isDark,
                              ),

                            // Fix plan badge
                            if (task.isFixPlan)
                              _StatusBadge(
                                label: 'Fix Plan',
                                color: AppColors.secondary,
                                isDark: isDark,
                              ),

                            // Topic tags (up to 2)
                            ...task.topicTags.take(2).map(
                              (tag) => _TagChip(
                                tag: tag,
                                isDark: isDark,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showTaskOptions(
    BuildContext context,
    WidgetRef ref,
    bool isDark,
  ) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppSpacing.radiusXl),
          ),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              // Drag handle
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark
                      ? AppColors.darkBorder
                      : AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Text(
                  task.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(height: 16),
              const Divider(height: 1),
              // Skip option
              ListTile(
                leading: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.skip_next_rounded,
                    color: AppColors.warning,
                    size: 20,
                  ),
                ),
                title: const Text('Skip Task'),
                subtitle: const Text('Mark as skipped and move on'),
                onTap: () {
                  Navigator.pop(context);
                  onSkip();
                },
              ),
              // Reschedule option
              ListTile(
                leading: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.info.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.schedule_rounded,
                    color: AppColors.info,
                    size: 20,
                  ),
                ),
                title: const Text('Reschedule'),
                subtitle: const Text('Change the due date'),
                onTap: () async {
                  Navigator.pop(context);
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: task.dueDate
                        .add(const Duration(days: 1)),
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now()
                        .add(const Duration(days: 365)),
                  );
                  if (picked != null) {
                    final uid = ref.read(uidProvider);
                    if (uid != null) {
                      unawaited(
                        ref
                            .read(firestoreServiceProvider)
                            .updateTask(
                              uid,
                              task.id,
                              {'dueDate': picked},
                            ),
                      );
                    }
                  }
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Color _accentColor(String type) {
    return switch (type) {
      'STUDY' => AppColors.primary,
      'QUESTIONS' => AppColors.secondary,
      'REVIEW' => AppColors.warning,
      'MOCK' => AppColors.error,
      _ => AppColors.textTertiary,
    };
  }
}

// ── Status circle widget ──────────────────────────────────────────────────────

class _StatusCircle extends StatelessWidget {
  final bool isDone;
  final bool isSkipped;
  final bool isInProgress;
  final VoidCallback? onTap;

  const _StatusCircle({
    required this.isDone,
    required this.isSkipped,
    required this.isInProgress,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final Widget child;
    final Color borderColor;
    final Color? fillColor;

    if (isDone) {
      child = const Icon(Icons.check_rounded, size: 14, color: Colors.white);
      borderColor = AppColors.success;
      fillColor = AppColors.success;
    } else if (isSkipped) {
      child = const Icon(Icons.close_rounded,
          size: 12, color: AppColors.textTertiary);
      borderColor = AppColors.textTertiary;
      fillColor = null;
    } else if (isInProgress) {
      child = const SizedBox(
        width: 10,
        height: 10,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: AppColors.primary,
        ),
      );
      borderColor = AppColors.primary;
      fillColor = null;
    } else {
      child = const SizedBox.shrink();
      borderColor = AppColors.border;
      fillColor = null;
    }

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 22,
        height: 22,
        decoration: BoxDecoration(
          color: fillColor,
          shape: BoxShape.circle,
          border: Border.all(
            color: borderColor,
            width: 2,
          ),
        ),
        child: Center(child: child),
      ),
    );
  }
}

// ── Badge widgets ─────────────────────────────────────────────────────────────

class _TypeBadge extends StatelessWidget {
  final String type;
  final bool isDark;

  const _TypeBadge({required this.type, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final (IconData icon, Color color, String label) = switch (type) {
      'STUDY' => (Icons.menu_book_rounded, AppColors.primary, 'Study'),
      'QUESTIONS' => (Icons.quiz_rounded, AppColors.secondary, 'Quiz'),
      'REVIEW' => (Icons.refresh_rounded, AppColors.warning, 'Review'),
      'MOCK' => (Icons.assignment_rounded, AppColors.error, 'Mock'),
      _ => (Icons.task_alt_rounded, AppColors.textTertiary, type),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.1),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: color),
          const SizedBox(width: 3),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _MinutesBadge extends StatelessWidget {
  final int minutes;
  final bool isDark;

  const _MinutesBadge({required this.minutes, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.darkSurfaceVariant
            : AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.timer_outlined,
            size: 10,
            color: isDark
                ? AppColors.darkTextTertiary
                : AppColors.textTertiary,
          ),
          const SizedBox(width: 3),
          Text(
            AppDateUtils.formatDuration(minutes),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w500,
              color: isDark
                  ? AppColors.darkTextTertiary
                  : AppColors.textTertiary,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String label;
  final Color color;
  final bool isDark;

  const _StatusBadge({
    required this.label,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.1),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

class _TagChip extends StatelessWidget {
  final String tag;
  final bool isDark;

  const _TagChip({required this.tag, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.darkSurfaceVariant
            : AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.borderLight,
          width: 0.5,
        ),
      ),
      child: Text(
        tag,
        style: TextStyle(
          fontSize: 10,
          color: isDark
              ? AppColors.darkTextSecondary
              : AppColors.textSecondary,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}
