import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/utils/date_utils.dart';
import '../../../core/utils/error_handler.dart';
import '../../../models/task_model.dart';
import 'shared/completion_checkbox.dart';
import 'shared/difficulty_indicator.dart';
import 'shared/task_type_info.dart';

class TaskRow extends ConsumerWidget {
  final TaskModel task;
  final bool compact;
  final String? subtitle;

  const TaskRow({
    super.key,
    required this.task,
    this.compact = false,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDone = task.status == 'DONE';
    final isSkipped = task.status == 'SKIPPED';
    final isInactive = isDone || isSkipped;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final ti = TaskTypeInfo.fromType(task.type);

    final card = _buildCard(context, ref, isDone, isSkipped, isInactive, isDark, ti);

    if (compact) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: card,
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Slidable(
        endActionPane: ActionPane(
          motion: const BehindMotion(),
          extentRatio: 0.55,
          children: [
            SlidableAction(
              onPressed: (_) => _reschedule(context, ref),
              backgroundColor: AppColors.info,
              foregroundColor: Colors.white,
              icon: Icons.schedule_rounded,
              label: 'Reschedule',
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(14),
                bottomLeft: Radius.circular(14),
              ),
            ),
            SlidableAction(
              onPressed: (_) => _skip(ref),
              backgroundColor: AppColors.warning,
              foregroundColor: Colors.white,
              icon: Icons.skip_next_rounded,
              label: 'Skip',
            ),
            SlidableAction(
              onPressed: (_) => _pin(ref),
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              icon: task.isPinned
                  ? Icons.push_pin_rounded
                  : Icons.push_pin_outlined,
              label: task.isPinned ? 'Unpin' : 'Pin',
              borderRadius: const BorderRadius.only(
                topRight: Radius.circular(14),
                bottomRight: Radius.circular(14),
              ),
            ),
          ],
        ),
        child: card,
      ),
    );
  }

  Widget _buildCard(
    BuildContext context,
    WidgetRef ref,
    bool isDone,
    bool isSkipped,
    bool isInactive,
    bool isDark,
    TaskTypeInfo ti,
  ) {
    return GestureDetector(
      onTap: isInactive ? null : () => _openTask(context),
      child: AnimatedContainer(
        duration: AppSpacing.animFast,
        curve: Curves.easeOutCubic,
        decoration: BoxDecoration(
          color: isDone
              ? (isDark ? const Color(0xFF0D2818) : AppColors.successSurface)
              : isSkipped
                  ? (isDark ? const Color(0xFF2D1F06) : AppColors.warningSurface)
                  : (isDark ? AppColors.darkSurface : AppColors.surface),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isDone
                ? AppColors.success.withValues(alpha: 0.3)
                : isSkipped
                    ? AppColors.warning.withValues(alpha: 0.3)
                    : (isDark ? AppColors.darkBorder : AppColors.border),
          ),
          boxShadow: isInactive ? null : AppSpacing.shadowSm,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Row(
            children: [
              // Left accent bar
              AnimatedContainer(
                duration: AppSpacing.animFast,
                width: 4,
                height: compact ? 60 : 72,
                color: isInactive
                    ? (isDone
                        ? AppColors.success.withValues(alpha: 0.4)
                        : AppColors.warning.withValues(alpha: 0.4))
                    : ti.color,
              ),

              // Main content
              Expanded(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(
                    compact ? 10 : 12,
                    compact ? 10 : 12,
                    compact ? 6 : 8,
                    compact ? 10 : 12,
                  ),
                  child: Row(
                    children: [
                      // Checkbox on left for compact mode
                      if (compact) ...[
                        CompletionCheckbox(
                          isDone: isDone,
                          color: ti.color,
                          size: 22,
                          onChanged: (checked) => _toggleComplete(ref, checked),
                        ),
                        const SizedBox(width: 10),
                      ],

                      // Type icon (not in compact)
                      if (!compact) ...[
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            gradient: isInactive
                                ? null
                                : LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [
                                      ti.color.withValues(alpha: isDark ? 0.2 : 0.12),
                                      ti.color.withValues(alpha: isDark ? 0.1 : 0.05),
                                    ],
                                  ),
                            color: isInactive
                                ? (isDark
                                    ? Colors.white.withValues(alpha: 0.05)
                                    : Colors.black.withValues(alpha: 0.04))
                                : null,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            ti.icon,
                            color: isInactive
                                ? (isDark
                                    ? AppColors.darkTextTertiary
                                    : AppColors.textTertiary)
                                : ti.color,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                      ],

                      // Title + metadata
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              task.title.isNotEmpty ? task.title : 'Untitled Task',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleSmall
                                  ?.copyWith(
                                    fontWeight: FontWeight.w600,
                                    fontSize: compact ? 13 : 14,
                                    decoration: isDone
                                        ? TextDecoration.lineThrough
                                        : null,
                                    color: isInactive
                                        ? (isDark
                                            ? AppColors.darkTextTertiary
                                            : AppColors.textTertiary)
                                        : (isDark
                                            ? AppColors.darkTextPrimary
                                            : AppColors.textPrimary),
                                    height: 1.2,
                                  ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 5),
                            Row(
                              children: [
                                // Type pill
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: isInactive
                                        ? (isDark
                                            ? Colors.white.withValues(alpha: 0.06)
                                            : Colors.black.withValues(alpha: 0.04))
                                        : ti.color.withValues(
                                            alpha: isDark ? 0.15 : 0.08),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    ti.label,
                                    style: TextStyle(
                                      color: isInactive
                                          ? (isDark
                                              ? AppColors.darkTextTertiary
                                              : AppColors.textTertiary)
                                          : ti.color,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                // Duration
                                Icon(
                                  Icons.schedule_rounded,
                                  size: 12,
                                  color: isDark
                                      ? AppColors.darkTextTertiary
                                      : AppColors.textTertiary,
                                ),
                                const SizedBox(width: 2),
                                Text(
                                  AppDateUtils.formatDuration(task.estMinutes),
                                  style: TextStyle(
                                    color: isDark
                                        ? AppColors.darkTextTertiary
                                        : AppColors.textTertiary,
                                    fontSize: 11,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                // Difficulty
                                if (!isInactive)
                                  DifficultyIndicator(
                                    difficulty: task.difficulty,
                                    compact: true,
                                  ),
                                // Skipped badge
                                if (isSkipped) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.warning
                                          .withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: const Text(
                                      'Skipped',
                                      style: TextStyle(
                                        color: AppColors.warning,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                                // Pinned indicator
                                if (task.isPinned && !isInactive) ...[
                                  const SizedBox(width: 4),
                                  Icon(
                                    Icons.push_pin_rounded,
                                    size: 12,
                                    color: AppColors.primary,
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),

                      // Right side: chevron + checkbox (full mode)
                      if (!compact) ...[
                        if (!isInactive)
                          Icon(
                            Icons.chevron_right_rounded,
                            color: isDark
                                ? AppColors.darkTextTertiary
                                : AppColors.textTertiary,
                            size: 20,
                          ),
                        const SizedBox(width: 2),
                        CompletionCheckbox(
                          isDone: isDone,
                          color: ti.color,
                          onChanged: (checked) => _toggleComplete(ref, checked),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _toggleComplete(WidgetRef ref, bool checked) {
    final uid = ref.read(uidProvider);
    if (uid == null) return;
    if (checked) {
      ref.read(firestoreServiceProvider).completeTask(uid, task.id);
    } else {
      ref.read(firestoreServiceProvider).uncompleteTask(uid, task.id);
    }
  }

  void _openTask(BuildContext context) {
    final sectionId =
        task.sectionIds.isNotEmpty ? task.sectionIds.first : null;

    if (sectionId == null || sectionId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('This task has no linked section yet')),
      );
      return;
    }

    switch (task.type) {
      case 'STUDY':
      case 'REVIEW':
        GoRouter.of(context).push('/study/${task.id}/$sectionId');
      case 'QUESTIONS':
      case 'MOCK':
        GoRouter.of(context).push('/quiz/$sectionId');
      default:
        GoRouter.of(context).push('/study/${task.id}/$sectionId');
    }
  }

  Future<void> _reschedule(BuildContext context, WidgetRef ref) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: task.dueDate.add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null && context.mounted) {
      final uid = ref.read(uidProvider);
      if (uid != null) {
        try {
          await ref.read(firestoreServiceProvider).updateTask(
            uid,
            task.id,
            {'dueDate': picked},
          );
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Task rescheduled')),
            );
          }
        } catch (e) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                    'Failed to reschedule: ${ErrorHandler.userMessage(e)}'),
              ),
            );
          }
        }
      }
    }
  }

  void _skip(WidgetRef ref) {
    final uid = ref.read(uidProvider);
    if (uid != null) {
      ref.read(firestoreServiceProvider).updateTask(
        uid,
        task.id,
        {'status': 'SKIPPED'},
      );
    }
  }

  void _pin(WidgetRef ref) {
    final uid = ref.read(uidProvider);
    if (uid != null) {
      ref.read(firestoreServiceProvider).updateTask(
        uid,
        task.id,
        {'isPinned': !task.isPinned},
      );
    }
  }
}
