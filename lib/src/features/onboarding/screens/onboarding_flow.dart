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

  static const _stepLabels = ['Course', 'Exam Date', 'Availability', 'Upload'];

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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    ref.listen<OnboardingData>(onboardingProvider, (prev, next) {
      if (prev?.currentStep != next.currentStep) {
        _goToStep(next.currentStep);
      }
    });

    return Scaffold(
      body: Column(
        children: [
          // ── Top bar ──────────────────────────────────────────────
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 20, 0),
              child: Row(
                children: [
                  if (data.currentStep > 0)
                    IconButton(
                      icon: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color:
                              isDark
                                  ? AppColors.darkSurfaceVariant
                                  : AppColors.surfaceVariant,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.arrow_back_rounded,
                          size: 18,
                          color:
                              isDark
                                  ? AppColors.darkTextPrimary
                                  : AppColors.textPrimary,
                        ),
                      ),
                      onPressed:
                          () =>
                              ref
                                  .read(onboardingProvider.notifier)
                                  .previousStep(),
                    )
                  else
                    const SizedBox(width: 48),
                  const Spacer(),
                  Text(
                    'Step ${data.currentStep + 1} of $_stepCount',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color:
                          isDark
                              ? AppColors.darkTextTertiary
                              : AppColors.textTertiary,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Step indicator ───────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(
              children: List.generate(_stepCount, (i) {
                final isActive = i <= data.currentStep;
                final isCurrent = i == data.currentStep;
                return Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(
                      left: i > 0 ? 3 : 0,
                      right: i < _stepCount - 1 ? 3 : 0,
                    ),
                    child: Column(
                      children: [
                        AnimatedContainer(
                          duration: AppSpacing.animNormal,
                          height: 4,
                          decoration: BoxDecoration(
                            gradient: isActive ? AppColors.heroGradient : null,
                            color:
                                isActive
                                    ? null
                                    : isDark
                                    ? AppColors.darkSurfaceVariant
                                    : AppColors.surfaceVariant,
                            borderRadius: BorderRadius.circular(
                              AppSpacing.radiusFull,
                            ),
                          ),
                        ),
                        AppSpacing.gapXs,
                        Text(
                          _stepLabels[i],
                          style: Theme.of(
                            context,
                          ).textTheme.labelSmall?.copyWith(
                            color:
                                isCurrent
                                    ? AppColors.primary
                                    : isDark
                                    ? AppColors.darkTextTertiary
                                    : AppColors.textTertiary,
                            fontWeight:
                                isCurrent ? FontWeight.w600 : FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ),

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
                decoration: BoxDecoration(
                  color: AppColors.errorSurface,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                ),
                child: Text(
                  data.errorMessage!,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: AppColors.error),
                ),
              ),
            ),

          // Bottom action
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: PrimaryButton(
              label: data.currentStep < _stepCount - 1 ? 'Continue' : 'Finish',
              isLoading: data.isSubmitting,
              onPressed: () async {
                if (data.currentStep < _stepCount - 1) {
                  ref.read(onboardingProvider.notifier).nextStep();
                } else {
                  try {
                    final success =
                        await ref
                            .read(onboardingProvider.notifier)
                            .finishOnboarding();
                    if (success && context.mounted) {
                      context.go('/today');
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Something went wrong. Please try again.'),
                        ),
                      );
                    }
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
