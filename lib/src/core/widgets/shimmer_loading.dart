import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_spacing.dart';

/// Shimmer placeholder for loading states.
class ShimmerLoading extends StatefulWidget {
  final int itemCount;

  const ShimmerLoading({super.key, this.itemCount = 3});

  @override
  State<ShimmerLoading> createState() => _ShimmerLoadingState();
}

class _ShimmerLoadingState extends State<ShimmerLoading>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Column(
          children: List.generate(
            widget.itemCount,
            (i) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: _ShimmerCard(progress: _controller.value),
            ),
          ),
        );
      },
    );
  }
}

class _ShimmerCard extends StatelessWidget {
  final double progress;

  const _ShimmerCard({required this.progress});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ShimmerBar(width: 180, height: 14, progress: progress),
          const SizedBox(height: AppSpacing.sm),
          _ShimmerBar(width: double.infinity, height: 10, progress: progress),
          const SizedBox(height: AppSpacing.xs),
          _ShimmerBar(width: 120, height: 10, progress: progress),
        ],
      ),
    );
  }
}

class _ShimmerBar extends StatelessWidget {
  final double width;
  final double height;
  final double progress;

  const _ShimmerBar({
    required this.width,
    required this.height,
    required this.progress,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(height / 2),
        gradient: LinearGradient(
          begin: Alignment(-1.0 + 2.0 * progress, 0),
          end: Alignment(-1.0 + 2.0 * progress + 1.0, 0),
          colors: const [
            AppColors.surfaceVariant,
            AppColors.border,
            AppColors.surfaceVariant,
          ],
        ),
      ),
    );
  }
}
