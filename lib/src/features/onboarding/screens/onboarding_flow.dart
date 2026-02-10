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

  static const _stepLabels = [
    'Course',
    'Exam Date',
    'Availability',
    'Upload',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(onboardingProvider.notifier).reset();
    });
  }

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
                icon: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(
                    color: AppColors.surfaceVariant,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.arrow_back_rounded, size: 18),
                ),
                onPressed: () =>
                    ref.read(onboardingProvider.notifier).previousStep(),
              )
            : null,
      ),
      body: Column(
        children: [
          // Step indicator
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: List.generate(_stepCount, (i) {
                final isActive = i <= data.currentStep;
                final isCurrent = i == data.currentStep;
                return Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(
                      left: i > 0 ? 4 : 0,
                      right: i < _stepCount - 1 ? 4 : 0,
                    ),
                    child: Column(
                      children: [
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          height: 4,
                          decoration: BoxDecoration(
                            color: isActive
                                ? AppColors.primary
                                : AppColors.surfaceVariant,
                            borderRadius:
                                BorderRadius.circular(AppSpacing.radiusFull),
                          ),
                        ),
                        AppSpacing.gapXs,
                        Text(
                          _stepLabels[i],
                          style: Theme.of(context)
                              .textTheme
                              .labelSmall
                              ?.copyWith(
                                color: isCurrent
                                    ? AppColors.primary
                                    : AppColors.textTertiary,
                                fontWeight: isCurrent
                                    ? FontWeight.w600
                                    : FontWeight.w400,
                              ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ),
          AppSpacing.gapSm,

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
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: const BoxDecoration(
                  color: AppColors.errorSurface,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                ),
                child: Text(
                  data.errorMessage!,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppColors.error),
                ),
              ),
            ),

          // Bottom action
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: PrimaryButton(
              label: data.currentStep < _stepCount - 1 ? 'Continue' : 'Finish',
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
          AppSpacing.gapSm,
        ],
      ),
    );
  }
}
