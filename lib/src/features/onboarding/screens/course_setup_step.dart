import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
          Text(
            'What are you studying?',
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          AppSpacing.gapSm,
          Text(
            'Name your course or module',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          AppSpacing.gapLg,
          TextFormField(
            initialValue: data.courseTitle,
            decoration: const InputDecoration(
              labelText: 'Course Title',
              hintText: 'e.g., Neurology Block 3',
            ),
            validator: Validators.courseTitle,
            onChanged: (v) =>
                ref.read(onboardingProvider.notifier).setCourseTitle(v),
          ),
          AppSpacing.gapLg,
          Text(
            'Exam type',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          AppSpacing.gapSm,
          Wrap(
            spacing: AppSpacing.sm,
            children: ['SBA', 'OSCE', 'Mixed'].map((type) {
              final selected = data.examType == type;
              return ChoiceChip(
                label: Text(type),
                selected: selected,
                onSelected: (_) =>
                    ref.read(onboardingProvider.notifier).setExamType(type),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
