import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../models/section_model.dart';
import '../providers/session_provider.dart';

class ActiveLearningPanel extends ConsumerWidget {
  final String sectionId;

  const ActiveLearningPanel({super.key, required this.sectionId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sectionAsync = ref.watch(sectionForSessionProvider(sectionId));

    return sectionAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
      data: (section) {
        if (section == null) {
          return const Center(child: Text('Section not found'));
        }

        final blueprint = section.blueprint;

        return ListView(
          padding: AppSpacing.cardPadding,
          children: [
            // Section header
            Text(
              section.title,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            AppSpacing.gapXs,
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                _InfoChip(
                  icon: Icons.timer_outlined,
                  label: '${section.estMinutes} min',
                ),
                _InfoChip(
                  icon: Icons.signal_cellular_alt,
                  label: 'Difficulty ${section.difficulty}/5',
                ),
                ...section.topicTags.map(
                  (tag) => _InfoChip(
                    icon: Icons.label_outline,
                    label: tag,
                    color: AppColors.secondary,
                  ),
                ),
              ],
            ),
            AppSpacing.gapLg,

            if (blueprint != null) ...[
              // Learning objectives
              if (blueprint.learningObjectives.isNotEmpty) ...[
                _SectionHeader(
                  icon: Icons.flag_outlined,
                  title: 'Learning Objectives',
                ),
                AppSpacing.gapSm,
                ...blueprint.learningObjectives.map(
                  (obj) => _BulletItem(text: obj),
                ),
                AppSpacing.gapLg,
              ],

              // Key concepts
              if (blueprint.keyConcepts.isNotEmpty) ...[
                _SectionHeader(
                  icon: Icons.lightbulb_outline,
                  title: 'Key Concepts',
                ),
                AppSpacing.gapSm,
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: blueprint.keyConcepts
                      .map((c) => Chip(
                            label: Text(c,
                                style: Theme.of(context).textTheme.bodySmall),
                            backgroundColor:
                                AppColors.primary.withValues(alpha: 0.08),
                            side: BorderSide.none,
                            padding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                          ))
                      .toList(),
                ),
                AppSpacing.gapLg,
              ],

              // High-yield points
              if (blueprint.highYieldPoints.isNotEmpty) ...[
                _SectionHeader(
                  icon: Icons.star_outline,
                  title: 'High-Yield Points',
                  color: AppColors.warning,
                ),
                AppSpacing.gapSm,
                ...blueprint.highYieldPoints.map(
                  (point) => _HighlightItem(text: point),
                ),
                AppSpacing.gapLg,
              ],

              // Common traps
              if (blueprint.commonTraps.isNotEmpty) ...[
                _SectionHeader(
                  icon: Icons.warning_amber_outlined,
                  title: 'Common Traps',
                  color: AppColors.error,
                ),
                AppSpacing.gapSm,
                ...blueprint.commonTraps.map(
                  (trap) => _TrapItem(text: trap),
                ),
                AppSpacing.gapLg,
              ],

              // Terms to define
              if (blueprint.termsToDefine.isNotEmpty) ...[
                _SectionHeader(
                  icon: Icons.menu_book_outlined,
                  title: 'Key Terms',
                ),
                AppSpacing.gapSm,
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: blueprint.termsToDefine
                      .map((term) => Chip(
                            label: Text(term,
                                style: Theme.of(context).textTheme.bodySmall),
                            backgroundColor:
                                AppColors.surfaceVariant,
                            side: BorderSide.none,
                            padding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                          ))
                      .toList(),
                ),
                AppSpacing.gapLg,
              ],
            ] else ...[
              // No blueprint available yet
              Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.auto_awesome,
                          color: AppColors.textTertiary, size: 40),
                      AppSpacing.gapMd,
                      Text(
                        'Study guide generating...',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppColors.textSecondary,
                            ),
                      ),
                      AppSpacing.gapXs,
                      Text(
                        'AI analysis is still processing this section',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.textTertiary,
                            ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color? color;

  const _SectionHeader({
    required this.icon,
    required this.title,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.primary;
    return Row(
      children: [
        Icon(icon, color: c, size: 20),
        AppSpacing.hGapSm,
        Text(
          title,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(color: c),
        ),
      ],
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;

  const _InfoChip({
    required this.icon,
    required this.label,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.textSecondary;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: c),
          const SizedBox(width: 4),
          Text(
            label,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: c, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}

class _BulletItem extends StatelessWidget {
  final String text;

  const _BulletItem({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Container(
              width: 6,
              height: 6,
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
            ),
          ),
          AppSpacing.hGapSm,
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }
}

class _HighlightItem extends StatelessWidget {
  final String text;

  const _HighlightItem({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border(
          left: BorderSide(color: AppColors.warning, width: 3),
        ),
      ),
      child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
    );
  }
}

class _TrapItem extends StatelessWidget {
  final String text;

  const _TrapItem({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border(
          left: BorderSide(color: AppColors.error, width: 3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_amber, color: AppColors.error, size: 16),
          AppSpacing.hGapSm,
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }
}
