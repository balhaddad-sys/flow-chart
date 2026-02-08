import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/utils/date_utils.dart';
import '../../../models/section_model.dart';
import '../providers/library_provider.dart';

class SectionList extends ConsumerWidget {
  final String fileId;

  const SectionList({super.key, required this.fileId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sectionsAsync = ref.watch(sectionsProvider(fileId));

    return sectionsAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.md),
        child: Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      ),
      error: (e, _) => Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Text('Error: $e',
            style: const TextStyle(color: AppColors.error)),
      ),
      data: (sections) {
        if (sections.isEmpty) {
          return Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Text(
              'No sections found',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textTertiary,
                  ),
            ),
          );
        }

        return Column(
          children: [
            for (int i = 0; i < sections.length; i++)
              _SectionRow(
                section: sections[i],
                index: i + 1,
                isLast: i == sections.length - 1,
              ),
          ],
        );
      },
    );
  }
}

class _SectionRow extends StatelessWidget {
  final SectionModel section;
  final int index;
  final bool isLast;

  const _SectionRow({
    required this.section,
    required this.index,
    required this.isLast,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(
                bottom: BorderSide(color: AppColors.divider),
              ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Index number
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Center(
                child: Text(
                  '$index',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),

            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    section.title,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      // Duration
                      const Icon(Icons.schedule,
                          size: 13, color: AppColors.textTertiary),
                      const SizedBox(width: 3),
                      Text(
                        AppDateUtils.formatDuration(section.estMinutes),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                            ),
                      ),
                      const SizedBox(width: AppSpacing.md),

                      // Difficulty dots
                      ...List.generate(5, (i) {
                        final filled = i < section.difficulty;
                        return Padding(
                          padding: const EdgeInsets.only(right: 2),
                          child: Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: filled
                                  ? _difficultyColor(section.difficulty)
                                  : AppColors.border,
                            ),
                          ),
                        );
                      }),
                    ],
                  ),
                  if (section.topicTags.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 4,
                      runSpacing: 4,
                      children: section.topicTags
                          .take(3)
                          .map((tag) => Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.primary
                                      .withValues(alpha: 0.06),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  tag,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ))
                          .toList(),
                    ),
                  ],
                ],
              ),
            ),

            // AI status
            _AiStatusIcon(status: section.aiStatus),
          ],
        ),
      ),
    );
  }

  Color _difficultyColor(int difficulty) {
    if (difficulty <= 2) return AppColors.difficultyEasy;
    if (difficulty <= 3) return AppColors.difficultyMedium;
    return AppColors.difficultyHard;
  }
}

class _AiStatusIcon extends StatelessWidget {
  final String status;

  const _AiStatusIcon({required this.status});

  @override
  Widget build(BuildContext context) {
    switch (status) {
      case 'ANALYZED':
        return Tooltip(
          message: 'AI analyzed',
          child: Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Icon(Icons.auto_awesome,
                color: AppColors.success, size: 16),
          ),
        );
      case 'PENDING':
        return const Tooltip(
          message: 'Analysis pending',
          child: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        );
      case 'FAILED':
        return Tooltip(
          message: 'Analysis failed',
          child: Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Icon(Icons.error_outline,
                color: AppColors.error, size: 16),
          ),
        );
      default:
        return const SizedBox.shrink();
    }
  }
}
