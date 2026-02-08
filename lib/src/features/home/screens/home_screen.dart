import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
        title: const Text('MedQ'),
        actions: [
          IconButton(
            icon: const Icon(Icons.library_books_outlined),
            onPressed: () => context.go('/library'),
          ),
          IconButton(
            icon: const Icon(Icons.bar_chart_outlined),
            onPressed: () => context.go('/dashboard'),
          ),
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
            child: ListView(
              padding: AppSpacing.screenPadding,
              children: [
                // Course selector (if multiple)
                if (courses.length > 1)
                  DropdownButton<String>(
                    value: activeCourseId,
                    isExpanded: true,
                    items: courses
                        .map((c) => DropdownMenuItem(
                              value: c.id,
                              child: Text(c.title),
                            ))
                        .toList(),
                    onChanged: (v) =>
                        ref.read(activeCourseIdProvider.notifier).state = v,
                  ),
                AppSpacing.gapMd,

                // Exam countdown
                if (activeCourse.examDate != null)
                  ExamCountdown(examDate: activeCourse.examDate!),
                AppSpacing.gapMd,

                // Stats cards
                StatsCards(courseId: activeCourseId),
                AppSpacing.gapMd,

                // Today's tasks
                Text(
                  'Today\'s Plan',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                AppSpacing.gapSm,
                TodayChecklist(courseId: activeCourseId),
                AppSpacing.gapMd,

                // Weak topics banner
                WeakTopicsBanner(courseId: activeCourseId),
              ],
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.go('/planner'),
        child: const Icon(Icons.calendar_month),
      ),
    );
  }
}
