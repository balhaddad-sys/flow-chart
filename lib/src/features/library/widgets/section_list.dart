// FILE: lib/src/features/library/widgets/section_list.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/utils/date_utils.dart';
import '../../../models/section_model.dart';
import '../providers/library_provider.dart';
import '../../quiz/screens/quiz_screen.dart';

class SectionList extends ConsumerWidget {
  final String fileId;
  final String courseId;

  const SectionList({
    super.key,
    required this.fileId,
    required this.courseId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sectionsAsync = ref.watch(sectionsProvider(fileId));
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return sectionsAsync.when(
      loading: () => _SkeletonSections(isDark: isDark),
      error: (e, _) => Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Text(
          'Unable to load sections. Please try again.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.error,
              ),
        ),
      ),
      data: (sections) {
        if (sections.isEmpty) {
          return Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              children: [
                Icon(
                  Icons.info_outline_rounded,
                  size: 14,
                  color: isDark
                      ? AppColors.darkTextTertiary
                      : AppColors.textTertiary,
                ),
                const SizedBox(width: 6),
                Text(
                  'No sections extracted yet',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary,
                      ),
                ),
              ],
            ),
          );
        }

        return Column(
          children: sections
              .asMap()
              .entries
              .map((entry) => _SectionRow(
                    index: entry.key + 1,
                    section: entry.value,
                    courseId: courseId,
                    isDark: isDark,
                    ref: ref,
                  ))
              .toList(),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section row
// ─────────────────────────────────────────────────────────────────────────────

class _SectionRow extends StatelessWidget {
  final int index;
  final SectionModel section;
  final String courseId;
  final bool isDark;
  final WidgetRef ref;

  const _SectionRow({
    required this.index,
    required this.section,
    required this.courseId,
    required this.isDark,
    required this.ref,
  });

  bool get _hasQuestions => section.questionsCount > 0;
  bool get _isQuizReady =>
      section.aiStatus == 'ANALYZED' && _hasQuestions;
  bool get _isGenerating =>
      section.questionsStatus == 'GENERATING';
  bool get _isAnalyzed => section.aiStatus == 'ANALYZED';
  bool get _canGenerate =>
      _isAnalyzed && !_isGenerating && !_hasQuestions;
  bool get _isFailed =>
      _isAnalyzed &&
      section.questionsStatus == 'FAILED' &&
      !_hasQuestions;

  Future<void> _generateQuestions(BuildContext context) async {
    try {
      final cloudFunctions = ref.read(cloudFunctionsServiceProvider);
      await cloudFunctions.generateQuestions(
        courseId: courseId,
        sectionId: section.id,
        count: 10,
      );
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to generate questions: $e'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final diffColor = section.difficulty <= 2
        ? AppColors.difficultyEasy
        : section.difficulty <= 3
            ? AppColors.difficultyMedium
            : AppColors.difficultyHard;

    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md, vertical: 10),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: isDark ? AppColors.darkBorder : AppColors.border,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Index badge
              Container(
                width: 24,
                height: 24,
                margin: const EdgeInsets.only(top: 1),
                decoration: BoxDecoration(
                  color: isDark
                      ? AppColors.darkSurfaceVariant
                      : AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Center(
                  child: Text(
                    '$index',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // Title + meta
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      section.title,
                      style:
                          Theme.of(context).textTheme.bodyMedium?.copyWith(
                                fontWeight: FontWeight.w600,
                                color: isDark
                                    ? AppColors.darkTextPrimary
                                    : AppColors.textPrimary,
                              ),
                    ),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        _MetaBadge(
                          icon: Icons.timer_outlined,
                          label: AppDateUtils.formatDuration(
                              section.estMinutes),
                          isDark: isDark,
                        ),
                        _MetaBadge(
                          icon: Icons.signal_cellular_alt_rounded,
                          label: 'Diff ${section.difficulty}/5',
                          color: diffColor,
                          isDark: isDark,
                        ),
                        if (_hasQuestions)
                          _MetaBadge(
                            icon: Icons.quiz_outlined,
                            label: '${section.questionsCount} Qs',
                            isDark: isDark,
                          ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 8),

              // Action button
              _ActionArea(
                isQuizReady: _isQuizReady,
                isGenerating: _isGenerating,
                canGenerate: _canGenerate,
                isFailed: _isFailed,
                section: section,
                isDark: isDark,
                onGenerate: () => _generateQuestions(context),
                onQuiz: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) =>
                        QuizScreen(sectionId: section.id, mode: 'section'),
                  ),
                ),
              ),
            ],
          ),

          // Topic tags
          if (section.topicTags.isNotEmpty) ...[
            const SizedBox(height: 6),
            Padding(
              padding: const EdgeInsets.only(left: 32),
              child: Wrap(
                spacing: 4,
                runSpacing: 4,
                children: section.topicTags.take(2).map((tag) {
                  return Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      tag,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        color: AppColors.primary,
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Action area ────────────────────────────────────────────────────────────

class _ActionArea extends StatelessWidget {
  final bool isQuizReady;
  final bool isGenerating;
  final bool canGenerate;
  final bool isFailed;
  final SectionModel section;
  final bool isDark;
  final VoidCallback onGenerate;
  final VoidCallback onQuiz;

  const _ActionArea({
    required this.isQuizReady,
    required this.isGenerating,
    required this.canGenerate,
    required this.isFailed,
    required this.section,
    required this.isDark,
    required this.onGenerate,
    required this.onQuiz,
  });

  @override
  Widget build(BuildContext context) {
    if (isGenerating) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(
              strokeWidth: 1.5,
              color: isDark
                  ? AppColors.darkTextSecondary
                  : AppColors.textSecondary,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            'Generating',
            style: TextStyle(
              fontSize: 11,
              color: isDark
                  ? AppColors.darkTextSecondary
                  : AppColors.textSecondary,
            ),
          ),
        ],
      );
    }

    if (isQuizReady) {
      return GestureDetector(
        onTap: onQuiz,
        child: Container(
          padding:
              const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.play_arrow_rounded,
                  size: 14, color: Colors.white),
              SizedBox(width: 4),
              Text(
                'Quiz',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (canGenerate || isFailed) {
      return GestureDetector(
        onTap: onGenerate,
        child: Container(
          padding:
              const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            border: Border.all(
              color: isFailed ? AppColors.error : AppColors.primary,
            ),
            borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                isFailed ? Icons.refresh_rounded : Icons.auto_awesome_rounded,
                size: 12,
                color: isFailed ? AppColors.error : AppColors.primary,
              ),
              const SizedBox(width: 4),
              Text(
                isFailed ? 'Retry' : 'Generate',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isFailed ? AppColors.error : AppColors.primary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // AI status is PENDING or PROCESSING
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 12,
          height: 12,
          child: CircularProgressIndicator(
            strokeWidth: 1.5,
            color: isDark
                ? AppColors.darkTextTertiary
                : AppColors.textTertiary,
          ),
        ),
        const SizedBox(width: 5),
        Text(
          'Analyzing',
          style: TextStyle(
            fontSize: 11,
            color: isDark
                ? AppColors.darkTextTertiary
                : AppColors.textTertiary,
          ),
        ),
      ],
    );
  }
}

// ── Meta badge ─────────────────────────────────────────────────────────────

class _MetaBadge extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;
  final bool isDark;

  const _MetaBadge({
    required this.icon,
    required this.label,
    this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ??
        (isDark ? AppColors.darkTextTertiary : AppColors.textTertiary);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: c),
        const SizedBox(width: 3),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: c,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

// ── Skeleton loading ───────────────────────────────────────────────────────

class _SkeletonSections extends StatefulWidget {
  final bool isDark;

  const _SkeletonSections({required this.isDark});

  @override
  State<_SkeletonSections> createState() => _SkeletonSectionsState();
}

class _SkeletonSectionsState extends State<_SkeletonSections>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _anim = CurvedAnimation(parent: _controller, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (context, child) {
        final opacity = 0.4 + (_anim.value * 0.3);
        return Opacity(
          opacity: opacity,
          child: Column(
            children: List.generate(
              3,
              (i) => Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md, vertical: 10),
                decoration: BoxDecoration(
                  border: Border(
                    top: BorderSide(
                      color: widget.isDark
                          ? AppColors.darkBorder
                          : AppColors.border,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    _Skel(width: 24, height: 24, isDark: widget.isDark),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _Skel(
                            width: 160, height: 12, isDark: widget.isDark),
                        const SizedBox(height: 6),
                        _Skel(
                            width: 80, height: 10, isDark: widget.isDark),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Skel extends StatelessWidget {
  final double width;
  final double height;
  final bool isDark;

  const _Skel(
      {required this.width, required this.height, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}
