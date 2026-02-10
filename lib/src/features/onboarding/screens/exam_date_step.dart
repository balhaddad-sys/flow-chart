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
          AppSpacing.gapLg,
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.secondarySurface,
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            ),
            child: const Icon(Icons.calendar_month_rounded,
                color: AppColors.secondary, size: 28),
          ),
          AppSpacing.gapMd,
          Text(
            'When is your exam?',
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          AppSpacing.gapXs,
          Text(
            'We\'ll work backwards to create your schedule',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
          AppSpacing.gapXl,
          if (data.examDate != null) ...[
            Container(
              padding: AppSpacing.cardPaddingLarge,
              decoration: BoxDecoration(
                color: AppColors.primarySurface,
                borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.2)),
                boxShadow: AppSpacing.shadowSm,
              ),
              child: Column(
                children: [
                  Text(
                    AppDateUtils.formatFull(data.examDate!),
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  AppSpacing.gapXs,
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusFull),
                    ),
                    child: Text(
                      '${AppDateUtils.daysUntil(data.examDate!)} days away',
                      style:
                          Theme.of(context).textTheme.labelMedium?.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w600,
                              ),
                    ),
                  ),
                ],
              ),
            ),
            AppSpacing.gapLg,
          ],
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              icon: const Icon(Icons.calendar_today_rounded),
              label: Text(
                data.examDate == null ? 'Select Exam Date' : 'Change Date',
              ),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: const BorderSide(color: AppColors.border),
                shape: RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusMd),
                ),
              ),
              onPressed: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: data.examDate ??
                      DateTime.now().add(const Duration(days: 30)),
                  firstDate: DateTime.now(),
                  lastDate:
                      DateTime.now().add(const Duration(days: 365)),
                );
                if (picked != null) {
                  ref
                      .read(onboardingProvider.notifier)
                      .setExamDate(picked);
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}
