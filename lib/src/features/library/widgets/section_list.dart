import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/utils/date_utils.dart';
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
            return ListTile(
              dense: true,
              title: Text(
                section.title,
                style: Theme.of(context).textTheme.titleSmall,
              ),
              subtitle: Text(
                '${AppDateUtils.formatDuration(section.estMinutes)} | '
                'Difficulty: ${section.difficulty}/5',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              trailing: _aiStatusIcon(section.aiStatus),
            );
          }).toList(),
        );
      },
    );
  }

  Widget _aiStatusIcon(String status) {
    switch (status) {
      case 'ANALYZED':
        return Container(
          width: 22,
          height: 22,
          decoration: BoxDecoration(
            color: AppColors.successSurface,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.auto_awesome_rounded,
              color: AppColors.success, size: 13),
        );
      case 'PENDING':
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
}
