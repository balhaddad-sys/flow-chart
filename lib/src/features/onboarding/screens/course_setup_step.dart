import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/utils/validators.dart';
import '../providers/onboarding_provider.dart';

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
            'Name your course or module so we can personalise your study plan',
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
            'Exam type',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          AppSpacing.gapSm,
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: ['SBA', 'OSCE', 'Mixed'].map((type) {
              final selected = data.examType == type;
              return ChoiceChip(
                label: Text(type),
                selected: selected,
                onSelected: (_) =>
                    ref.read(onboardingProvider.notifier).setExamType(type),
                backgroundColor: AppColors.surface,
                selectedColor: AppColors.primarySurface,
                side: BorderSide(
                  color: selected ? AppColors.primary : AppColors.border,
                ),
                labelStyle: TextStyle(
                  color: selected ? AppColors.primary : AppColors.textSecondary,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
