import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../providers/home_provider.dart';

class WeakTopicsBanner extends ConsumerWidget {
  final String courseId;

  const WeakTopicsBanner({super.key, required this.courseId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(courseStatsProvider(courseId));

    return statsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (stats) {
        if (stats == null || stats.weakestTopics.isEmpty) {
          return const SizedBox.shrink();
        }

        final topWeak = stats.weakestTopics.take(3).toList();

        return Container(
          decoration: BoxDecoration(
            color: AppColors.warningSurface,
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            border: Border.all(
              color: AppColors.warning.withValues(alpha: 0.2),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: AppColors.warning.withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.trending_down_rounded,
                          color: AppColors.warning, size: 16),
                    ),
                    AppSpacing.hGapSm,
                    Text(
                      'Needs Attention',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: AppColors.warning,
                          ),
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: () => context.go('/dashboard'),
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.warning,
                        padding: EdgeInsets.zero,
                        visualDensity: VisualDensity.compact,
                      ),
                      child: const Text('View All'),
                    ),
                  ],
                ),
                AppSpacing.gapMd,
                ...topWeak.map((topic) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: Row(
                      children: [
                        Container(
                          width: 4,
                          height: 4,
                          decoration: const BoxDecoration(
                            color: AppColors.warning,
                            shape: BoxShape.circle,
                          ),
                        ),
                        AppSpacing.hGapSm,
                        Expanded(
                          child: Text(
                            topic.tag,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: AppColors.textPrimary,
                                ),
                          ),
                        ),
                        Text(
                          '${(topic.accuracy * 100).round()}%',
                          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                                color: AppColors.error,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
        );
      },
    );
  }
}
