import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../models/section_model.dart';

/// Fetches the section model for the active learning panel.
final _sectionProvider =
    FutureProvider.family<SectionModel?, String>((ref, sectionId) async {
  final uid = ref.watch(uidProvider);
  if (uid == null) return null;
  return ref.watch(firestoreServiceProvider).getSection(uid, sectionId: sectionId);
});

class ActiveLearningPanel extends ConsumerWidget {
  final String sectionId;

  const ActiveLearningPanel({super.key, required this.sectionId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sectionAsync = ref.watch(_sectionProvider(sectionId));

    return sectionAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
      data: (section) {
        if (section == null) {
          return const Center(child: Text('Section not found'));
        }

        final blueprint = section.blueprint;

        return ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            // Section title
            Text(
              section.title,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: AppSpacing.xs),
            Wrap(
              spacing: AppSpacing.xs,
              children: section.topicTags
                  .map((tag) => Chip(
                        label: Text(tag),
                        visualDensity: VisualDensity.compact,
                        materialTapTargetSize:
                            MaterialTapTargetSize.shrinkWrap,
                      ))
                  .toList(),
            ),
            const SizedBox(height: AppSpacing.lg),

            // Learning objectives
            if (blueprint != null &&
                blueprint.learningObjectives.isNotEmpty) ...[
              const _SectionHeader(
                icon: Icons.flag_outlined,
                title: 'Learning Objectives',
                color: AppColors.primary,
              ),
              ...blueprint.learningObjectives.map(
                (obj) => _BulletItem(text: obj),
              ),
              const SizedBox(height: AppSpacing.lg),
            ],

            // Key concepts
            if (blueprint != null &&
                blueprint.keyConcepts.isNotEmpty) ...[
              const _SectionHeader(
                icon: Icons.lightbulb_outline,
                title: 'Key Concepts',
                color: AppColors.secondary,
              ),
              ...blueprint.keyConcepts.map(
                (concept) => _ConceptCard(text: concept),
              ),
              const SizedBox(height: AppSpacing.lg),
            ],

            // High-yield points
            if (blueprint != null &&
                blueprint.highYieldPoints.isNotEmpty) ...[
              const _SectionHeader(
                icon: Icons.star_outline,
                title: 'High-Yield Points',
                color: AppColors.warning,
              ),
              ...blueprint.highYieldPoints.map(
                (point) => _HighlightItem(text: point),
              ),
              const SizedBox(height: AppSpacing.lg),
            ],

            // Common traps
            if (blueprint != null &&
                blueprint.commonTraps.isNotEmpty) ...[
              const _SectionHeader(
                icon: Icons.warning_amber,
                title: 'Common Traps',
                color: AppColors.error,
              ),
              ...blueprint.commonTraps.map(
                (trap) => _TrapItem(text: trap),
              ),
              const SizedBox(height: AppSpacing.lg),
            ],

            // Terms to define
            if (blueprint != null &&
                blueprint.termsToDefine.isNotEmpty) ...[
              const _SectionHeader(
                icon: Icons.menu_book,
                title: 'Terms to Define',
                color: AppColors.info,
              ),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: blueprint.termsToDefine
                    .map((term) => Chip(
                          label: Text(term),
                          backgroundColor:
                              AppColors.info.withValues(alpha: 0.08),
                          side: BorderSide(
                            color: AppColors.info.withValues(alpha: 0.2),
                          ),
                        ))
                    .toList(),
              ),
              const SizedBox(height: AppSpacing.lg),
            ],

            // Fallback when no blueprint is available
            if (blueprint == null) ...[
              Container(
                padding: AppSpacing.cardPadding,
                decoration: BoxDecoration(
                  color: AppColors.surfaceVariant,
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusMd),
                ),
                child: Column(
                  children: [
                    const Icon(Icons.auto_awesome,
                        color: AppColors.textTertiary, size: 40),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'AI analysis pending',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Key concepts and learning objectives will appear here once the section is analyzed.',
                      style: Theme.of(context).textTheme.bodySmall,
                      textAlign: TextAlign.center,
                    ),
                  ],
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
  final Color color;

  const _SectionHeader({
    required this.icon,
    required this.title,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: AppSpacing.sm),
          Text(
            title,
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(color: color),
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
      padding: const EdgeInsets.only(
        left: AppSpacing.md,
        bottom: AppSpacing.xs,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('• ', style: TextStyle(fontSize: 16)),
          Expanded(
            child: Text(text,
                style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }
}

class _ConceptCard extends StatelessWidget {
  final String text;
  const _ConceptCard({required this.text});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      color: AppColors.secondary.withValues(alpha: 0.05),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.circle, size: 8, color: AppColors.secondary),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(text,
                  style: Theme.of(context).textTheme.bodyMedium),
            ),
          ],
        ),
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
        border: Border.all(
          color: AppColors.warning.withValues(alpha: 0.2),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.star, size: 16, color: AppColors.warning),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(text,
                style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
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
        color: AppColors.error.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border.all(
          color: AppColors.error.withValues(alpha: 0.15),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_amber, size: 16, color: AppColors.error),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(text,
                style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }
}
