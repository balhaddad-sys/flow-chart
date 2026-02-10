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
          padding: AppSpacing.cardPaddingLarge,
          children: [
            Text(
              section.title,
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            AppSpacing.gapSm,
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                _InfoChip(
                  icon: Icons.timer_outlined,
                  label: '${section.estMinutes} min',
                ),
                _InfoChip(
                  icon: Icons.signal_cellular_alt_rounded,
                  label: 'Difficulty ${section.difficulty}/5',
                ),
                ...section.topicTags.map(
                  (tag) => _InfoChip(
                    icon: Icons.label_outline_rounded,
                    label: tag,
                    color: AppColors.secondary,
                  ),
                ),
              ],
            ),
            AppSpacing.gapXl,

            if (blueprint != null) ...[
              if (blueprint.learningObjectives.isNotEmpty) ...[
                const _SectionHeader(
                  icon: Icons.flag_outlined,
                  title: 'Learning Objectives',
                ),
                AppSpacing.gapSm,
                ...blueprint.learningObjectives.map(
                  (obj) => _BulletItem(text: obj),
                ),
                AppSpacing.gapLg,
              ],

              if (blueprint.keyConcepts.isNotEmpty) ...[
                const _SectionHeader(
                  icon: Icons.lightbulb_outline_rounded,
                  title: 'Key Concepts',
                ),
                AppSpacing.gapSm,
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: blueprint.keyConcepts
                      .map((c) => Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: const BoxDecoration(
                              color: AppColors.primarySurface,
                              borderRadius: BorderRadius.circular(
                                  AppSpacing.radiusFull),
                            ),
                            child: Text(c,
                                style: Theme.of(context)
                                    .textTheme
                                    .labelMedium
                                    ?.copyWith(color: AppColors.primary)),
                          ))
                      .toList(),
                ),
                AppSpacing.gapLg,
              ],

              if (blueprint.highYieldPoints.isNotEmpty) ...[
                const _SectionHeader(
                  icon: Icons.star_outline_rounded,
                  title: 'High-Yield Points',
                  color: AppColors.warning,
                ),
                AppSpacing.gapSm,
                ...blueprint.highYieldPoints.map(
                  (point) => _HighlightItem(text: point),
                ),
                AppSpacing.gapLg,
              ],

              if (blueprint.commonTraps.isNotEmpty) ...[
                const _SectionHeader(
                  icon: Icons.warning_amber_rounded,
                  title: 'Common Traps',
                  color: AppColors.error,
                ),
                AppSpacing.gapSm,
                ...blueprint.commonTraps.map(
                  (trap) => _TrapItem(text: trap),
                ),
                AppSpacing.gapLg,
              ],

              if (blueprint.termsToDefine.isNotEmpty) ...[
                const _SectionHeader(
                  icon: Icons.menu_book_outlined,
                  title: 'Key Terms',
                ),
                AppSpacing.gapSm,
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: blueprint.termsToDefine
                      .map((term) => Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: const BoxDecoration(
                              color: AppColors.surfaceVariant,
                              borderRadius: BorderRadius.circular(
                                  AppSpacing.radiusFull),
                            ),
                            child: Text(term,
                                style: Theme.of(context)
                                    .textTheme
                                    .labelMedium),
                          ))
                      .toList(),
                ),
                AppSpacing.gapLg,
              ],
            ] else ...[
              Center(
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(vertical: AppSpacing.xxl),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: const BoxDecoration(
                          color: AppColors.secondarySurface,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.auto_awesome_rounded,
                            color: AppColors.secondary, size: 28),
                      ),
                      AppSpacing.gapMd,
                      Text(
                        'Study guide generating...',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(color: AppColors.textSecondary),
                      ),
                      AppSpacing.gapXs,
                      Text(
                        'AI analysis is still processing this section',
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(color: AppColors.textTertiary),
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
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: c.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Icon(icon, color: c, size: 14),
        ),
        AppSpacing.hGapSm,
        Text(
          title,
          style: Theme.of(context)
              .textTheme
              .titleSmall
              ?.copyWith(color: c, fontWeight: FontWeight.w700),
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
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: c),
          const SizedBox(width: 4),
          Text(
            label,
            style: Theme.of(context)
                .textTheme
                .labelSmall
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
            padding: const EdgeInsets.only(top: 7),
            child: Container(
              width: 5,
              height: 5,
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
            ),
          ),
          AppSpacing.hGapSm,
          Expanded(
            child: Text(text,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textPrimary,
                      height: 1.5,
                    )),
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
      decoration: const BoxDecoration(
        color: AppColors.warningSurface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border(
          left: BorderSide(color: AppColors.warning, width: 3),
        ),
      ),
      child: Text(text,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppColors.textPrimary,
                height: 1.5,
              )),
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
      decoration: const BoxDecoration(
        color: AppColors.errorSurface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border(
          left: BorderSide(color: AppColors.error, width: 3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_amber_rounded,
              color: AppColors.error, size: 16),
          AppSpacing.hGapSm,
          Expanded(
            child: Text(text,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textPrimary,
                      height: 1.5,
                    )),
          ),
        ],
      ),
    );
  }
}
