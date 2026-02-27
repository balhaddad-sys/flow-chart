import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../providers/session_provider.dart';

// ── Knowledge stages (mirrors web STAGE_META) ─────────────────────────────

enum _KnowledgeStage { study, questions, review }

const _stageMeta = {
  _KnowledgeStage.study: (
    label: 'Learn',
    icon: Icons.menu_book_rounded,
    color: Color(0xFF2563EB),
    bg: Color(0xFFDBEAFE),
    desc: 'Build understanding — focus on objectives and key concepts.',
  ),
  _KnowledgeStage.questions: (
    label: 'Test',
    icon: Icons.help_outline_rounded,
    color: Color(0xFF059669),
    bg: Color(0xFFD1FAE5),
    desc: 'Challenge recall — focus on high-yield facts and common traps.',
  ),
  _KnowledgeStage.review: (
    label: 'Review',
    icon: Icons.refresh_rounded,
    color: Color(0xFF7C3AED),
    bg: Color(0xFFEDE9FE),
    desc: 'Consolidate knowledge — synthesise and practise recall.',
  ),
};

class ActiveLearningPanel extends ConsumerStatefulWidget {
  final String sectionId;

  const ActiveLearningPanel({super.key, required this.sectionId});

  @override
  ConsumerState<ActiveLearningPanel> createState() =>
      _ActiveLearningPanelState();
}

class _ActiveLearningPanelState extends ConsumerState<ActiveLearningPanel>
    with AutomaticKeepAliveClientMixin {
  _KnowledgeStage _stage = _KnowledgeStage.study;

  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final sectionAsync = ref.watch(sectionForSessionProvider(widget.sectionId));

    return sectionAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => const Center(
          child: Text('Unable to load study content. Please try again.')),
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
                    label: '${section.estMinutes} min'),
                _InfoChip(
                    icon: Icons.signal_cellular_alt_rounded,
                    label: 'Difficulty ${section.difficulty}/5'),
                ...section.topicTags.map((tag) => _InfoChip(
                      icon: Icons.label_outline_rounded,
                      label: tag,
                      color: AppColors.secondary,
                    )),
              ],
            ),
            AppSpacing.gapLg,

            // ── Stage selector ──────────────────────────────────────────
            _StageSelector(
              current: _stage,
              isDark: isDark,
              onChanged: (s) => setState(() => _stage = s),
            ),
            AppSpacing.gapLg,

            // ── Stage description ───────────────────────────────────────
            _StageDescription(stage: _stage, isDark: isDark),
            AppSpacing.gapLg,

            if (blueprint != null) ...[
              // ── LEARN: Objectives → Concepts → Terms ───────────────
              if (_stage == _KnowledgeStage.study) ...[
                if (blueprint.learningObjectives.isNotEmpty) ...[
                  const _SectionHeader(
                      icon: Icons.flag_outlined,
                      title: 'Learning Objectives'),
                  AppSpacing.gapSm,
                  ...blueprint.learningObjectives
                      .map((obj) => _BulletItem(text: obj)),
                  AppSpacing.gapLg,
                ],
                if (blueprint.keyConcepts.isNotEmpty) ...[
                  const _SectionHeader(
                      icon: Icons.lightbulb_outline_rounded,
                      title: 'Key Concepts'),
                  AppSpacing.gapSm,
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: blueprint.keyConcepts
                        .map((c) => Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
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
                if (blueprint.termsToDefine.isNotEmpty) ...[
                  const _SectionHeader(
                      icon: Icons.menu_book_outlined, title: 'Key Terms'),
                  AppSpacing.gapSm,
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: blueprint.termsToDefine
                        .map((term) => Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: isDark
                                    ? AppColors.darkSurfaceVariant
                                    : AppColors.surfaceVariant,
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
              ],

              // ── TEST: High-Yield → Common Traps ────────────────────
              if (_stage == _KnowledgeStage.questions) ...[
                if (blueprint.highYieldPoints.isNotEmpty) ...[
                  const _SectionHeader(
                    icon: Icons.star_outline_rounded,
                    title: 'High-Yield Points',
                    color: AppColors.warning,
                  ),
                  AppSpacing.gapSm,
                  ...blueprint.highYieldPoints
                      .map((point) => _HighlightItem(text: point)),
                  AppSpacing.gapLg,
                ],
                if (blueprint.commonTraps.isNotEmpty) ...[
                  const _SectionHeader(
                    icon: Icons.warning_amber_rounded,
                    title: 'Common Traps',
                    color: AppColors.error,
                  ),
                  AppSpacing.gapSm,
                  ...blueprint.commonTraps
                      .map((trap) => _TrapItem(text: trap)),
                  AppSpacing.gapLg,
                ],
                if (blueprint.highYieldPoints.isEmpty &&
                    blueprint.commonTraps.isEmpty)
                  _EmptyStage(
                    message:
                        'No high-yield content available for this section yet.',
                    isDark: isDark,
                  ),
              ],

              // ── REVIEW: All content condensed ──────────────────────
              if (_stage == _KnowledgeStage.review) ...[
                if (blueprint.learningObjectives.isNotEmpty) ...[
                  const _SectionHeader(
                      icon: Icons.flag_outlined,
                      title: 'Objectives'),
                  AppSpacing.gapSm,
                  ...blueprint.learningObjectives
                      .map((obj) => _BulletItem(text: obj)),
                  AppSpacing.gapLg,
                ],
                if (blueprint.highYieldPoints.isNotEmpty) ...[
                  const _SectionHeader(
                    icon: Icons.star_outline_rounded,
                    title: 'High-Yield Points',
                    color: AppColors.warning,
                  ),
                  AppSpacing.gapSm,
                  ...blueprint.highYieldPoints
                      .map((point) => _HighlightItem(text: point)),
                  AppSpacing.gapLg,
                ],
                if (blueprint.commonTraps.isNotEmpty) ...[
                  const _SectionHeader(
                    icon: Icons.warning_amber_rounded,
                    title: 'Common Traps',
                    color: AppColors.error,
                  ),
                  AppSpacing.gapSm,
                  ...blueprint.commonTraps
                      .map((trap) => _TrapItem(text: trap)),
                  AppSpacing.gapLg,
                ],
              ],
            ] else ...[
              Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      vertical: AppSpacing.xxl),
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

// ── Stage selector widget ──────────────────────────────────────────────────

class _StageSelector extends StatelessWidget {
  final _KnowledgeStage current;
  final bool isDark;
  final ValueChanged<_KnowledgeStage> onChanged;

  const _StageSelector(
      {required this.current, required this.isDark, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
      padding: const EdgeInsets.all(3),
      child: Row(
        children: _KnowledgeStage.values.map((s) {
          final meta = _stageMeta[s]!;
          final isActive = s == current;
          return Expanded(
            child: GestureDetector(
              onTap: () => onChanged(s),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: isActive
                      ? (isDark ? AppColors.darkSurface : AppColors.surface)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                  boxShadow: isActive
                      ? [
                          BoxShadow(
                            color: const Color(0xFF0F172A).withValues(alpha: 0.06),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          )
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(meta.icon,
                        size: 14,
                        color: isActive ? meta.color : (isDark ? AppColors.darkTextTertiary : AppColors.textTertiary)),
                    const SizedBox(width: 4),
                    Text(
                      meta.label,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                        color: isActive
                            ? meta.color
                            : (isDark ? AppColors.darkTextTertiary : AppColors.textTertiary),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _StageDescription extends StatelessWidget {
  final _KnowledgeStage stage;
  final bool isDark;

  const _StageDescription({required this.stage, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final meta = _stageMeta[stage]!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: meta.bg.withValues(alpha: isDark ? 0.15 : 0.5),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border.all(color: meta.color.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Icon(meta.icon, size: 14, color: meta.color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              meta.desc,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontSize: 12,
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyStage extends StatelessWidget {
  final String message;
  final bool isDark;

  const _EmptyStage({required this.message, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxl),
      child: Center(
        child: Text(
          message,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary),
          textAlign: TextAlign.center,
        ),
      ),
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
      decoration: BoxDecoration(
        color: AppColors.warningSurface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: const Border(
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
      decoration: BoxDecoration(
        color: AppColors.errorSurface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: const Border(
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
