// FILE: lib/src/features/home/widgets/stats_cards.dart

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../providers/home_provider.dart';

class StatsCards extends ConsumerWidget {
  final String courseId;

  const StatsCards({super.key, required this.courseId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(courseStatsProvider(courseId));
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return statsAsync.when(
      loading: () => _buildSkeleton(isDark),
      error: (_, __) => _buildSkeleton(isDark),
      data: (stats) {
        if (stats == null) return _buildSkeleton(isDark);

        final accuracy = (stats.overallAccuracy * 100).toInt();
        final answered = stats.totalQuestionsAnswered;
        final totalMinutes = stats.totalStudyMinutes;

        return Row(
          children: [
            // Accuracy card
            Expanded(
              child: _StatCard(
                isDark: isDark,
                icon: Icons.track_changes_rounded,
                iconColor: AppColors.primary,
                iconBg: AppColors.primary.withValues(alpha: 0.10),
                value: '$accuracy%',
                label: 'Accuracy',
                sublabel: answered > 0 ? '$answered Qs' : 'No attempts',
              ),
            ),
            const SizedBox(width: 8),
            // Questions card
            Expanded(
              child: _StatCard(
                isDark: isDark,
                icon: Icons.quiz_outlined,
                iconColor: const Color(0xFF7C3AED),
                iconBg: const Color(0xFF7C3AED).withValues(alpha: 0.10),
                value: '$answered',
                label: 'Questions',
                sublabel: answered == 1 ? '1 answered' : '$answered answered',
              ),
            ),
            const SizedBox(width: 8),
            // Study time card
            Expanded(
              child: _StatCard(
                isDark: isDark,
                icon: Icons.timer_outlined,
                iconColor: const Color(0xFF0891B2),
                iconBg: const Color(0xFF0891B2).withValues(alpha: 0.10),
                value: _formatMinutes(totalMinutes),
                label: 'Study Time',
                sublabel: 'This course',
              ),
            ),
          ],
        );
      },
    );
  }

  static String _formatMinutes(int minutes) {
    if (minutes == 0) return '0m';
    final hours = minutes ~/ 60;
    final mins = minutes % 60;
    if (hours == 0) return '${mins}m';
    if (mins == 0) return '${hours}h';
    return '${hours}h ${mins}m';
  }

  Widget _buildSkeleton(bool isDark) {
    return Row(
      children: List.generate(3, (i) {
        return Expanded(
          child: Container(
            margin: EdgeInsets.only(left: i == 0 ? 0 : 8),
            height: 96,
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkSurface : AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              border: Border.all(
                color: isDark ? AppColors.darkBorder : AppColors.border,
              ),
            ),
          ),
        );
      }),
    );
  }
}

class _StatCard extends StatelessWidget {
  final bool isDark;
  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String value;
  final String label;
  final String sublabel;

  const _StatCard({
    required this.isDark,
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.value,
    required this.label,
    required this.sublabel,
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
          // Icon circle
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, color: iconColor, size: 18),
          ),
          const SizedBox(height: 10),
          // Value
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.3,
                ),
          ),
          const SizedBox(height: 2),
          // Label
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
          ),
        ],
      ),
    );
  }
}
