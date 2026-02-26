import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/widgets/shimmer_loading.dart';
import '../../home/providers/home_provider.dart';

class AnalyticsScreen extends ConsumerWidget {
  const AnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final courseId = ref.watch(activeCourseIdProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (courseId == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Analytics')),
        body: const Center(
          child: Text('No course selected'),
        ),
      );
    }

    final statsAsync = ref.watch(courseStatsProvider(courseId));
    final coursesAsync = ref.watch(coursesProvider);

    final activeCourse = coursesAsync.valueOrNull?.firstWhere(
      (c) => c.id == courseId,
      orElse: () => coursesAsync.valueOrNull!.first,
    );

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        title: const Text('Analytics'),
        backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
      ),
      body: statsAsync.when(
        loading: () => const _AnalyticsSkeleton(),
        error: (e, _) => Center(child: Text('Error loading analytics: $e')),
        data: (stats) {
          if (stats == null) {
            return _EmptyAnalytics(isDark: isDark);
          }

          final accuracy = stats.overallAccuracy;
          final completion = stats.completionPercent;
          final studyHours = (stats.totalStudyMinutes / 60.0);
          final studyHoursWhole = studyHours.floor();
          final studyMinutesRemainder = stats.totalStudyMinutes % 60;
          final weakTopics = stats.weakestTopics;

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async {
              ref.invalidate(courseStatsProvider(courseId));
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              children: [
                // ── Course name header ────────────────────────────────────
                if (activeCourse != null) ...[
                  Text(
                    activeCourse.title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.textSecondary,
                        ),
                  ),
                  AppSpacing.gapSm,
                ],

                // ── OVERVIEW heading ──────────────────────────────────────
                _SectionLabel(label: 'OVERVIEW', isDark: isDark),
                AppSpacing.gapSm,

                // ── Score ring row ────────────────────────────────────────
                Row(
                  children: [
                    // Accuracy ring
                    Expanded(
                      child: _MetricCard(
                        isDark: isDark,
                        child: Column(
                          children: [
                            CircularPercentIndicator(
                              radius: 48,
                              lineWidth: 7,
                              percent: accuracy.clamp(0.0, 1.0),
                              center: Text(
                                '${(accuracy * 100).round()}%',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(
                                      fontWeight: FontWeight.w700,
                                      color: _accuracyColor(accuracy),
                                    ),
                              ),
                              progressColor: _accuracyColor(accuracy),
                              backgroundColor: isDark
                                  ? AppColors.darkSurfaceVariant
                                  : AppColors.surfaceVariant,
                              circularStrokeCap: CircularStrokeCap.round,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Accuracy',
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(
                                    color: isDark
                                        ? AppColors.darkTextSecondary
                                        : AppColors.textSecondary,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Completion ring
                    Expanded(
                      child: _MetricCard(
                        isDark: isDark,
                        child: Column(
                          children: [
                            CircularPercentIndicator(
                              radius: 48,
                              lineWidth: 7,
                              percent: completion.clamp(0.0, 1.0),
                              center: Text(
                                '${(completion * 100).round()}%',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.primary,
                                    ),
                              ),
                              progressColor: AppColors.primary,
                              backgroundColor: isDark
                                  ? AppColors.darkSurfaceVariant
                                  : AppColors.surfaceVariant,
                              circularStrokeCap: CircularStrokeCap.round,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Completion',
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(
                                    color: isDark
                                        ? AppColors.darkTextSecondary
                                        : AppColors.textSecondary,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                AppSpacing.gapMd,

                // ── Stats tiles row ───────────────────────────────────────
                Row(
                  children: [
                    Expanded(
                      child: _StatTile(
                        isDark: isDark,
                        icon: Icons.timer_outlined,
                        iconColor: AppColors.accent,
                        value:
                            studyHoursWhole > 0
                                ? '${studyHoursWhole}h ${studyMinutesRemainder}m'
                                : '${stats.totalStudyMinutes}m',
                        label: 'Total Study Time',
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _StatTile(
                        isDark: isDark,
                        icon: Icons.quiz_outlined,
                        iconColor: AppColors.secondary,
                        value: '${stats.totalQuestionsAnswered}',
                        label: 'Questions Done',
                      ),
                    ),
                  ],
                ),
                AppSpacing.gapMd,
                Row(
                  children: [
                    Expanded(
                      child: _StatTile(
                        isDark: isDark,
                        icon: Icons.local_fire_department_outlined,
                        iconColor: AppColors.warning,
                        value: '${stats.streakDays}',
                        label: 'Day Streak',
                      ),
                    ),
                    const SizedBox(width: 12),
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
                ),
                AppSpacing.gapLg,

                // ── Weak Topics ───────────────────────────────────────────
                _SectionLabel(label: 'TOPIC PERFORMANCE', isDark: isDark),
                AppSpacing.gapSm,

                if (weakTopics.isEmpty)
                  _MetricCard(
                    isDark: isDark,
                    child: Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: AppColors.success.withValues(alpha: 0.12),
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
                  _MetricCard(
                    isDark: isDark,
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: List.generate(weakTopics.length, (i) {
                        final topic = weakTopics[i];
                        final acc = topic.accuracy;
                        final color = _accuracyColor(acc);
                        return Column(
                          children: [
                            if (i > 0)
                              Divider(
                                height: 1,
                                color: isDark
                                    ? AppColors.darkDivider
                                    : AppColors.divider,
                              ),
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 12),
                              child: Row(
                                children: [
                                  // Rank badge
                                  Container(
                                    width: 28,
                                    height: 28,
                                    decoration: BoxDecoration(
                                      color: color.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Center(
                                      child: Text(
                                        '${i + 1}',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: color,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          topic.tag,
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall
                                              ?.copyWith(
                                                fontWeight: FontWeight.w600,
                                                fontSize: 13,
                                              ),
                                        ),
                                        const SizedBox(height: 4),
                                        ClipRRect(
                                          borderRadius:
                                              BorderRadius.circular(99),
                                          child: LinearProgressIndicator(
                                            value: acc.clamp(0.0, 1.0),
                                            backgroundColor: isDark
                                                ? AppColors.darkSurfaceVariant
                                                : AppColors.surfaceVariant,
                                            color: color,
                                            minHeight: 4,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    '${(acc * 100).round()}%',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: color,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        );
                      }),
                    ),
                  ),
                AppSpacing.gapLg,

                // ── Accuracy legend ───────────────────────────────────────
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
                          isDark: isDark),
                      const SizedBox(height: 8),
                      _LegendRow(
                          color: AppColors.warning,
                          label: '60–79%',
                          description: 'Good — review regularly',
                          isDark: isDark),
                      const SizedBox(height: 8),
                      _LegendRow(
                          color: AppColors.error,
                          label: '0–59%',
                          description: 'Needs focus — targeted practice',
                          isDark: isDark),
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

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyAnalytics extends StatelessWidget {
  final bool isDark;
  const _EmptyAnalytics({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
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
              'Answer questions and study sessions to see your analytics here.',
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
        ShimmerLoading(height: 160),
        SizedBox(height: 12),
        ShimmerLoading(height: 80),
        SizedBox(height: 12),
        ShimmerLoading(height: 80),
        SizedBox(height: 12),
        ShimmerLoading(height: 200),
      ],
    );
  }
}

// ── Reusable widgets ──────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String label;
  final bool isDark;
  const _SectionLabel({required this.label, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.0,
            fontSize: 11,
          ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  final bool isDark;
  final Widget child;
  final EdgeInsetsGeometry? padding;

  const _MetricCard({
    required this.isDark,
    required this.child,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
      ),
      child: child,
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
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 16, color: iconColor),
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.5,
                ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                  fontSize: 11,
                ),
          ),
        ],
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
