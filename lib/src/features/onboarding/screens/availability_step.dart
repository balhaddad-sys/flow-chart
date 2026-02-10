import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
          Text(
            'How much time can you study?',
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          AppSpacing.gapSm,
          Text(
            'Set your daily study time and revision intensity',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          AppSpacing.gapXl,
          Text(
            'Daily study time',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          AppSpacing.gapSm,
          Text(
            AppDateUtils.formatDuration(data.dailyMinutes),
            style: Theme.of(context).textTheme.headlineMedium,
            textAlign: TextAlign.center,
          ),
          Slider(
            value: data.dailyMinutes.toDouble(),
            min: 30,
            max: 480,
            divisions: 18,
            label: AppDateUtils.formatDuration(data.dailyMinutes),
            onChanged: (v) =>
                ref.read(onboardingProvider.notifier).setDailyMinutes(v.round()),
          ),
          AppSpacing.gapLg,
          Text(
            'Revision intensity',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          AppSpacing.gapSm,
          RadioGroup<String>(
            groupValue: data.revisionPolicy,
            onChanged: (v) => ref
                .read(onboardingProvider.notifier)
                .setRevisionPolicy(v!),
            child: Column(
              children: ['off', 'light', 'standard', 'aggressive'].map((policy) {
                return RadioListTile<String>(
                  title: Text(policy[0].toUpperCase() + policy.substring(1)),
                  subtitle: Text(_policyDescription(policy)),
                  value: policy,
                );
              }).toList(),
            ),
          ),
          AppSpacing.gapLg,
          Text(
            'Session style',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          AppSpacing.gapSm,
          Wrap(
            spacing: AppSpacing.sm,
            children: ['25/5', '50/10', 'deep'].map((style) {
              final selected = data.pomodoroStyle == style;
              return ChoiceChip(
                label: Text(_styleLabel(style)),
                selected: selected,
                onSelected: (_) =>
                    ref.read(onboardingProvider.notifier).setPomodoroStyle(style),
              );
            }).toList(),
          ),
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
