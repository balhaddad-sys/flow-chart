import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../models/course_model.dart';
import '../providers/home_provider.dart';
import '../widgets/exam_countdown.dart';
import '../widgets/stats_cards.dart';
import '../widgets/today_checklist.dart';
import '../widgets/weak_topics_banner.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(coursesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                gradient: AppColors.primaryGradient,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.school_rounded, color: Colors.white, size: 18),
            ),
            AppSpacing.hGapSm,
            const Text('MedQ'),
          ],
        ),
        actions: [
          _AppBarAction(
            icon: Icons.add_rounded,
            tooltip: 'New Course',
            onPressed: () => context.go('/onboarding'),
          ),
          _AppBarAction(
            icon: Icons.library_books_outlined,
            tooltip: 'Library',
            onPressed: () => context.go('/library'),
          ),
          _AppBarAction(
            icon: Icons.insights_rounded,
            tooltip: 'Analytics',
            onPressed: () => context.go('/dashboard'),
          ),
          _AppBarAction(
            icon: Icons.settings_outlined,
            tooltip: 'Settings',
            onPressed: () => context.go('/settings'),
          ),
          const SizedBox(width: 8),
        ],
      ),
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
                  ) ?? courses.first
              : courses.first;
          final activeCourseId = activeCourse.id;

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(todayTasksProvider(activeCourseId));
            },
            color: AppColors.primary,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
              children: [
                // Course selector
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: DropdownButton<String>(
                          value: activeCourseId,
                          isExpanded: true,
                          underline: const SizedBox.shrink(),
                          icon: const Icon(Icons.unfold_more_rounded, size: 20),
                          style: Theme.of(context).textTheme.titleMedium,
                          items: courses
                              .map((c) => DropdownMenuItem(
                                    value: c.id,
                                    child: Text(c.title),
                                  ))
                              .toList(),
                          onChanged: (v) =>
                              ref.read(activeCourseIdProvider.notifier).state = v,
                        ),
                      ),
                    ],
                  ),
                ),
                AppSpacing.gapLg,

                // Exam countdown
                if (activeCourse.examDate != null)
                  ExamCountdown(examDate: activeCourse.examDate!),
                if (activeCourse.examDate != null) AppSpacing.gapLg,

                // Stats cards
                StatsCards(courseId: activeCourseId),
                AppSpacing.gapLg,

                // Section header
                Row(
                  children: [
                    Text(
                      'Today\'s Plan',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: () => context.go('/planner'),
                      icon: const Icon(Icons.calendar_today_rounded, size: 16),
                      label: const Text('Full Plan'),
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.primary,
                      ),
                    ),
                  ],
                ),
                AppSpacing.gapSm,
                TodayChecklist(courseId: activeCourseId),
                AppSpacing.gapLg,

                // Weak topics banner
                WeakTopicsBanner(courseId: activeCourseId),
              ],
            ),
          );
        },
      ),
      floatingActionButton: Container(
        decoration: BoxDecoration(
          gradient: AppColors.primaryGradient,
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.3),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: FloatingActionButton(
          onPressed: () => context.go('/planner'),
          backgroundColor: Colors.transparent,
          elevation: 0,
          child: const Icon(Icons.calendar_month_rounded, color: Colors.white),
        ),
      ),
    );
  }
}

class _AppBarAction extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  const _AppBarAction({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: IconButton(
        icon: Icon(icon, size: 22),
        tooltip: tooltip,
        onPressed: onPressed,
        style: IconButton.styleFrom(
          foregroundColor: AppColors.textSecondary,
        ),
      ),
    );
  }
}
