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
    final isDark = Theme.of(context).brightness == Brightness.dark;

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
              child: const Center(
                child: Text(
                  'M',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            AppSpacing.hGapSm,
            Text(
              'MedQ',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.library_books_outlined, size: 22),
            tooltip: 'Library',
            onPressed: () => context.go('/library'),
          ),
          IconButton(
            icon: const Icon(Icons.bar_chart_outlined, size: 22),
            tooltip: 'Dashboard',
            onPressed: () => context.go('/dashboard'),
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined, size: 22),
            tooltip: 'Settings',
            onPressed: () => context.go('/settings'),
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
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              children: [
                // ── Course selector ─────────────────────────────────
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.darkSurfaceVariant
                        : AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                    border: Border.all(
                      color: isDark ? AppColors.darkBorder : AppColors.border,
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.school_outlined, size: 20),
                      AppSpacing.hGapSm,
                      Expanded(
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: activeCourseId,
                            isExpanded: true,
                            isDense: true,
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
                      ),
                      Container(
                        height: 28,
                        width: 1,
                        color: isDark ? AppColors.darkBorder : AppColors.border,
                      ),
                      IconButton(
                        icon: const Icon(Icons.add, size: 20),
                        tooltip: 'New Course',
                        onPressed: () => context.go('/onboarding'),
                        visualDensity: VisualDensity.compact,
                      ),
                    ],
                  ),
                ),
                AppSpacing.gapMd,

                // ── Exam countdown ──────────────────────────────────
                if (activeCourse.examDate != null) ...[
                  ExamCountdown(examDate: activeCourse.examDate!),
                  AppSpacing.gapMd,
                ],

                // ── Stats cards ─────────────────────────────────────
                StatsCards(courseId: activeCourseId),
                AppSpacing.gapLg,

                // ── Today's tasks ───────────────────────────────────
                Row(
                  children: [
                    Text(
                      'Today\'s Plan',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: () => context.go('/planner'),
                      child: const Text('View All'),
                    ),
                  ],
                ),
                AppSpacing.gapSm,
                TodayChecklist(courseId: activeCourseId),
                AppSpacing.gapMd,

                // ── Weak topics banner ──────────────────────────────
                WeakTopicsBanner(courseId: activeCourseId),
                AppSpacing.gapLg,
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
