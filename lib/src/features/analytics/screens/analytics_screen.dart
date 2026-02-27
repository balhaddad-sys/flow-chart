// FILE: lib/src/features/analytics/screens/analytics_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/widgets/shimmer_loading.dart';
import '../../home/providers/home_provider.dart';
import '../../../models/stats_model.dart';

class AnalyticsScreen extends ConsumerWidget {
  const AnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    var courseId = ref.watch(activeCourseIdProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Auto-select first course
    if (courseId == null) {
      final courses = ref.watch(coursesProvider).valueOrNull ?? [];
      if (courses.isNotEmpty) {
        courseId = courses.first.id;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          ref.read(activeCourseIdProvider.notifier).state = courseId;
        });
      }
    }

    if (courseId == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Analytics'),
          backgroundColor:
              isDark ? AppColors.darkBackground : AppColors.background,
        ),
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        body: const Center(child: Text('No course selected')),
      );
    }

    final String activeCourseId = courseId;
    final statsAsync = ref.watch(courseStatsProvider(activeCourseId));
    final coursesAsync = ref.watch(coursesProvider);
    final cloudFunctions = ref.read(cloudFunctionsServiceProvider);

    final activeCourse = coursesAsync.valueOrNull
        ?.where((c) => c.id == activeCourseId)
        .firstOrNull;

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        title: const Text('Analytics'),
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        foregroundColor:
            isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      body: statsAsync.when(
        loading: () => const _AnalyticsSkeleton(),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded,
                  size: 48, color: AppColors.textTertiary),
              const SizedBox(height: 12),
              const Text('Could not load analytics'),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () =>
                    ref.invalidate(courseStatsProvider(activeCourseId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (stats) {
          if (stats == null) {
            return _EmptyAnalytics(isDark: isDark);
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async {
              ref.invalidate(courseStatsProvider(activeCourseId));
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
              children: [
                // ── Course name ──────────────────────────────────────
                if (activeCourse != null) ...[
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        activeCourse.title,
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(
                              color: isDark
                                  ? AppColors.darkTextSecondary
                                  : AppColors.textSecondary,
                              fontWeight: FontWeight.w500,
                            ),
                      ),
                    ],
                  ),
                  AppSpacing.gapMd,
                ],

                // ── Overview stat cards (3 in a row) ─────────────────
                _SectionLabel(label: 'OVERVIEW', isDark: isDark),
                AppSpacing.gapSm,
                _OverviewRow(stats: stats, isDark: isDark),
                AppSpacing.gapMd,

                // ── Progress rings row ────────────────────────────────
                Row(
                  children: [
                    Expanded(
                      child: _MetricCard(
                        isDark: isDark,
                        child: _RingMetric(
                          percent: stats.overallAccuracy.clamp(0.0, 1.0),
                          label: 'Accuracy',
                          color: _accuracyColor(stats.overallAccuracy),
                          isDark: isDark,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _MetricCard(
                        isDark: isDark,
                        child: _RingMetric(
                          percent:
                              (stats.completionPercent / 100).clamp(0.0, 1.0),
                          label: 'Completion',
                          color: AppColors.primary,
                          isDark: isDark,
                        ),
                      ),
                    ),
                  ],
                ),
                AppSpacing.gapMd,

                // ── Streak counter ────────────────────────────────────
                _StreakCard(
                  streakDays: stats.streakDays,
                  weeklyMinutes: stats.weeklyStudyMinutes,
                  isDark: isDark,
                ),
                AppSpacing.gapLg,

                // ── Weak topics ───────────────────────────────────────
                _SectionLabel(
                    label: 'AREAS NEEDING ATTENTION', isDark: isDark),
                AppSpacing.gapSm,
                if (stats.weakestTopics.isEmpty)
                  _MetricCard(
                    isDark: isDark,
                    child: Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: AppColors.success
                                .withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.check_circle_outline_rounded,
                            size: 18,
                            color: AppColors.success,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'No weak topics detected yet. Keep studying!',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                  color: isDark
                                      ? AppColors.darkTextSecondary
                                      : AppColors.textSecondary,
                                ),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  Column(
                    children: [
                      ...stats.weakestTopics.map(
                        (topic) => _WeakTopicRow(
                          topic: topic,
                          isDark: isDark,
                          onPractice: () => context.go(
                            '/quiz/_all?topicTag=${Uri.encodeComponent(topic.tag)}',
                          ),
                        ),
                      ),
                    ],
                  ),

                AppSpacing.gapMd,

                // ── Fix Plan button ───────────────────────────────────
                if (stats.weakestTopics.isNotEmpty)
                  _FixPlanButton(
                    courseId: activeCourseId,
                    cloudFunctions: cloudFunctions,
                    isDark: isDark,
                  ),
                AppSpacing.gapLg,

                // ── Accuracy guide ────────────────────────────────────
                _SectionLabel(label: 'ACCURACY GUIDE', isDark: isDark),
                AppSpacing.gapSm,
                _MetricCard(
                  isDark: isDark,
                  child: Column(
                    children: [
                      _LegendRow(
                        color: AppColors.success,
                        label: '80–100%',
                        description: 'Strong — keep it up',
                        isDark: isDark,
                      ),
                      const SizedBox(height: 8),
                      _LegendRow(
                        color: AppColors.warning,
                        label: '60–79%',
                        description: 'Good — review regularly',
                        isDark: isDark,
                      ),
                      const SizedBox(height: 8),
                      _LegendRow(
                        color: AppColors.error,
                        label: '0–59%',
                        description: 'Needs focus — targeted practice',
                        isDark: isDark,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Color _accuracyColor(double accuracy) {
    if (accuracy >= 0.8) return AppColors.success;
    if (accuracy >= 0.6) return AppColors.warning;
    return AppColors.error;
  }
}

// ── Overview row: 3 cards ─────────────────────────────────────────────────────

class _OverviewRow extends StatelessWidget {
  final StatsModel stats;
  final bool isDark;

  const _OverviewRow({required this.stats, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _StatTile(
            isDark: isDark,
            icon: Icons.quiz_outlined,
            iconColor: AppColors.secondary,
            value: '${stats.totalQuestionsAnswered}',
            label: 'Total Questions',
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _StatTile(
            isDark: isDark,
            icon: Icons.percent_rounded,
            iconColor: _accuracyColor(stats.overallAccuracy),
            value: '${(stats.overallAccuracy * 100).toInt()}%',
            label: 'Accuracy',
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _StatTile(
            isDark: isDark,
            icon: Icons.calendar_today_outlined,
            iconColor: AppColors.primary,
            value: '${stats.weeklyStudyMinutes}m',
            label: 'This Week',
          ),
        ),
      ],
    );
  }

  Color _accuracyColor(double accuracy) {
    if (accuracy >= 0.8) return AppColors.success;
    if (accuracy >= 0.6) return AppColors.warning;
    return AppColors.error;
  }
}

// ── Streak card ───────────────────────────────────────────────────────────────

class _StreakCard extends StatelessWidget {
  final int streakDays;
  final int weeklyMinutes;
  final bool isDark;

  const _StreakCard({
    required this.streakDays,
    required this.weeklyMinutes,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        gradient: streakDays > 0
            ? LinearGradient(
                colors: [
                  AppColors.warning.withValues(alpha: 0.15),
                  AppColors.warning.withValues(alpha: 0.05),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : null,
        color: streakDays == 0
            ? (isDark ? AppColors.darkSurface : AppColors.surface)
            : null,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: streakDays > 0
              ? AppColors.warning.withValues(alpha: 0.3)
              : (isDark ? AppColors.darkBorder : AppColors.border),
        ),
      ),
      child: Row(
        children: [
          Text(
            streakDays > 0 ? '🔥' : '📅',
            style: const TextStyle(fontSize: 32),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: TextSpan(
                    style: Theme.of(context).textTheme.titleLarge,
                    children: [
                      TextSpan(
                        text: '$streakDays',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: streakDays > 0
                              ? AppColors.warning
                              : (isDark
                                  ? AppColors.darkTextPrimary
                                  : AppColors.textPrimary),
                          fontSize: 28,
                          letterSpacing: -0.5,
                        ),
                      ),
                      TextSpan(
                        text: ' day streak',
                        style: TextStyle(
                          fontWeight: FontWeight.w500,
                          fontSize: 16,
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  streakDays == 0
                      ? 'Study today to start your streak!'
                      : 'Keep it up — consistency builds mastery.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Weak topic row with practice button ───────────────────────────────────────

class _WeakTopicRow extends StatelessWidget {
  final WeakTopic topic;
  final bool isDark;
  final VoidCallback onPractice;

  const _WeakTopicRow({
    required this.topic,
    required this.isDark,
    required this.onPractice,
  });

  Color get _color {
    if (topic.accuracy < 0.4) return AppColors.error;
    if (topic.accuracy < 0.7) return AppColors.warning;
    return AppColors.success;
  }

  @override
  Widget build(BuildContext context) {
    final accuracyPct = (topic.accuracy * 100).toInt();

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  topic.tag,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              // Accuracy badge
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: _color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                ),
                child: Text(
                  '$accuracyPct%',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: _color,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Practice button
              SizedBox(
                height: 28,
                child: TextButton(
                  onPressed: onPractice,
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    textStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusSm),
                      side: BorderSide(
                        color: AppColors.primary.withValues(alpha: 0.3),
                      ),
                    ),
                  ),
                  child: const Text('Practice →'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Weakness bar
          ClipRRect(
            borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
            child: LinearProgressIndicator(
              value: topic.weaknessScore.clamp(0.0, 1.0),
              backgroundColor: isDark
                  ? AppColors.darkSurfaceVariant
                  : AppColors.surfaceVariant,
              color: AppColors.error,
              minHeight: 5,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            'Weakness score: ${(topic.weaknessScore * 100).toInt()}%',
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

// ── Fix Plan button (stateful for loading) ─────────────────────────────────────

class _FixPlanButton extends StatefulWidget {
  final String courseId;
  final dynamic cloudFunctions;
  final bool isDark;

  const _FixPlanButton({
    required this.courseId,
    required this.cloudFunctions,
    required this.isDark,
  });

  @override
  State<_FixPlanButton> createState() => _FixPlanButtonState();
}

class _FixPlanButtonState extends State<_FixPlanButton> {
  bool _loading = false;

  Future<void> _run() async {
    setState(() => _loading = true);
    try {
      await widget.cloudFunctions.runFixPlan(courseId: widget.courseId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Fix plan generated! Check your planner.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to generate fix plan: $e'),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PrimaryButton(
      label: 'Generate Fix Plan',
      isLoading: _loading,
      icon: Icons.auto_fix_high_rounded,
      onPressed: _loading ? null : _run,
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyAnalytics extends StatelessWidget {
  final bool isDark;
  const _EmptyAnalytics({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primary.withValues(alpha: 0.1),
              ),
              child: const Icon(
                Icons.bar_chart_rounded,
                size: 40,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'No data yet',
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              'Start practicing to see your analytics here.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

class _AnalyticsSkeleton extends StatelessWidget {
  const _AnalyticsSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: const [
        ShimmerLoading(height: 80),
        SizedBox(height: 12),
        ShimmerLoading(height: 160),
        SizedBox(height: 12),
        ShimmerLoading(height: 80),
        SizedBox(height: 12),
        ShimmerLoading(height: 200),
      ],
    );
  }
}

// ── Shared metric card ────────────────────────────────────────────────────────

class _MetricCard extends StatelessWidget {
  final bool isDark;
  final Widget child;

  const _MetricCard({
    required this.isDark,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: child,
    );
  }
}

class _RingMetric extends StatelessWidget {
  final double percent;
  final String label;
  final Color color;
  final bool isDark;

  const _RingMetric({
    required this.percent,
    required this.label,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final pctInt = (percent * 100).round();
    return Column(
      children: [
        CircularPercentIndicator(
          radius: 48,
          lineWidth: 7,
          percent: percent,
          center: Text(
            '$pctInt%',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
          ),
          progressColor: color,
          backgroundColor: isDark
              ? AppColors.darkSurfaceVariant
              : AppColors.surfaceVariant,
          circularStrokeCap: CircularStrokeCap.round,
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.textSecondary,
              ),
        ),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  final bool isDark;
  final IconData icon;
  final Color iconColor;
  final String value;
  final String label;

  const _StatTile({
    required this.isDark,
    required this.icon,
    required this.iconColor,
    required this.value,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 15, color: iconColor),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                ),
          ),
          const SizedBox(height: 1),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                  fontSize: 10,
                ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  final bool isDark;
  const _SectionLabel({required this.label, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: isDark
                ? AppColors.darkTextSecondary
                : AppColors.textSecondary,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.0,
            fontSize: 11,
          ),
    );
  }
}

class _LegendRow extends StatelessWidget {
  final Color color;
  final String label;
  final String description;
  final bool isDark;

  const _LegendRow({
    required this.color,
    required this.label,
    required this.description,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 10),
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: color,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            description,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                  fontSize: 12,
                ),
          ),
        ),
      ],
    );
  }
}
