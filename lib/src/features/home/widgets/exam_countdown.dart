// FILE: lib/src/features/home/widgets/exam_countdown.dart

import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/utils/date_utils.dart';

class ExamCountdown extends StatelessWidget {
  final DateTime examDate;

  const ExamCountdown({super.key, required this.examDate});

  @override
  Widget build(BuildContext context) {
    final daysLeft = AppDateUtils.daysUntil(examDate);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Determine urgency style
    final _CountdownStyle style;
    if (daysLeft < 0) {
      style = _CountdownStyle.passed;
    } else if (daysLeft == 0) {
      style = _CountdownStyle.today;
    } else if (daysLeft <= 7) {
      style = _CountdownStyle.urgent;
    } else if (daysLeft <= 30) {
      style = _CountdownStyle.warning;
    } else {
      style = _CountdownStyle.normal;
    }

    if (style == _CountdownStyle.passed) {
      return _PassedCard(isDark: isDark, examDate: examDate);
    }

    if (style == _CountdownStyle.today) {
      return _TodayCard(isDark: isDark);
    }

    return _CountdownCard(
      daysLeft: daysLeft,
      examDate: examDate,
      style: style,
      isDark: isDark,
    );
  }
}

enum _CountdownStyle { passed, today, urgent, warning, normal }

// ── Exam has passed card ─────────────────────────────────────────────────────

class _PassedCard extends StatelessWidget {
  final bool isDark;
  final DateTime examDate;

  const _PassedCard({required this.isDark, required this.examDate});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: isDark
                  ? AppColors.darkSurfaceVariant
                  : AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(
              Icons.event_available_rounded,
              size: 18,
              color: isDark
                  ? AppColors.darkTextTertiary
                  : AppColors.textTertiary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Exam date passed',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  AppDateUtils.formatFull(examDate),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary,
                        fontSize: 12,
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

// ── Exam is today card ────────────────────────────────────────────────────────

class _TodayCard extends StatelessWidget {
  final bool isDark;

  const _TodayCard({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: AppColors.urgentGradient,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        boxShadow: [
          BoxShadow(
            color: AppColors.error.withValues(alpha: 0.25),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.20),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.notifications_active_rounded,
              color: Colors.white,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Today is exam day!',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Good luck — you have got this!',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 12,
                      ),
                ),
              ],
            ),
          ),
          const Text(
            '🎯',
            style: TextStyle(fontSize: 24),
          ),
        ],
      ),
    );
  }
}

// ── Standard countdown card ───────────────────────────────────────────────────

class _CountdownCard extends StatelessWidget {
  final int daysLeft;
  final DateTime examDate;
  final _CountdownStyle style;
  final bool isDark;

  const _CountdownCard({
    required this.daysLeft,
    required this.examDate,
    required this.style,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final isUrgent = style == _CountdownStyle.urgent;
    final isWarning = style == _CountdownStyle.warning;

    // Determine colors based on urgency
    final Color accentColor;
    final Color accentBg;
    final Color cardBorderColor;
    final String statusLabel;

    if (isUrgent) {
      accentColor = AppColors.error;
      accentBg = AppColors.error.withValues(alpha: 0.08);
      cardBorderColor = AppColors.error.withValues(alpha: 0.25);
      statusLabel = 'Exam approaching';
    } else if (isWarning) {
      accentColor = AppColors.warning;
      accentBg = AppColors.warning.withValues(alpha: 0.08);
      cardBorderColor = AppColors.warning.withValues(alpha: 0.25);
      statusLabel = 'Exam countdown';
    } else {
      accentColor = AppColors.primary;
      accentBg = AppColors.primary.withValues(alpha: 0.08);
      cardBorderColor = isDark ? AppColors.darkBorder : AppColors.border;
      statusLabel = 'Exam countdown';
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: cardBorderColor),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Row(
        children: [
          // Icon + label
          Expanded(
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: accentBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    isUrgent
                        ? Icons.warning_amber_rounded
                        : Icons.event_rounded,
                    color: accentColor,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        statusLabel,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: accentColor,
                              fontWeight: FontWeight.w600,
                              fontSize: 11,
                            ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        AppDateUtils.formatFull(examDate),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: isDark
                                  ? AppColors.darkTextSecondary
                                  : AppColors.textSecondary,
                              fontSize: 12,
                            ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(width: 12),

          // Days pill
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: accentBg,
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              border: Border.all(
                color: accentColor.withValues(alpha: 0.20),
              ),
            ),
            child: Column(
              children: [
                Text(
                  '$daysLeft',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: accentColor,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                        height: 1,
                      ),
                ),
                Text(
                  'days',
                  style: TextStyle(
                    color: accentColor.withValues(alpha: 0.80),
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
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
