// FILE: lib/src/features/onboarding/screens/onboarding_flow.dart
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

class _OnboardingFlowState extends ConsumerState<OnboardingFlow>
    with SingleTickerProviderStateMixin {
  final _pageController = PageController();

  static const _stepCount = 4;
  static const _stepLabels = ['Course', 'Exam Date', 'Availability', 'Upload'];
  static const _stepIcons = [
    Icons.school_rounded,
    Icons.calendar_month_rounded,
    Icons.schedule_rounded,
    Icons.upload_file_rounded,
  ];

  // Whether each step is optional (can be skipped)
  static const _stepOptional = [false, true, false, true];

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

  void _skip() {
    final data = ref.read(onboardingProvider);
    if (data.currentStep < _stepCount - 1) {
      ref.read(onboardingProvider.notifier).nextStep();
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(onboardingProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isLastStep = data.currentStep == _stepCount - 1;
    final isOptionalStep = _stepOptional[data.currentStep];

    ref.listen<OnboardingData>(onboardingProvider, (prev, next) {
      if (prev?.currentStep != next.currentStep) {
        _goToStep(next.currentStep);
      }
    });

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.background,
      body: Column(
        children: [
          // ── Top bar ───────────────────────────────────────────────────
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 12, 0),
              child: Row(
                children: [
                  // Back button
                  if (data.currentStep > 0)
                    IconButton(
                      icon: Container(
                        padding: const EdgeInsets.all(7),
                        decoration: BoxDecoration(
                          color: isDark
                              ? AppColors.darkSurfaceVariant
                              : AppColors.surfaceVariant,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.arrow_back_rounded,
                          size: 16,
                          color: isDark
                              ? AppColors.darkTextPrimary
                              : AppColors.textPrimary,
                        ),
                      ),
                      onPressed: () =>
                          ref.read(onboardingProvider.notifier).previousStep(),
                    )
                  else
                    const SizedBox(width: 48),

                  const Spacer(),

                  // Step counter
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: isDark
                          ? AppColors.darkSurfaceVariant
                          : AppColors.surfaceVariant,
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusFull),
                    ),
                    child: Text(
                      'Step ${data.currentStep + 1} of $_stepCount',
                      style:
                          Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: isDark
                                    ? AppColors.darkTextSecondary
                                    : AppColors.textSecondary,
                                fontWeight: FontWeight.w600,
                              ),
                    ),
                  ),

                  // Skip button (optional steps only)
                  if (isOptionalStep && !isLastStep) ...[
                    const SizedBox(width: 8),
                    TextButton(
                      onPressed: _skip,
                      style: TextButton.styleFrom(
                        foregroundColor: isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 4),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text(
                        'Skip',
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          // ── Step indicator bar ────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
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
                        // Progress segment
                        AnimatedContainer(
                          duration: AppSpacing.animNormal,
                          height: 4,
                          decoration: BoxDecoration(
                            gradient:
                                isActive ? AppColors.heroGradient : null,
                            color: isActive
                                ? null
                                : isDark
                                    ? AppColors.darkSurfaceVariant
                                    : AppColors.surfaceVariant,
                            borderRadius: BorderRadius.circular(
                                AppSpacing.radiusFull),
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
                                    : isDark
                                        ? AppColors.darkTextTertiary
                                        : AppColors.textTertiary,
                                fontWeight: isCurrent
                                    ? FontWeight.w600
                                    : FontWeight.w400,
                                fontSize: 10,
                              ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ),

          // ── Step icon + label ─────────────────────────────────────────
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius:
                        BorderRadius.circular(AppSpacing.radiusSm),
                  ),
                  child: Icon(
                    _stepIcons[data.currentStep],
                    size: 18,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _stepLabels[data.currentStep],
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: isDark
                                ? AppColors.darkTextPrimary
                                : AppColors.textPrimary,
                          ),
                    ),
                    if (isOptionalStep)
                      Text(
                        'Optional — you can skip this step',
                        style: Theme.of(context)
                            .textTheme
                            .labelSmall
                            ?.copyWith(
                              color: isDark
                                  ? AppColors.darkTextTertiary
                                  : AppColors.textTertiary,
                            ),
                      ),
                  ],
                ),
              ],
            ),
          ),

          // ── Page content ──────────────────────────────────────────────
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

          // ── Error message ─────────────────────────────────────────────
          if (data.errorMessage != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.08),
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusSm),
                  border: Border.all(
                      color: AppColors.error.withValues(alpha: 0.3)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.error_outline_rounded,
                        size: 14, color: AppColors.error),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        data.errorMessage!,
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(color: AppColors.error),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // ── Bottom action ─────────────────────────────────────────────
          Padding(
            padding:
                const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: PrimaryButton(
              label: isLastStep
                  ? 'Go to Dashboard'
                  : 'Continue',
              icon: isLastStep ? null : Icons.arrow_forward_rounded,
              isLoading: data.isSubmitting,
              onPressed: () async {
                if (data.currentStep < _stepCount - 1) {
                  ref.read(onboardingProvider.notifier).nextStep();
                } else {
                  final success = await ref
                      .read(onboardingProvider.notifier)
                      .finishOnboarding();
                  if (success && context.mounted) {
                    context.go('/guide');
                  }
                }
              },
            ),
          ),

          const SafeArea(top: false, child: SizedBox.shrink()),
        ],
      ),
    );
  }
}
