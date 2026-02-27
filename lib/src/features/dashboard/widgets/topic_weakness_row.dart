// FILE: lib/src/features/dashboard/widgets/topic_weakness_row.dart
import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../models/stats_model.dart';

/// A row displaying a single topic's weakness data with an animated progress
/// bar and a practice shortcut button.
///
/// Can be used with individual [topic], [weaknessScore], and [accuracy]
/// values (new API) or with a [WeakTopic] model (legacy API).
class TopicWeaknessRow extends StatelessWidget {
  /// Topic name string — used in the new callers.
  final String? topic;

  /// Weakness score 0-1 — used in the new callers.
  final double? weaknessScore;

  /// Accuracy 0-1 — used in the new callers.
  final double? accuracy;

  /// Called when user taps "Practice". May be null.
  final VoidCallback? onPractice;

  /// Legacy: full WeakTopic model. Used by old callers.
  final WeakTopic? weakTopic;

  const TopicWeaknessRow({
    super.key,
    this.topic,
    this.weaknessScore,
    this.accuracy,
    this.onPractice,
    this.weakTopic,
  }) : assert(
          (topic != null && weaknessScore != null && accuracy != null) ||
              weakTopic != null,
          'Provide either (topic + weaknessScore + accuracy) or weakTopic.',
        );

  String get _tag => topic ?? weakTopic!.tag;
  double get _weakness => weaknessScore ?? weakTopic!.weaknessScore;
  double get _accuracy => accuracy ?? weakTopic!.accuracy;

  Color get _accuracyColor {
    if (_accuracy < 0.4) return AppColors.error;
    if (_accuracy < 0.7) return AppColors.warning;
    return AppColors.success;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accuracyPct = (_accuracy * 100).round();

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: AppSpacing.cardPadding,
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
          // ── Top row: topic + accuracy badge + practice button ────────
          Row(
            children: [
              Expanded(
                child: Text(
                  _tag,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
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
                  color: _accuracyColor.withValues(alpha: 0.1),
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusSm),
                ),
                child: Text(
                  '$accuracyPct%',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: _accuracyColor,
                  ),
                ),
              ),
              if (onPractice != null) ...[
                const SizedBox(width: 8),
                // Practice button
                _PracticeButton(onPressed: onPractice!),
              ],
            ],
          ),
          AppSpacing.gapSm,

          // ── Weakness progress bar (animated on appear) ───────────────
          _AnimatedWeaknessBar(
            weaknessScore: _weakness,
            isDark: isDark,
          ),
          const SizedBox(height: 4),

          // ── Weakness label ────────────────────────────────────────────
          Row(
            children: [
              Text(
                'Weakness: ${(_weakness * 100).toInt()}%',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: isDark
                          ? AppColors.darkTextTertiary
                          : AppColors.textTertiary,
                    ),
              ),
              const Spacer(),
              Text(
                'Accuracy: $accuracyPct%',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: _accuracyColor,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Practice button ───────────────────────────────────────────────────────────

class _PracticeButton extends StatelessWidget {
  final VoidCallback onPressed;

  const _PracticeButton({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 30,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          padding:
              const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
          side: BorderSide(
            color: AppColors.primary.withValues(alpha: 0.35),
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
          ),
          textStyle: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Text('Practice'),
            SizedBox(width: 3),
            Icon(Icons.arrow_forward_rounded, size: 12),
          ],
        ),
      ),
    );
  }
}

// ── Animated weakness bar ─────────────────────────────────────────────────────

class _AnimatedWeaknessBar extends StatefulWidget {
  final double weaknessScore;
  final bool isDark;

  const _AnimatedWeaknessBar({
    required this.weaknessScore,
    required this.isDark,
  });

  @override
  State<_AnimatedWeaknessBar> createState() => _AnimatedWeaknessBarState();
}

class _AnimatedWeaknessBarState extends State<_AnimatedWeaknessBar>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _animation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    );
    // Slight delay so it animates after appearing on screen
    Future.delayed(const Duration(milliseconds: 100), () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void didUpdateWidget(_AnimatedWeaknessBar old) {
    super.didUpdateWidget(old);
    if (old.weaknessScore != widget.weaknessScore) {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Color get _barColor {
    final score = widget.weaknessScore;
    if (score >= 0.7) return AppColors.error;
    if (score >= 0.4) return AppColors.warning;
    return AppColors.success;
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (_, __) {
        final value =
            (widget.weaknessScore * _animation.value).clamp(0.0, 1.0);
        return ClipRRect(
          borderRadius:
              BorderRadius.circular(AppSpacing.radiusFull),
          child: LinearProgressIndicator(
            value: value,
            minHeight: 7,
            backgroundColor: widget.isDark
                ? AppColors.darkSurfaceVariant
                : AppColors.surfaceVariant,
            valueColor: AlwaysStoppedAnimation<Color>(_barColor),
          ),
        );
      },
    );
  }
}
