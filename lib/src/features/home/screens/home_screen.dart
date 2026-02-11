import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
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
    final userAsync = ref.watch(userModelProvider);

    final greeting = _greeting();

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
                  ) ?? courses.first
              : courses.first;
          final activeCourseId = activeCourse.id;

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async {
              ref.invalidate(todayTasksProvider(activeCourseId));
            },
            child: CustomScrollView(
              slivers: [
                // ── Hero Header ─────────────────────────────────────
                SliverToBoxAdapter(
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: isDark
                          ? AppColors.darkHeroGradient
                          : AppColors.heroGradient,
                    ),
                    child: SafeArea(
                      bottom: false,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // ── Top bar ─────────────────────────────
                            Row(
                              children: [
                                Container(
                                  width: 36,
                                  height: 36,
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Center(
                                    child: Text(
                                      'M',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 18,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: -0.5,
                                      ),
                                    ),
                                  ),
                                ),
                                AppSpacing.hGapSm,
                                Text(
                                  'MedQ',
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleLarge
                                      ?.copyWith(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w700,
                                      ),
                                ),
                                const Spacer(),
                                Container(
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(
                                        AppSpacing.radiusFull),
                                  ),
                                  child: IconButton(
                                    icon: const Icon(Icons.add_rounded,
                                        color: Colors.white, size: 20),
                                    tooltip: 'New Course',
                                    onPressed: () => context.go('/onboarding'),
                                    visualDensity: VisualDensity.compact,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 20),

                            // ── Greeting ────────────────────────────
                            userAsync.when(
                              data: (user) {
                                final name =
                                    user?.name.split(' ').first ?? '';
                                return Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '$greeting${name.isNotEmpty ? ', $name' : ''}',
                                      style: Theme.of(context)
                                          .textTheme
                                          .headlineMedium
                                          ?.copyWith(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w700,
                                          ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Let\'s make today count.',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyMedium
                                          ?.copyWith(
                                            color: Colors.white70,
                                          ),
                                    ),
                                  ],
                                );
                              },
                              loading: () => Text(
                                greeting,
                                style: Theme.of(context)
                                    .textTheme
                                    .headlineMedium
                                    ?.copyWith(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                    ),
                              ),
                              error: (_, __) => Text(
                                greeting,
                                style: Theme.of(context)
                                    .textTheme
                                    .headlineMedium
                                    ?.copyWith(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                    ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),

                // ── Content ─────────────────────────────────────────
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      // ── Course selector ───────────────────────
                      if (courses.length > 1) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 6),
                          decoration: BoxDecoration(
                            color: isDark
                                ? AppColors.darkSurface
                                : AppColors.surface,
                            borderRadius: BorderRadius.circular(
                                AppSpacing.radiusMd),
                            border: Border.all(
                              color: isDark
                                  ? AppColors.darkBorder.withValues(alpha: 0.5)
                                  : AppColors.border.withValues(alpha: 0.5),
                            ),
                            boxShadow:
                                isDark ? null : AppSpacing.shadowSm,
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(
                                  color: AppColors.primary
                                      .withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(7),
                                ),
                                child: const Icon(Icons.school_rounded,
                                    size: 16, color: AppColors.primary),
                              ),
                              AppSpacing.hGapSm,
                              Expanded(
                                child: DropdownButtonHideUnderline(
                                  child: DropdownButton<String>(
                                    value: activeCourseId,
                                    isExpanded: true,
                                    isDense: true,
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleMedium,
                                    items: courses
                                        .map((c) => DropdownMenuItem(
                                              value: c.id,
                                              child: Text(c.title),
                                            ))
                                        .toList(),
                                    onChanged: (v) => ref
                                        .read(activeCourseIdProvider
                                            .notifier)
                                        .state = v,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        AppSpacing.gapMd,
                      ],

                      // ── Exam countdown ────────────────────────
                      if (activeCourse.examDate != null) ...[
                        ExamCountdown(examDate: activeCourse.examDate!),
                        AppSpacing.gapMd,
                      ],

                      // ── Stats cards ───────────────────────────
                      StatsCards(courseId: activeCourseId),
                      const SizedBox(height: 28),

                      // ── Today's tasks ─────────────────────────
                      Row(
                        children: [
                          Text(
                            'Today\'s Plan',
                            style: Theme.of(context)
                                .textTheme
                                .titleLarge
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const Spacer(),
                          TextButton.icon(
                            onPressed: () => context.go('/planner'),
                            icon: const Icon(Icons.arrow_forward_rounded,
                                size: 16),
                            label: const Text('View All'),
                            style: TextButton.styleFrom(
                              foregroundColor: AppColors.primaryLight,
                              textStyle: Theme.of(context)
                                  .textTheme
                                  .labelLarge,
                            ),
                          ),
                        ],
                      ),
                      AppSpacing.gapSm,
                      TodayChecklist(courseId: activeCourseId),
                      AppSpacing.gapLg,

                      // ── Weak topics banner ────────────────────
                      WeakTopicsBanner(courseId: activeCourseId),
                      AppSpacing.gapLg,
                    ]),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
}
