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
import '../../../models/task_model.dart';
import '../providers/home_provider.dart';

class TodayChecklist extends ConsumerWidget {
  final String courseId;

  const TodayChecklist({super.key, required this.courseId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasksAsync = ref.watch(todayTasksProvider(courseId));

    return tasksAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) {
        // Parse common errors for user-friendly messages
        final errorStr = e.toString().toLowerCase();

        if (errorStr.contains('no_sections') ||
            errorStr.contains('no analyzed sections')) {
          return EmptyState(
            icon: Icons.upload_file_outlined,
            title: 'Get started',
            subtitle: 'Upload your first study material to generate a personalized plan',
            actionLabel: 'Upload File',
            onAction: () {
              // Navigate to library upload
              final router = GoRouter.of(context);
              router.go('/library');
            },
          );
        }

        // Generic error fallback
        return EmptyState(
          icon: Icons.error_outline,
          title: 'Unable to load plan',
          subtitle: 'Please try again or check your connection',
          actionLabel: 'Retry',
          onAction: () => ref.invalidate(todayTasksProvider(courseId)),
        );
      },
      data: (tasks) {
        if (tasks.isEmpty) {
          return EmptyState(
            icon: Icons.check_circle_outline,
            title: 'No tasks for today',
            subtitle: 'Generate a plan to get started',
            actionLabel: 'Generate Plan',
            onAction: () async {
              try {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text('Generating study plan...')),
                  );
                }
                await ref
                    .read(cloudFunctionsServiceProvider)
                    .generateSchedule(
                      courseId: courseId,
                      availability: {},
                      revisionPolicy: 'standard',
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
            },
          );
        }

        return Column(
          children: tasks.map((task) => _TaskRow(task: task)).toList(),
        );
      },
    );
  }
}

class _TaskRow extends ConsumerWidget {
  final TaskModel task;

  const _TaskRow({required this.task});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDone = task.status == 'DONE';

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      decoration: BoxDecoration(
        color: isDone
            ? AppColors.successSurface
            : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDone
              ? AppColors.success.withValues(alpha: 0.2)
              : AppColors.border,
        ),
        boxShadow: isDone ? null : AppSpacing.shadowSm,
      ),
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        leading: GestureDetector(
          onTap: () async {
            if (!isDone) {
              final uid = ref.read(uidProvider);
              if (uid != null) {
                try {
                  await ref.read(firestoreServiceProvider).completeTask(uid, task.id);
                  if (!context.mounted) return;
                } catch (e) {
                  ErrorHandler.logError(e);
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Failed to complete task: ${e.toString()}'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              }
            }
          },
          child: Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: isDone
                  ? AppColors.success
                  : AppColors.surface,
              shape: BoxShape.circle,
              border: isDone
                  ? null
                  : Border.all(color: AppColors.border, width: 2),
            ),
            child: isDone
                ? const Icon(Icons.check_rounded,
                    color: Colors.white, size: 16)
                : null,
          ),
        ),
        title: Text(
          task.title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                decoration: isDone ? TextDecoration.lineThrough : null,
                color: isDone ? AppColors.textTertiary : AppColors.textPrimary,
              ),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Text(
            '${AppDateUtils.formatDuration(task.estMinutes)} | ${task.type}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
        trailing: _difficultyBadge(task.difficulty),
      ),
    );
  }

  Widget _difficultyBadge(int difficulty) {
    final label = difficulty <= 2
        ? 'Easy'
        : difficulty <= 3
            ? 'Med'
            : 'Hard';
    final color = difficulty <= 2
        ? AppColors.difficultyEasy
        : difficulty <= 3
            ? AppColors.difficultyMedium
            : AppColors.difficultyHard;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
