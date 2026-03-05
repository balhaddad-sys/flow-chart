import 'package:flutter/material.dart';

import '../constants/app_spacing.dart';
import 'shimmer_loading.dart';

// ── Home Screen Skeleton ─────────────────────────────────────────────────────

class HomeScreenSkeleton extends StatelessWidget {
  const HomeScreenSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const SafeArea(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(height: AppSpacing.lg),
            // Greeting
            ShimmerLoading(width: 200, height: 28),
            SizedBox(height: 6),
            ShimmerLoading(width: 140, height: 16),
            SizedBox(height: AppSpacing.xl),
            // CTA card
            ShimmerLoading(height: 100, borderRadius: 16),
            SizedBox(height: AppSpacing.lg),
            // Stats grid (2x2)
            Row(
              children: [
                Expanded(child: ShimmerLoading(height: 100, borderRadius: 12)),
                SizedBox(width: 10),
                Expanded(child: ShimmerLoading(height: 100, borderRadius: 12)),
              ],
            ),
            SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: ShimmerLoading(height: 100, borderRadius: 12)),
                SizedBox(width: 10),
                Expanded(child: ShimmerLoading(height: 100, borderRadius: 12)),
              ],
            ),
            SizedBox(height: AppSpacing.lg),
            // Checklist header
            ShimmerLoading(width: 150, height: 20),
            SizedBox(height: AppSpacing.md),
            // Checklist items
            ShimmerLoading(height: 56, borderRadius: 12),
            SizedBox(height: 8),
            ShimmerLoading(height: 56, borderRadius: 12),
            SizedBox(height: 8),
            ShimmerLoading(height: 56, borderRadius: 12),
          ],
        ),
      ),
    );
  }
}

// ── Generic List Skeleton ────────────────────────────────────────────────────

class ListScreenSkeleton extends StatelessWidget {
  final int itemCount;
  final double itemHeight;

  const ListScreenSkeleton({
    super.key,
    this.itemCount = 5,
    this.itemHeight = 72,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: ShimmerList(itemCount: itemCount, itemHeight: itemHeight),
    );
  }
}
