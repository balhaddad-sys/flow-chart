import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../models/course_model.dart';
import '../providers/home_provider.dart';
import '../widgets/exam_countdown.dart';
import '../widgets/stats_cards.dart';
import '../widgets/today_checklist.dart';
import '../widgets/weak_topics_banner.dart';

Future<void> _confirmDeleteCourse(
  BuildContext context,
  WidgetRef ref,
  CourseModel course,
) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Delete Course'),
      content: Text(
        'Delete "${course.title}" and all its tasks, files, questions, '
        'and stats? This cannot be undone.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: const Text('Cancel'),
        ),
        TextButton(
          style: TextButton.styleFrom(foregroundColor: AppColors.error),
          onPressed: () => Navigator.of(ctx).pop(true),
          child: const Text('Delete'),
        ),
      ],
    ),
  );

  if (confirmed != true) return;

  final uid = ref.read(uidProvider);
  if (uid == null) return;

  try {
    await ref.read(firestoreServiceProvider).deleteCourse(uid, course.id);
    ref.read(activeCourseIdProvider.notifier).state = null;
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('"${course.title}" deleted')),
      );
    }
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to delete: $e')),
      );
    }
  }
}

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(coursesProvider);
    final user = ref.watch(currentUserProvider);

    return Scaffold(
      body: coursesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (courses) {
          if (courses.isEmpty) {
            return EmptyState(
              icon: Icons.school_outlined,
              title: 'No courses yet',
              subtitle: 'Create a course to start studying',
              actionLabel: 'Create Course',
              onAction: () => context.go('/onboarding'),
            );
          }

          final storedId = ref.watch(activeCourseIdProvider);
          final activeCourse = storedId != null
              ? courses.cast<CourseModel?>().firstWhere(
                    (c) => c!.id == storedId,
                    orElse: () => null,
                  ) ??
                  courses.first
              : courses.first;
          final activeCourseId = activeCourse.id;

          if (ref.read(activeCourseIdProvider) != activeCourseId) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              ref.read(activeCourseIdProvider.notifier).state = activeCourseId;
            });
          }

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(todayTasksProvider(activeCourseId));
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.xl,
              ),
              children: [
                // Greeting
                _GreetingHeader(
                  name: user?.displayName ?? 'Student',
                ),
                const SizedBox(height: AppSpacing.lg),

                // Course selector card
                _CourseSelector(
                  courses: courses,
                  activeCourse: activeCourse,
                  onChanged: (id) =>
                      ref.read(activeCourseIdProvider.notifier).state = id,
                  onDelete: () => _confirmDeleteCourse(
                    context,
                    ref,
                    activeCourse,
                  ),
                  onAdd: () => context.go('/onboarding'),
                ),
                const SizedBox(height: AppSpacing.lg),

                // Exam countdown
                if (activeCourse.examDate != null) ...[
                  ExamCountdown(examDate: activeCourse.examDate!),
                  const SizedBox(height: AppSpacing.md),
                ],

                // Stats
                StatsCards(courseId: activeCourseId),
                const SizedBox(height: AppSpacing.lg),

                // Today's tasks
                Text(
                  "Today's Tasks",
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: AppSpacing.sm),
                TodayChecklist(courseId: activeCourseId),
                const SizedBox(height: AppSpacing.lg),

                // Weak topics
                WeakTopicsBanner(courseId: activeCourseId),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Greeting header
// ---------------------------------------------------------------------------

class _GreetingHeader extends StatelessWidget {
  final String name;

  const _GreetingHeader({required this.name});

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Good morning'
        : hour < 17
            ? 'Good afternoon'
            : 'Good evening';
    final firstName = name.split(' ').first;

    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$greeting,',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),
              Text(
                firstName,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: AppColors.warning.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.local_fire_department,
                  color: AppColors.warning, size: 18),
              SizedBox(width: 4),
              Text(
                'Study time!',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.warning,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Course selector card
// ---------------------------------------------------------------------------

class _CourseSelector extends StatelessWidget {
  final List<CourseModel> courses;
  final CourseModel activeCourse;
  final ValueChanged<String?> onChanged;
  final VoidCallback onDelete;
  final VoidCallback onAdd;

  const _CourseSelector({
    required this.courses,
    required this.activeCourse,
    required this.onChanged,
    required this.onDelete,
    required this.onAdd,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
            ),
            child: const Icon(Icons.school, color: AppColors.primary, size: 22),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: activeCourse.id,
                isExpanded: true,
                isDense: true,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                items: courses
                    .map((c) => DropdownMenuItem(
                          value: c.id,
                          child: Text(c.title),
                        ))
                    .toList(),
                onChanged: onChanged,
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, size: 20),
            color: AppColors.textTertiary,
            tooltip: 'Delete course',
            onPressed: onDelete,
            visualDensity: VisualDensity.compact,
          ),
          IconButton(
            icon: const Icon(Icons.add, size: 20),
            color: AppColors.primary,
            tooltip: 'New course',
            onPressed: onAdd,
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }
}
