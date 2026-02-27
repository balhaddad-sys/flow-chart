// FILE: lib/src/features/results/screens/results_screen.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';

/// Quiz results screen — pushed via Navigator from QuizScreen (not in shell).
///
/// Shows:
///   - Big percentage ring
///   - Grade label (Excellent / Good / Keep Practicing / Needs Work)
///   - Correct / total counts
///   - Stats row (total, correct, incorrect)
///   - Weak topics list (if any)
///   - Action buttons: Practice Again · View Plan · Go Home
class ResultsScreen extends StatelessWidget {
  final int correct;
  final int total;
  final List<String> weakTopics;
  final String courseId;

  const ResultsScreen({
    super.key,
    required this.correct,
    required this.total,
    required this.weakTopics,
    required this.courseId,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final pct = total > 0 ? (correct / total * 100).round() : 0;
    final progress = total > 0 ? correct / total : 0.0;
    final incorrect = total - correct;

    final _Grade grade = _gradeFor(pct);

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Score ring ────────────────────────────────────────────────
              Center(
                child: _ScoreRing(
                  progress: progress,
                  pct: pct,
                  isDark: isDark,
                ),
              ),
              const SizedBox(height: 20),

              // ── Grade label ────────────────────────────────────────────────
              Center(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(grade.icon, size: 22, color: grade.color),
                    const SizedBox(width: 8),
                    Text(
                      grade.label,
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: grade.color,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 6),
              Center(
                child: Text(
                  '$correct out of $total correct',
                  style: TextStyle(
                    fontSize: 14,
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
                ),
              ),
              const SizedBox(height: 28),

              // ── Stats row ──────────────────────────────────────────────────
              Row(
                children: [
                  _StatBox(
                    icon: Icons.quiz_outlined,
                    value: '$total',
                    label: 'Questions',
                    color: AppColors.primary,
                    isDark: isDark,
                  ),
                  const SizedBox(width: 10),
                  _StatBox(
                    icon: Icons.check_circle_outline_rounded,
                    value: '$correct',
                    label: 'Correct',
                    color: AppColors.success,
                    isDark: isDark,
                  ),
                  const SizedBox(width: 10),
                  _StatBox(
                    icon: Icons.cancel_outlined,
                    value: '$incorrect',
                    label: 'Incorrect',
                    color: AppColors.error,
                    isDark: isDark,
                  ),
                ],
              ),

              // ── Weak topics ────────────────────────────────────────────────
              if (weakTopics.isNotEmpty) ...[
                const SizedBox(height: 28),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.darkSurface : AppColors.surface,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                    border: Border.all(
                      color: AppColors.warning.withValues(alpha: 0.35),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.warning_amber_rounded,
                              size: 16, color: AppColors.warning),
                          const SizedBox(width: 6),
                          Text(
                            'Weak Areas to Review',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.warning,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: weakTopics.take(10).map((topic) {
                          return Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.warning.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(
                                  AppSpacing.radiusFull),
                              border: Border.all(
                                color:
                                    AppColors.warning.withValues(alpha: 0.25),
                              ),
                            ),
                            child: Text(
                              topic,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: isDark
                                    ? const Color(0xFFFBBF24)
                                    : AppColors.warning,
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 36),

              // ── Actions ────────────────────────────────────────────────────
              // Practice Again
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.replay_rounded, size: 18),
                  label: const Text('Practice Again'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                    textStyle: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Secondary actions row
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => context.go('/planner'),
                      icon: const Icon(Icons.calendar_today_outlined, size: 15),
                      label: const Text('View Plan'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primary,
                        side: BorderSide(
                          color: AppColors.primary.withValues(alpha: 0.4),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppSpacing.radiusMd),
                        ),
                        textStyle: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => context.go('/today'),
                      icon: const Icon(Icons.home_outlined, size: 15),
                      label: const Text('Go Home'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                        side: BorderSide(
                          color: isDark
                              ? AppColors.darkBorder
                              : AppColors.border,
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppSpacing.radiusMd),
                        ),
                        textStyle: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  _Grade _gradeFor(int pct) {
    if (pct >= 80) {
      return _Grade(
        label: 'Excellent!',
        color: AppColors.success,
        icon: Icons.emoji_events_rounded,
      );
    } else if (pct >= 60) {
      return _Grade(
        label: 'Good',
        color: AppColors.primary,
        icon: Icons.thumb_up_alt_rounded,
      );
    } else if (pct >= 40) {
      return _Grade(
        label: 'Keep Practicing',
        color: AppColors.warning,
        icon: Icons.trending_up_rounded,
      );
    } else {
      return _Grade(
        label: 'Needs Work',
        color: AppColors.error,
        icon: Icons.school_rounded,
      );
    }
  }
}

// ── Score ring ────────────────────────────────────────────────────────────────

class _ScoreRing extends StatelessWidget {
  final double progress;
  final int pct;
  final bool isDark;

  const _ScoreRing({
    required this.progress,
    required this.pct,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    const size = 148.0;
    const strokeWidth = 10.0;

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Background track
          SizedBox(
            width: size,
            height: size,
            child: CircularProgressIndicator(
              value: 1.0,
              strokeWidth: strokeWidth,
              valueColor: AlwaysStoppedAnimation<Color>(
                isDark
                    ? AppColors.darkSurfaceVariant
                    : AppColors.surfaceVariant,
              ),
            ),
          ),
          // Foreground arc
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: progress),
            duration: const Duration(milliseconds: 900),
            curve: Curves.easeOutCubic,
            builder: (_, val, __) => SizedBox(
              width: size,
              height: size,
              child: CircularProgressIndicator(
                value: val,
                strokeWidth: strokeWidth,
                strokeCap: StrokeCap.round,
                valueColor: const AlwaysStoppedAnimation<Color>(
                  AppColors.primaryLight,
                ),
              ),
            ),
          ),
          // Label
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TweenAnimationBuilder<int>(
                tween: IntTween(begin: 0, end: pct),
                duration: const Duration(milliseconds: 900),
                curve: Curves.easeOutCubic,
                builder: (_, val, __) => Text(
                  '$val%',
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primaryLight,
                    height: 1.0,
                  ),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'Accuracy',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Stat box ──────────────────────────────────────────────────────────────────

class _StatBox extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color color;
  final bool isDark;

  const _StatBox({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(
            color: isDark ? AppColors.darkBorder : AppColors.border,
          ),
        ),
        child: Column(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
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

// ── Grade data ────────────────────────────────────────────────────────────────

class _Grade {
  final String label;
  final Color color;
  final IconData icon;

  const _Grade({required this.label, required this.color, required this.icon});
}
