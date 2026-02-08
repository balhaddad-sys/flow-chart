import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/utils/date_utils.dart';
import '../providers/onboarding_provider.dart';

class ExamDateStep extends ConsumerWidget {
  const ExamDateStep({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(onboardingProvider);

    return Padding(
      padding: AppSpacing.screenPadding,
      child: ListView(
        children: [
          Text(
            'When is your exam?',
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          AppSpacing.gapSm,
          Text(
            'We\'ll work backwards to create your schedule',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          AppSpacing.gapXl,
          if (data.examDate != null)
            Container(
              padding: AppSpacing.cardPadding,
              decoration: BoxDecoration(
                color: AppColors.primaryLight.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
              child: Column(
                children: [
                  Text(
                    AppDateUtils.formatFull(data.examDate!),
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  AppSpacing.gapXs,
                  Text(
                    '${AppDateUtils.daysUntil(data.examDate!)} days away',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
          AppSpacing.gapLg,
          OutlinedButton.icon(
            icon: const Icon(Icons.calendar_today),
            label: Text(
              data.examDate == null ? 'Select Exam Date' : 'Change Date',
            ),
            onPressed: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate:
                    data.examDate ?? DateTime.now().add(const Duration(days: 30)),
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 365)),
              );
              if (picked != null) {
                ref.read(onboardingProvider.notifier).setExamDate(picked);
              }
            },
          ),
        ],
      ),
    );
  }
}
