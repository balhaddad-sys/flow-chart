import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
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
        padding: EdgeInsets.all(16),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Padding(
        padding: const EdgeInsets.all(16),
        child: Text('Error: $e'),
      ),
      data: (sections) {
        if (sections.isEmpty) {
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              'No sections found',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          );
        }

        return Column(
          children: sections.map((section) {
            final hasQuestions = section.questionsCount > 0;
            final isReady = section.aiStatus == 'ANALYZED' && hasQuestions;
            final questionsFailedRetryable = section.aiStatus == 'ANALYZED' &&
                                               section.questionsStatus == 'FAILED' &&
                                               !hasQuestions;

            return ListTile(
              dense: true,
              onTap: isReady
                  ? () => context.push('/quiz/${section.id}')
                  : null,
              title: Text(
                section.title,
                style: Theme.of(context).textTheme.titleSmall,
              ),
              subtitle: Text(
                '${AppDateUtils.formatDuration(section.estMinutes)} | '
                'Difficulty: ${section.difficulty}/5',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isReady)
                    Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.secondary.withValues(alpha: 0.1),
                        borderRadius:
                            BorderRadius.circular(AppSpacing.radiusFull),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.quiz_rounded,
                              size: 12, color: AppColors.secondary),
                          SizedBox(width: 3),
                          Text(
                            'Quiz',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: AppColors.secondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (questionsFailedRetryable)
                    IconButton(
                      icon: const Icon(Icons.refresh_rounded, size: 18),
                      onPressed: () => _retryQuestionGeneration(ref, section),
                      tooltip: 'Retry question generation',
                      padding: const EdgeInsets.all(4),
                      constraints: const BoxConstraints(),
                    ),
                  _statusIcon(section),
                ],
              ),
            );
          }).toList(),
        );
      },
    );
  }

  Widget _statusIcon(SectionModel section) {
    // Show questions status if section is analyzed
    if (section.aiStatus == 'ANALYZED') {
      if (section.questionsCount > 0 && section.questionsStatus == 'GENERATING') {
        return const Icon(Icons.autorenew_rounded,
            color: AppColors.secondary, size: 18);
      }

      switch (section.questionsStatus) {
        case 'COMPLETED':
          return Container(
            width: 22,
            height: 22,
            decoration: const BoxDecoration(
              color: AppColors.successSurface,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_rounded,
                color: AppColors.success, size: 14),
          );
        case 'GENERATING':
          return const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          );
        case 'FAILED':
          return const Icon(Icons.error_outline_rounded,
              color: AppColors.error, size: 18);
        default:
          return const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          );
      }
    }

    // Show section analysis status
    switch (section.aiStatus) {
      case 'PROCESSING':
        return const SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(strokeWidth: 2),
        );
      case 'FAILED':
        return const Icon(Icons.error_outline_rounded,
            color: AppColors.error, size: 18);
      default:
        return const SizedBox.shrink();
    }
  }

  Future<void> _retryQuestionGeneration(
      WidgetRef ref, SectionModel section) async {
    try {
      final cloudFunctions = ref.read(cloudFunctionsServiceProvider);
      await cloudFunctions.generateQuestions(
        courseId: section.courseId,
        sectionId: section.id,
        count: 10,
      );

      // Invalidate sections provider to refresh the list
      ref.invalidate(sectionsProvider(section.fileId));
    } catch (e) {
      // Error handling will be shown by the provider
    }
  }
}
