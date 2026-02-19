import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/utils/validators.dart';
import '../providers/onboarding_provider.dart';

class _ExamOption {
  final String key;
  final String label;
  final String badge;
  const _ExamOption(this.key, this.label, this.badge);
}

class _ExamGroup {
  final String group;
  final List<_ExamOption> exams;
  const _ExamGroup(this.group, this.exams);
}

const _examCatalog = [
  _ExamGroup('UK Licensing', [
    _ExamOption('PLAB1', 'PLAB 1',  '180 SBAs · GMC'),
    _ExamOption('PLAB2', 'PLAB 2',  '18 stations · OSCE'),
  ]),
  _ExamGroup('UK Specialty', [
    _ExamOption('MRCP_PART1', 'MRCP Part 1',  'Best of Five · RCP'),
    _ExamOption('MRCP_PACES', 'MRCP PACES',   '5 stations · Clinical'),
    _ExamOption('MRCGP_AKT',  'MRCGP AKT',   '200 MCQs · GP'),
  ]),
  _ExamGroup('International', [
    _ExamOption('USMLE_STEP1', 'USMLE Step 1',    'Basic science · NBME'),
    _ExamOption('USMLE_STEP2', 'USMLE Step 2 CK', 'Clinical knowledge'),
  ]),
  _ExamGroup('University', [
    _ExamOption('FINALS', 'Medical Finals', 'SBA + OSCE · University'),
    _ExamOption('SBA',    'SBA Practice',   'General SBA'),
    _ExamOption('OSCE',   'OSCE Practice',  'General OSCE'),
  ]),
];

class CourseSetupStep extends ConsumerWidget {
  const CourseSetupStep({super.key});

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
              color: AppColors.primarySurface,
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            ),
            child: const Icon(Icons.school_rounded,
                color: AppColors.primary, size: 28),
          ),
          AppSpacing.gapMd,
          Text(
            'What are you studying?',
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          AppSpacing.gapXs,
          Text(
            'Name your course and select the exam you are preparing for.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
          AppSpacing.gapXl,
          TextFormField(
            initialValue: data.courseTitle,
            decoration: const InputDecoration(
              labelText: 'Course Title',
              hintText: 'e.g., Neurology Block 3',
              prefixIcon: Icon(Icons.menu_book_rounded),
            ),
            validator: Validators.courseTitle,
            onChanged: (v) =>
                ref.read(onboardingProvider.notifier).setCourseTitle(v),
          ),
          AppSpacing.gapXl,
          Text(
            'Preparing for',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          AppSpacing.gapMd,
          ..._examCatalog.map((group) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    group.group.toUpperCase(),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppColors.textSecondary,
                          letterSpacing: 0.8,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  AppSpacing.gapXs,
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: group.exams.map((exam) {
                      final selected = data.examType == exam.key;
                      return GestureDetector(
                        onTap: () => ref
                            .read(onboardingProvider.notifier)
                            .setExamType(exam.key),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: selected
                                ? AppColors.primarySurface
                                : AppColors.surface,
                            borderRadius:
                                BorderRadius.circular(AppSpacing.radiusMd),
                            border: Border.all(
                              color:
                                  selected ? AppColors.primary : AppColors.border,
                              width: selected ? 1.5 : 1,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                exam.label,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: selected
                                      ? FontWeight.w600
                                      : FontWeight.w500,
                                  color: selected
                                      ? AppColors.primary
                                      : AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                exam.badge,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  AppSpacing.gapMd,
                ],
              )),
        ],
      ),
    );
  }
}
