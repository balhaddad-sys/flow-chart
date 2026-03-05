import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
import '../../../models/section_model.dart';
import '../providers/session_provider.dart';

class ActiveLearningPanel extends ConsumerWidget {
  final String sectionId;

  const ActiveLearningPanel({super.key, required this.sectionId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sectionAsync = ref.watch(sectionForSessionProvider(sectionId));
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return sectionAsync.when(
      loading: () => _buildLoading(context, isDark),
      error: (e, _) => Center(
        child: Padding(
          padding: AppSpacing.cardPadding,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded,
                  color: AppColors.error, size: 40),
              AppSpacing.gapMd,
              Text('Error loading study guide',
                  style: Theme.of(context).textTheme.titleMedium),
              AppSpacing.gapSm,
              Text('$e',
                  style: Theme.of(context).textTheme.bodySmall,
                  textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
      data: (section) {
        if (section == null) {
          return const Center(child: Text('Section not found'));
        }
        return _buildContent(context, ref, section, isDark);
      },
    );
  }

  Widget _buildLoading(BuildContext context, bool isDark) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 48,
            height: 48,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              color: AppColors.primary,
            ),
          ),
          AppSpacing.gapLg,
          Text(
            'Loading study guide...',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(
      BuildContext context, WidgetRef ref, SectionModel section, bool isDark) {
    final blueprint = section.blueprint;

    // Handle non-blueprint states first
    if (blueprint == null) {
      Widget statusCard;
      if (section.aiStatus == 'FAILED') {
        statusCard = _FailedCard(
          isDark: isDark,
          onRetry: () async {
            try {
              await ref
                  .read(cloudFunctionsServiceProvider)
                  .retryFailedSections(courseId: section.courseId);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Retrying analysis...')),
                );
              }
            } catch (e) {
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Retry failed: $e')),
                );
              }
            }
          },
        );
      } else if (section.aiStatus == 'ANALYZED') {
        statusCard = _DataMissingCard(
          isDark: isDark,
          onRetry: () async {
            try {
              await ref
                  .read(cloudFunctionsServiceProvider)
                  .retryFailedSections(courseId: section.courseId);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Retrying analysis...')),
                );
              }
            } catch (e) {
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Retry failed: $e')),
                );
              }
            }
          },
        );
      } else if (section.aiStatus == 'PROCESSING') {
        statusCard = _GeneratingCard(
          isDark: isDark,
          title: 'Analyzing Section',
          message:
              'AI is analyzing this section and creating your personalized study guide. This will update automatically.',
        );
      } else {
        statusCard = _GeneratingCard(
          isDark: isDark,
          title: 'Waiting for Analysis',
          message:
              'This section is queued for AI analysis. It will start automatically.',
        );
      }

      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _HeaderCard(section: section, isDark: isDark),
          const SizedBox(height: 20),
          statusCard,
          const SizedBox(height: 20),
        ],
      );
    }

    // Build content blocks
    final blocks = <Widget>[];

    if (blueprint.learningObjectives.isNotEmpty) {
      blocks.add(_SectionBlock(
        icon: Icons.flag_rounded,
        title: 'Learning Objectives',
        color: AppColors.primary,
        isDark: isDark,
        child: Column(
          children: blueprint.learningObjectives
              .asMap()
              .entries
              .map((entry) => _ObjectiveItem(
                    index: entry.key + 1,
                    text: entry.value,
                    isDark: isDark,
                  ))
              .toList(),
        ),
      ));
    }

    if (blueprint.keyConcepts.isNotEmpty) {
      blocks.add(_SectionBlock(
        icon: Icons.lightbulb_rounded,
        title: 'Key Concepts',
        color: AppColors.accent,
        isDark: isDark,
        child: Wrap(
          spacing: 8,
          runSpacing: 8,
          children: blueprint.keyConcepts
              .map((c) => _ConceptChip(
                    label: c,
                    color: AppColors.accent,
                    isDark: isDark,
                  ))
              .toList(),
        ),
      ));
    }

    if (blueprint.highYieldPoints.isNotEmpty) {
      blocks.add(_SectionBlock(
        icon: Icons.star_rounded,
        title: 'High-Yield Points',
        color: AppColors.warning,
        isDark: isDark,
        child: Column(
          children: blueprint.highYieldPoints
              .map((p) => _HighYieldCard(text: p, isDark: isDark))
              .toList(),
        ),
      ));
    }

    if (blueprint.commonTraps.isNotEmpty) {
      blocks.add(_SectionBlock(
        icon: Icons.warning_rounded,
        title: 'Common Traps',
        color: AppColors.error,
        isDark: isDark,
        child: Column(
          children: blueprint.commonTraps
              .map((t) => _TrapCard(text: t, isDark: isDark))
              .toList(),
        ),
      ));
    }

    if (blueprint.termsToDefine.isNotEmpty) {
      blocks.add(_SectionBlock(
        icon: Icons.menu_book_rounded,
        title: 'Key Terms',
        color: AppColors.secondary,
        isDark: isDark,
        child: Wrap(
          spacing: 8,
          runSpacing: 8,
          children: blueprint.termsToDefine
              .map((t) => _ConceptChip(
                    label: t,
                    color: AppColors.secondary,
                    isDark: isDark,
                  ))
              .toList(),
        ),
      ));
    }

    // When blueprint exists but all arrays are empty
    if (blocks.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _HeaderCard(section: section, isDark: isDark),
          const SizedBox(height: 20),
          _DataMissingCard(
            isDark: isDark,
            onRetry: () async {
              try {
                await ref
                    .read(cloudFunctionsServiceProvider)
                    .retryFailedSections(courseId: section.courseId);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Retrying analysis...')),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Retry failed: $e')),
                  );
                }
              }
            },
          ),
          const SizedBox(height: 20),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _HeaderCard(section: section, isDark: isDark),
        const SizedBox(height: 20),
        ...blocks.expand((b) => [b, const SizedBox(height: 16)]),
        const SizedBox(height: 20),
      ],
    );
  }
}

// ── Header Card ──────────────────────────────────────────────────────────────

class _HeaderCard extends StatelessWidget {
  final SectionModel section;
  final bool isDark;

  const _HeaderCard({required this.section, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? [
                  AppColors.primary.withValues(alpha: 0.15),
                  AppColors.accent.withValues(alpha: 0.08),
                ]
              : [
                  AppColors.primary.withValues(alpha: 0.06),
                  AppColors.accent.withValues(alpha: 0.03),
                ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: isDark ? 0.2 : 0.12),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  section.title,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: isDark
                            ? AppColors.darkTextPrimary
                            : AppColors.textPrimary,
                        height: 1.3,
                      ),
                ),
              ),
              const SizedBox(width: 8),
              _AiStatusBadge(
                  aiStatus: section.aiStatus, isDark: isDark),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _MetaChip(
                icon: Icons.schedule_rounded,
                label: '${section.estMinutes} min',
                isDark: isDark,
              ),
              _MetaChip(
                icon: Icons.signal_cellular_alt_rounded,
                label: 'Level ${section.difficulty}/5',
                isDark: isDark,
              ),
              ...section.topicTags.map(
                (tag) => _MetaChip(
                  icon: Icons.tag_rounded,
                  label: tag,
                  isDark: isDark,
                  color: AppColors.secondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AiStatusBadge extends StatelessWidget {
  final String aiStatus;
  final bool isDark;

  const _AiStatusBadge({required this.aiStatus, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final Color color;
    final IconData icon;
    final String label;

    switch (aiStatus) {
      case 'ANALYZED':
        color = AppColors.success;
        icon = Icons.check_circle_rounded;
        label = 'Analyzed';
      case 'PROCESSING':
        color = AppColors.secondary;
        icon = Icons.sync_rounded;
        label = 'Analyzing';
      case 'FAILED':
        color = AppColors.error;
        icon = Icons.error_rounded;
        label = 'Failed';
      default:
        color = AppColors.warning;
        icon = Icons.hourglass_top_rounded;
        label = 'Pending';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isDark;
  final Color? color;

  const _MetaChip({
    required this.icon,
    required this.label,
    required this.isDark,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ??
        (isDark ? AppColors.darkTextSecondary : AppColors.textSecondary);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: c.withValues(alpha: isDark ? 0.12 : 0.08),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: c),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: c,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Section Block ────────────────────────────────────────────────────────────

class _SectionBlock extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color color;
  final bool isDark;
  final Widget child;

  const _SectionBlock({
    required this.icon,
    required this.title,
    required this.color,
    required this.isDark,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section header
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            decoration: BoxDecoration(
              color: color.withValues(alpha: isDark ? 0.1 : 0.05),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(15),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: isDark ? 0.2 : 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, color: color, size: 16),
                ),
                const SizedBox(width: 10),
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: color,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.2,
                      ),
                ),
              ],
            ),
          ),
          // Content
          Padding(
            padding: const EdgeInsets.all(16),
            child: child,
          ),
        ],
      ),
    );
  }
}

// ── Content Items ────────────────────────────────────────────────────────────

class _ObjectiveItem extends StatelessWidget {
  final int index;
  final String text;
  final bool isDark;

  const _ObjectiveItem({
    required this.index,
    required this.text,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 22,
            height: 22,
            margin: const EdgeInsets.only(top: 1),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: isDark ? 0.2 : 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Center(
              child: Text(
                '$index',
                style: TextStyle(
                  color: AppColors.primary,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: isDark
                        ? AppColors.darkTextPrimary
                        : AppColors.textPrimary,
                    height: 1.5,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConceptChip extends StatelessWidget {
  final String label;
  final Color color;
  final bool isDark;

  const _ConceptChip({
    required this.label,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.12 : 0.07),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: color.withValues(alpha: isDark ? 0.2 : 0.15),
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _HighYieldCard extends StatelessWidget {
  final String text;
  final bool isDark;

  const _HighYieldCard({required this.text, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: isDark ? 0.1 : 0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border(
          left: BorderSide(
            color: AppColors.warning,
            width: 3,
          ),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.star_rounded,
            color: AppColors.warning,
            size: 18,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: isDark
                        ? AppColors.darkTextPrimary
                        : AppColors.textPrimary,
                    height: 1.5,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TrapCard extends StatelessWidget {
  final String text;
  final bool isDark;

  const _TrapCard({required this.text, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: isDark ? 0.1 : 0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border(
          left: BorderSide(
            color: AppColors.error,
            width: 3,
          ),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.warning_amber_rounded,
            color: AppColors.error,
            size: 18,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: isDark
                        ? AppColors.darkTextPrimary
                        : AppColors.textPrimary,
                    height: 1.5,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Generating State ─────────────────────────────────────────────────────────

class _GeneratingCard extends StatefulWidget {
  final bool isDark;
  final String title;
  final String message;

  const _GeneratingCard({
    required this.isDark,
    this.title = 'Generating Study Guide',
    this.message =
        'AI is analyzing this section and creating your personalized study guide. This will update automatically.',
  });

  @override
  State<_GeneratingCard> createState() => _GeneratingCardState();
}

class _GeneratingCardState extends State<_GeneratingCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween<double>(begin: 0.5, end: 1.0).animate(
        CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
      ),
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: widget.isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.secondary.withValues(alpha: 0.2),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.secondary.withValues(alpha: 0.15),
                    AppColors.primary.withValues(alpha: 0.1),
                  ],
                ),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.auto_awesome_rounded,
                  color: AppColors.secondary, size: 28),
            ),
            const SizedBox(height: 16),
            Text(
              widget.title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: widget.isDark
                        ? AppColors.darkTextPrimary
                        : AppColors.textPrimary,
                  ),
            ),
            const SizedBox(height: 6),
            Text(
              widget.message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: widget.isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary,
                    height: 1.5,
                  ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: 120,
              child: LinearProgressIndicator(
                backgroundColor: AppColors.secondary.withValues(alpha: 0.1),
                color: AppColors.secondary,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Failed State ────────────────────────────────────────────────────────────

class _FailedCard extends StatelessWidget {
  final bool isDark;
  final VoidCallback? onRetry;

  const _FailedCard({required this.isDark, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.error.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.error_outline_rounded,
                color: AppColors.error, size: 28),
          ),
          const SizedBox(height: 16),
          Text(
            'Analysis Failed',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: isDark
                      ? AppColors.darkTextPrimary
                      : AppColors.textPrimary,
                ),
          ),
          const SizedBox(height: 6),
          Text(
            'The AI could not analyze this section. This can happen with scanned or image-heavy PDFs. You can still study the PDF directly.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextTertiary
                      : AppColors.textTertiary,
                  height: 1.5,
                ),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: 16),
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Retry Analysis'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.error,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Data Missing State ──────────────────────────────────────────────────────

class _DataMissingCard extends StatelessWidget {
  final bool isDark;
  final VoidCallback? onRetry;

  const _DataMissingCard({required this.isDark, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.warning.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.info_outline_rounded,
                color: AppColors.warning, size: 28),
          ),
          const SizedBox(height: 16),
          Text(
            'Study Guide Unavailable',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: isDark
                      ? AppColors.darkTextPrimary
                      : AppColors.textPrimary,
                ),
          ),
          const SizedBox(height: 6),
          Text(
            'The AI analysis returned no content for this section. This can happen with scanned or image-heavy PDFs.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextTertiary
                      : AppColors.textTertiary,
                  height: 1.5,
                ),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: 16),
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Retry Analysis'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.warning,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
