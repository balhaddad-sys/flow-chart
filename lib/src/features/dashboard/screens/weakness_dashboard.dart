// FILE: lib/src/features/dashboard/screens/weakness_dashboard.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../models/stats_model.dart';
import '../../home/providers/home_provider.dart';
import '../providers/dashboard_provider.dart';
import '../widgets/fix_plan_card.dart';
import '../widgets/topic_weakness_row.dart';

class WeaknessDashboard extends ConsumerWidget {
  const WeaknessDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    var activeCourseId = ref.watch(activeCourseIdProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Fallback: pick first course if provider hasn't been set yet
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
          icon: Icons.bar_chart_rounded,
          title: 'No course selected',
          subtitle: 'Select a course to view insights.',
        ),
      );
    }

    final String courseId = activeCourseId;
    final statsAsync = ref.watch(courseStatsProvider(courseId));
    final fixPlan = ref.watch(fixPlanProvider);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.background,
      body: statsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => const Center(
          child: Text('Unable to load data. Please try again.'),
        ),
        data: (stats) {
          if (stats == null) {
            return const EmptyState(
              icon: Icons.check_circle_outline_rounded,
              title: 'No data yet',
              subtitle:
                  'Complete some questions to see your weak areas here.',
            );
          }

          return CustomScrollView(
            slivers: [
              // ── Gradient header ────────────────────────────────────────
              SliverToBoxAdapter(
                child: _GradientHeader(
                  stats: stats,
                  fixPlan: fixPlan,
                  isDark: isDark,
                ),
              ),

              // ── Body ──────────────────────────────────────────────────
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    AppSpacing.gapLg,

                    // ── Stats summary row ──────────────────────────────
                    _StatsSummaryRow(stats: stats, isDark: isDark),
                    AppSpacing.gapLg,

                    if (stats.weakestTopics.isNotEmpty) ...[
                      // ── Weak areas section header ──────────────────
                      _SectionHeader(
                        icon: Icons.trending_down_rounded,
                        iconColor: AppColors.error,
                        title: 'Weak Areas',
                        isDark: isDark,
                      ),
                      AppSpacing.gapMd,

                      // ── Topic weakness rows ────────────────────────
                      ...stats.weakestTopics
                          .where((t) => t.weaknessScore > 0.3)
                          .map(
                            (topic) => TopicWeaknessRow(
                              topic: topic.tag,
                              weaknessScore: topic.weaknessScore,
                              accuracy: topic.accuracy,
                              onPractice: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute<void>(
                                    builder: (_) =>
                                        _PracticeRedirectPage(
                                      topicTag: topic.tag,
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),

                      // If no high-weakness topics, show all
                      if (stats.weakestTopics
                          .where((t) => t.weaknessScore > 0.3)
                          .isEmpty)
                        ...stats.weakestTopics.map(
                          (topic) => TopicWeaknessRow(
                            topic: topic.tag,
                            weaknessScore: topic.weaknessScore,
                            accuracy: topic.accuracy,
                            onPractice: () {
                              Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => _PracticeRedirectPage(
                                    topicTag: topic.tag,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),

                      AppSpacing.gapLg,
                    ],

                    // ── Fix Plan button ────────────────────────────────
                    PrimaryButton(
                      label: 'Generate Remediation Plan',
                      isLoading: fixPlan.isLoading,
                      icon: Icons.auto_fix_high_rounded,
                      onPressed: () {
                        ref
                            .read(fixPlanProvider.notifier)
                            .generateFixPlan(courseId);
                      },
                    ),

                    // ── Error from fix plan ────────────────────────────
                    if (fixPlan.errorMessage != null) ...[
                      AppSpacing.gapSm,
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.sm),
                        decoration: BoxDecoration(
                          color: AppColors.error.withValues(alpha: 0.08),
                          borderRadius:
                              BorderRadius.circular(AppSpacing.radiusSm),
                          border: Border.all(
                            color:
                                AppColors.error.withValues(alpha: 0.2),
                          ),
                        ),
                        child: Text(
                          fixPlan.errorMessage!,
                          style: const TextStyle(
                            color: AppColors.error,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],

                    // ── Fix plan card ──────────────────────────────────
                    if (fixPlan.fixPlan != null) ...[
                      AppSpacing.gapMd,
                      FixPlanCard(fixPlan: fixPlan.fixPlan!),
                    ],

                    // ── Diagnostic directives ──────────────────────────
                    if (stats.diagnosticDirectives.isNotEmpty) ...[
                      AppSpacing.gapLg,
                      _DiagnosticDirectivesCard(
                        directives: stats.diagnosticDirectives,
                        isDark: isDark,
                      ),
                    ],

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

// ── Gradient header ───────────────────────────────────────────────────────────

class _GradientHeader extends StatelessWidget {
  final StatsModel stats;
  final FixPlanState fixPlan;
  final bool isDark;

  const _GradientHeader({
    required this.stats,
    required this.fixPlan,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: isDark
            ? AppColors.darkHeroGradient
            : const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppColors.primary, Color(0xFF0891B2)],
              ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Back button row
              Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.maybePop(context),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.arrow_back_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),

              // Title
              const Text(
                'Insights',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'AI-powered analysis of your weak areas',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.8),
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: AppSpacing.md),

              // Summary chips
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _HeaderChip(
                    icon: Icons.trending_down_rounded,
                    label:
                        '${stats.weakestTopics.length} weak area${stats.weakestTopics.length == 1 ? '' : 's'}',
                    color: Colors.white,
                  ),
                  if (stats.streakDays > 0)
                    _HeaderChip(
                      icon: Icons.local_fire_department_rounded,
                      label: '${stats.streakDays} day streak',
                      color: Colors.white,
                    ),
                  if (fixPlan.fixPlan != null)
                    _HeaderChip(
                      icon: Icons.auto_fix_high_rounded,
                      label: 'Plan ready',
                      color: Colors.white,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeaderChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _HeaderChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.25),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Stats summary row ─────────────────────────────────────────────────────────

class _StatsSummaryRow extends StatelessWidget {
  final StatsModel stats;
  final bool isDark;

  const _StatsSummaryRow({required this.stats, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final accuracyPct = (stats.overallAccuracy * 100).toInt();
    final completionPct = stats.completionPercent.toInt();

    return Row(
      children: [
        Expanded(
          child: _SummaryStatCard(
            value: '$accuracyPct%',
            label: 'Accuracy',
            color: _color(stats.overallAccuracy),
            isDark: isDark,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _SummaryStatCard(
            value: '${stats.totalQuestionsAnswered}',
            label: 'Questions',
            color: AppColors.secondary,
            isDark: isDark,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _SummaryStatCard(
            value: '$completionPct%',
            label: 'Complete',
            color: AppColors.primary,
            isDark: isDark,
          ),
        ),
      ],
    );
  }

  Color _color(double accuracy) {
    if (accuracy >= 0.8) return AppColors.success;
    if (accuracy >= 0.6) return AppColors.warning;
    return AppColors.error;
  }
}

class _SummaryStatCard extends StatelessWidget {
  final String value;
  final String label;
  final Color color;
  final bool isDark;

  const _SummaryStatCard({
    required this.value,
    required this.label,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: color,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
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

// ── Section header ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final bool isDark;

  const _SectionHeader({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
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
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
      ],
    );
  }
}

// ── Diagnostic directives card ────────────────────────────────────────────────

class _DiagnosticDirectivesCard extends StatelessWidget {
  final List<String> directives;
  final bool isDark;

  const _DiagnosticDirectivesCard({
    required this.directives,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.secondary.withValues(alpha: isDark ? 0.12 : 0.06),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: AppColors.secondary.withValues(alpha: isDark ? 0.2 : 0.15),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppColors.secondary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.lightbulb_outline_rounded,
                  color: AppColors.secondary,
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              Text(
                'AI Recommendations',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.secondary,
                    ),
              ),
            ],
          ),
          AppSpacing.gapMd,
          ...directives.map(
            (directive) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    margin: const EdgeInsets.only(top: 6, right: 10),
                    decoration: const BoxDecoration(
                      color: AppColors.secondary,
                      shape: BoxShape.circle,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      directive,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            height: 1.5,
                            color: isDark
                                ? AppColors.darkTextSecondary
                                : AppColors.textSecondary,
                          ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Placeholder for navigating to quiz with topic tag ─────────────────────────

class _PracticeRedirectPage extends StatelessWidget {
  final String topicTag;
  const _PracticeRedirectPage({required this.topicTag});

  @override
  Widget build(BuildContext context) {
    // This widget just pops immediately after build, routing via GoRouter
    // In practice, the navigator push is just used for feature parity;
    // the real routing can be updated to use context.go('/quiz/_all?topicTag=...')
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (context.mounted) Navigator.of(context).pop();
    });
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
