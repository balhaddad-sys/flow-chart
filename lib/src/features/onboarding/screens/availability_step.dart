import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/utils/date_utils.dart';
import '../providers/onboarding_provider.dart';

class AvailabilityStep extends ConsumerWidget {
  const AvailabilityStep({super.key});

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
              color: AppColors.accentSurface,
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            ),
            child: const Icon(Icons.schedule_rounded,
                color: AppColors.accent, size: 28),
          ),
          AppSpacing.gapMd,
          Text(
            'How much time can you study?',
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          AppSpacing.gapXs,
          Text(
            'Set your daily study time and revision intensity',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
          AppSpacing.gapXl,

          // Daily study time
          _SectionLabel(label: 'Daily study time'),
          AppSpacing.gapSm,
          Container(
            padding: AppSpacing.cardPaddingLarge,
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
              border:
                  Border.all(color: AppColors.border.withValues(alpha: 0.7)),
              boxShadow: AppSpacing.shadowSm,
            ),
            child: Column(
              children: [
                Text(
                  AppDateUtils.formatDuration(data.dailyMinutes),
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                  textAlign: TextAlign.center,
                ),
                AppSpacing.gapSm,
                SliderTheme(
                  data: SliderThemeData(
                    activeTrackColor: AppColors.primary,
                    inactiveTrackColor:
                        AppColors.primary.withValues(alpha: 0.15),
                    thumbColor: AppColors.primary,
                    overlayColor: AppColors.primary.withValues(alpha: 0.1),
                    trackHeight: 6,
                    thumbShape:
                        const RoundSliderThumbShape(enabledThumbRadius: 8),
                  ),
                  child: Slider(
                    value: data.dailyMinutes.toDouble(),
                    min: 30,
                    max: 480,
                    divisions: 18,
                    label: AppDateUtils.formatDuration(data.dailyMinutes),
                    onChanged: (v) => ref
                        .read(onboardingProvider.notifier)
                        .setDailyMinutes(v.round()),
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('30 min',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: AppColors.textTertiary,
                            )),
                    Text('8 hours',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: AppColors.textTertiary,
                            )),
                  ],
                ),
              ],
            ),
          ),

          AppSpacing.gapLg,

          // Revision intensity
          _SectionLabel(label: 'Revision intensity'),
          AppSpacing.gapSm,
          Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
              border:
                  Border.all(color: AppColors.border.withValues(alpha: 0.7)),
              boxShadow: AppSpacing.shadowSm,
            ),
            child: Column(
              children:
                  ['off', 'light', 'standard', 'aggressive'].map((policy) {
                final isLast = policy == 'aggressive';
                return Column(
                  children: [
                    RadioListTile<String>(
                      title: Text(
                          policy[0].toUpperCase() + policy.substring(1)),
                      subtitle: Text(_policyDescription(policy)),
                      value: policy,
                      groupValue: data.revisionPolicy,
                      onChanged: (v) => ref
                          .read(onboardingProvider.notifier)
                          .setRevisionPolicy(v!),
                      activeColor: AppColors.primary,
                    ),
                    if (!isLast)
                      const Divider(height: 1, indent: 16, endIndent: 16),
                  ],
                );
              }).toList(),
            ),
          ),

          AppSpacing.gapLg,

          // Session style
          _SectionLabel(label: 'Session style'),
          AppSpacing.gapSm,
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: ['25/5', '50/10', 'deep'].map((style) {
              final selected = data.pomodoroStyle == style;
              return ChoiceChip(
                label: Text(_styleLabel(style)),
                selected: selected,
                onSelected: (_) => ref
                    .read(onboardingProvider.notifier)
                    .setPomodoroStyle(style),
                backgroundColor: AppColors.surface,
                selectedColor: AppColors.primarySurface,
                side: BorderSide(
                  color: selected ? AppColors.primary : AppColors.border,
                ),
                labelStyle: TextStyle(
                  color:
                      selected ? AppColors.primary : AppColors.textSecondary,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                ),
              );
            }).toList(),
          ),
          AppSpacing.gapXl,
        ],
      ),
    );
  }

  String _policyDescription(String policy) {
    switch (policy) {
      case 'off':
        return 'No spaced repetition reviews';
      case 'light':
        return 'One review at day +3';
      case 'standard':
        return 'Reviews at day +1, +3, +7';
      case 'aggressive':
        return 'Reviews at day +1, +3, +7, +14';
      default:
        return '';
    }
  }

  String _styleLabel(String style) {
    switch (style) {
      case '25/5':
        return '25 min / 5 min break';
      case '50/10':
        return '50 min / 10 min break';
      case 'deep':
        return 'Deep work (no timer)';
      default:
        return style;
    }
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;

  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
    );
  }
}
