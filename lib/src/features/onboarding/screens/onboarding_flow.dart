import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/widgets/primary_button.dart';
import '../providers/onboarding_provider.dart';
import 'course_setup_step.dart';
import 'exam_date_step.dart';
import 'availability_step.dart';
import 'upload_step.dart';

class OnboardingFlow extends ConsumerStatefulWidget {
  const OnboardingFlow({super.key});

  @override
  ConsumerState<OnboardingFlow> createState() => _OnboardingFlowState();
}

class _OnboardingFlowState extends ConsumerState<OnboardingFlow> {
  final _pageController = PageController();

  static const _stepCount = 4;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _goToStep(int step) {
    _pageController.animateToPage(
      step,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(onboardingProvider);

    ref.listen<OnboardingData>(onboardingProvider, (prev, next) {
      if (prev?.currentStep != next.currentStep) {
        _goToStep(next.currentStep);
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Set Up Your Course'),
        leading: data.currentStep > 0
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () =>
                    ref.read(onboardingProvider.notifier).previousStep(),
              )
            : null,
      ),
      body: Column(
        children: [
          // Progress indicator
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: Row(
              children: List.generate(_stepCount, (i) {
                return Expanded(
                  child: Container(
                    height: 4,
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    decoration: BoxDecoration(
                      color: i <= data.currentStep
                          ? AppColors.primary
                          : AppColors.border,
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusSm),
                    ),
                  ),
                );
              }),
            ),
          ),
          AppSpacing.gapMd,
          // Page content
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              children: const [
                CourseSetupStep(),
                ExamDateStep(),
                AvailabilityStep(),
                UploadStep(),
              ],
            ),
          ),
          // Error message
          if (data.errorMessage != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Text(
                data.errorMessage!,
                style: TextStyle(color: AppColors.error),
              ),
            ),
          // Bottom action
          Padding(
            padding: AppSpacing.screenPadding,
            child: PrimaryButton(
              label: data.currentStep < _stepCount - 1 ? 'Next' : 'Finish',
              isLoading: data.isSubmitting,
              onPressed: () async {
                if (data.currentStep < _stepCount - 1) {
                  ref.read(onboardingProvider.notifier).nextStep();
                } else {
                  final success = await ref
                      .read(onboardingProvider.notifier)
                      .finishOnboarding();
                  if (success && context.mounted) {
                    context.go('/home');
                  }
                }
              },
            ),
          ),
          AppSpacing.gapMd,
        ],
      ),
    );
  }
}
