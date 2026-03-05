import 'package:flutter/material.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';

class SummaryDashboard extends StatelessWidget {
  final int doneCount;
  final int totalCount;
  final int studyCount;
  final int quizCount;
  final int reviewCount;
  final int totalMinutes;
  final int todayDone;
  final int todayTotal;

  const SummaryDashboard({
    super.key,
    required this.doneCount,
    required this.totalCount,
    required this.studyCount,
    required this.quizCount,
    required this.reviewCount,
    required this.totalMinutes,
    required this.todayDone,
    required this.todayTotal,
  });

  @override
  Widget build(BuildContext context) {
    final pct = totalCount > 0 ? doneCount / totalCount : 0.0;
    final todayPct = todayTotal > 0 ? todayDone / todayTotal : 0.0;
    final hours = totalMinutes ~/ 60;
    final mins = totalMinutes % 60;

    return Container(
      margin: const EdgeInsets.fromLTRB(20, 12, 20, 8),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppColors.heroGradient,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.25),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          // Top row: main progress + mini stats
          Row(
            children: [
              // Main completion ring
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: pct),
                duration: AppSpacing.animSlow,
                curve: Curves.easeOutCubic,
                builder: (_, value, __) => CircularPercentIndicator(
                  radius: 40,
                  lineWidth: 6,
                  percent: value.clamp(0, 1),
                  center: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${(value * 100).round()}%',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const Text(
                        'done',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                  progressColor: Colors.white,
                  backgroundColor: Colors.white.withValues(alpha: 0.2),
                  circularStrokeCap: CircularStrokeCap.round,
                ),
              ),
              const SizedBox(width: 20),

              // Stats column
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Today's progress
                    Row(
                      children: [
                        CircularPercentIndicator(
                          radius: 14,
                          lineWidth: 3,
                          percent: todayPct.clamp(0, 1),
                          progressColor: Colors.white,
                          backgroundColor: Colors.white.withValues(alpha: 0.2),
                          circularStrokeCap: CircularStrokeCap.round,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Today: $todayDone/$todayTotal',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    // Total time
                    Row(
                      children: [
                        const Icon(Icons.schedule_rounded,
                            color: Colors.white70, size: 16),
                        const SizedBox(width: 6),
                        Text(
                          hours > 0 ? '${hours}h ${mins}m total' : '${mins}m total',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    // Task count
                    Row(
                      children: [
                        const Icon(Icons.check_circle_outline_rounded,
                            color: Colors.white70, size: 16),
                        const SizedBox(width: 6),
                        Text(
                          '$doneCount of $totalCount completed',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Bottom row: type breakdown pills
          Row(
            children: [
              _TypePill(label: 'Study', count: studyCount, color: Colors.white),
              const SizedBox(width: 6),
              _TypePill(
                  label: 'Quiz',
                  count: quizCount,
                  color: Colors.white),
              const SizedBox(width: 6),
              _TypePill(
                  label: 'Review',
                  count: reviewCount,
                  color: Colors.white),
            ],
          ),
        ],
      ),
    );
  }
}

class _TypePill extends StatelessWidget {
  final String label;
  final int count;
  final Color color;

  const _TypePill({
    required this.label,
    required this.count,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            Text(
              '$count',
              style: TextStyle(
                color: color,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 1),
            Text(
              label,
              style: TextStyle(
                color: color.withValues(alpha: 0.8),
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
