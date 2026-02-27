// FILE: lib/src/features/home/widgets/weak_topics_banner.dart

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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return statsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (stats) {
        // Only show if there are topics with weaknessScore > 0.3
        if (stats == null) return const SizedBox.shrink();
        final weakTopics =
            stats.weakestTopics.where((t) => t.weaknessScore > 0.3).toList();
        if (weakTopics.isEmpty) return const SizedBox.shrink();

        final top3 = weakTopics.take(3).toList();

        return Container(
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkSurface : AppColors.surface,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: Border.all(
              color: isDark
                  ? AppColors.warning.withValues(alpha: 0.20)
                  : AppColors.warning.withValues(alpha: 0.25),
            ),
            boxShadow: isDark ? null : AppSpacing.shadowSm,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
                child: Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: AppColors.warning.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(7),
                      ),
                      child: const Icon(
                        Icons.trending_down_rounded,
                        size: 14,
                        color: AppColors.warning,
                      ),
                    ),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Text(
                        'Weak Areas Detected',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => context.go('/dashboard'),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'View Insights',
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 11,
                                ),
                          ),
                          const SizedBox(width: 2),
                          const Icon(
                            Icons.arrow_forward_rounded,
                            size: 11,
                            color: AppColors.primary,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              Divider(
                height: 1,
                color: isDark
                    ? AppColors.darkBorder.withValues(alpha: 0.5)
                    : AppColors.border.withValues(alpha: 0.5),
              ),

              // Topic chips
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 11, 14, 13),
                child: Wrap(
                  spacing: 7,
                  runSpacing: 7,
                  children: top3.map((topic) {
                    final accuracyPct = (topic.accuracy * 100).round();
                    final Color chipColor;
                    if (topic.accuracy < 0.4) {
                      chipColor = AppColors.error;
                    } else if (topic.accuracy < 0.6) {
                      chipColor = const Color(0xFFEA580C);
                    } else {
                      chipColor = AppColors.warning;
                    }

                    return Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: chipColor.withValues(alpha: 0.08),
                        borderRadius:
                            BorderRadius.circular(AppSpacing.radiusFull),
                        border: Border.all(
                          color: chipColor.withValues(alpha: 0.20),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.radio_button_unchecked_rounded,
                            size: 8,
                            color: chipColor,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            topic.tag,
                            style: TextStyle(
                              color: chipColor,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            '$accuracyPct%',
                            style: TextStyle(
                              color: chipColor.withValues(alpha: 0.75),
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
