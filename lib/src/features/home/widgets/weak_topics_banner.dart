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

        return Card(
          color: AppColors.warning.withValues(alpha: 0.08),
          child: Padding(
            padding: AppSpacing.cardPadding,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.warning_amber,
                        color: AppColors.warning, size: 20),
                    AppSpacing.hGapSm,
                    Text(
                      'Weak Topics',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: () => context.go('/dashboard'),
                      child: const Text('View All'),
                    ),
                  ],
                ),
                AppSpacing.gapSm,
                ...topWeak.map((topic) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                    child: Row(
                      children: [
                        Expanded(child: Text(topic.tag)),
                        Text(
                          '${(topic.accuracy * 100).round()}% accuracy',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: AppColors.error,
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
