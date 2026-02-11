import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/primary_button.dart';
import '../../home/providers/home_provider.dart';
import '../providers/dashboard_provider.dart';
import '../widgets/topic_weakness_row.dart';
import '../widgets/fix_plan_card.dart';

class WeaknessDashboard extends ConsumerWidget {
  const WeaknessDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    var activeCourseId = ref.watch(activeCourseIdProvider);

    // Fallback: pick the first course if the provider hasn't been set yet
    if (activeCourseId == null) {
      final courses = ref.watch(coursesProvider).valueOrNull ?? [];
      if (courses.isNotEmpty) {
        activeCourseId = courses.first.id;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          ref.read(activeCourseIdProvider.notifier).state = activeCourseId;
        });
      }
    }

    if (activeCourseId == null) {
      return const Scaffold(
        body: EmptyState(
          icon: Icons.bar_chart,
          title: 'No course selected',
        ),
      );
    }

    final String courseId = activeCourseId;
    final statsAsync = ref.watch(courseStatsProvider(courseId));
    final fixPlan = ref.watch(fixPlanProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: statsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (stats) {
          if (stats == null || stats.weakestTopics.isEmpty) {
            return const EmptyState(
              icon: Icons.check_circle_outline,
              title: 'No weak topics yet',
              subtitle: 'Complete some questions to see your weaknesses',
            );
          }

          return CustomScrollView(
            slivers: [
              // ── Gradient header ──────────────────────────────────────
              SliverToBoxAdapter(
                child: Container(
                  decoration: BoxDecoration(
                    gradient: isDark
                        ? AppColors.darkHeroGradient
                        : AppColors.subtleGradient,
                  ),
                  child: SafeArea(
                    bottom: false,
                    child: Padding(
                      padding: const EdgeInsets.only(
                        left: 20,
                        right: 20,
                        top: AppSpacing.lg,
                        bottom: AppSpacing.xl,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Insights',
                            style: Theme.of(context)
                                .textTheme
                                .headlineMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: isDark
                                      ? AppColors.darkTextPrimary
                                      : AppColors.textPrimary,
                                ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            'Focus on your weakest areas to improve faster',
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(
                                  color: isDark
                                      ? AppColors.darkTextSecondary
                                      : AppColors.textSecondary,
                                ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          // ── Summary chip row ─────────────────────────
                          Row(
                            children: [
                              _SummaryChip(
                                icon: Icons.trending_down,
                                label:
                                    '${stats.weakestTopics.length} weak topic${stats.weakestTopics.length == 1 ? '' : 's'}',
                                color: AppColors.error,
                                isDark: isDark,
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              if (fixPlan.fixPlan != null)
                                _SummaryChip(
                                  icon: Icons.auto_fix_high,
                                  label: 'Plan ready',
                                  color: AppColors.secondary,
                                  isDark: isDark,
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),

              // ── Body content ─────────────────────────────────────────
              SliverPadding(
                padding: AppSpacing.screenPadding,
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    const SizedBox(height: AppSpacing.sm),

                    // ── Section header: Weakest Topics ─────────────────
                    const _SectionHeader(
                      icon: Icons.trending_down,
                      iconColor: AppColors.error,
                      title: 'Topics Ranked by Weakness',
                    ),
                    AppSpacing.gapMd,

                    // ── Topic rows (unchanged logic) ───────────────────
                    ...stats.weakestTopics.map(
                      (topic) => TopicWeaknessRow(topic: topic),
                    ),

                    AppSpacing.gapLg,

                    // ── Generate Fix Plan button (unchanged logic) ─────
                    PrimaryButton(
                      label: 'Generate Fix Plan',
                      isLoading: fixPlan.isLoading,
                      icon: Icons.auto_fix_high,
                      onPressed: () {
                        ref
                            .read(fixPlanProvider.notifier)
                            .generateFixPlan(courseId);
                      },
                    ),

                    AppSpacing.gapMd,

                    // ── Fix plan card (unchanged logic) ────────────────
                    if (fixPlan.fixPlan != null)
                      FixPlanCard(fixPlan: fixPlan.fixPlan!),

                    AppSpacing.gapLg,
                  ]),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;

  const _SectionHeader({
    required this.icon,
    required this.iconColor,
    required this.title,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: isDark ? 0.15 : 0.1),
            borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
          ),
          child: Icon(icon, color: iconColor, size: 20),
        ),
        AppSpacing.hGapSm,
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
        ),
      ],
    );
  }
}

class _SummaryChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final bool isDark;

  const _SummaryChip({
    required this.icon,
    required this.label,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
        border: Border.all(
          color: color.withValues(alpha: isDark ? 0.25 : 0.15),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}
