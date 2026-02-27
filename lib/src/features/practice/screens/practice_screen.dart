// FILE: lib/src/features/practice/screens/practice_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
import '../../../models/section_model.dart';
import '../../home/providers/home_provider.dart';
import '../../quiz/screens/quiz_screen.dart';
import '../providers/practice_provider.dart';

// ── Bucket helpers ────────────────────────────────────────────────────────────

enum _Bucket { ready, processing, needs }

_Bucket _getBucket(SectionModel s) {
  if (s.questionsCount > 0) return _Bucket.ready;
  if (s.aiStatus == 'PENDING' ||
      s.aiStatus == 'PROCESSING' ||
      s.questionsStatus == 'GENERATING') return _Bucket.processing;
  return _Bucket.needs;
}

// ── Practice Screen ───────────────────────────────────────────────────────────

class PracticeScreen extends ConsumerStatefulWidget {
  const PracticeScreen({super.key});

  @override
  ConsumerState<PracticeScreen> createState() => _PracticeScreenState();
}

class _PracticeScreenState extends ConsumerState<PracticeScreen> {
  int _selectedTab = 0; // 0 = Ready, 1 = All
  final Set<String> _generatingIds = {};

  Future<void> _handleGenerate(String sectionId) async {
    final courseId = ref.read(activeCourseIdProvider);
    if (courseId == null) return;
    setState(() => _generatingIds.add(sectionId));
    try {
      await ref.read(cloudFunctionsServiceProvider).generateQuestions(
            courseId: courseId,
            sectionId: sectionId,
            count: 10,
          );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is Exception
                  ? e.toString().replaceFirst('Exception: ', '')
                  : 'Failed to generate questions. Please try again.',
            ),
            behavior: SnackBarBehavior.floating,
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _generatingIds.remove(sectionId));
    }
  }

  void _pushQuiz(String sectionId, String mode) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => QuizScreen(sectionId: sectionId, mode: mode),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final courseId = ref.watch(activeCourseIdProvider);

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
      body: SafeArea(
        child: courseId == null
            ? _buildNoCourse(context, isDark)
            : _buildWithCourse(context, isDark, courseId),
      ),
    );
  }

  // ── No course state ─────────────────────────────────────────────────────────

  Widget _buildNoCourse(BuildContext context, bool isDark) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Header(isDark: isDark),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkSurface : AppColors.surface,
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              border: Border.all(
                color: isDark ? AppColors.darkBorder : AppColors.border,
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Select or create a course to start practising with AI-generated questions.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.textSecondary,
                          height: 1.5,
                        ),
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  onPressed: () => context.go('/onboarding'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 8),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                    textStyle: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                  child: const Text('Create Course'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Course loaded state ─────────────────────────────────────────────────────

  Widget _buildWithCourse(
      BuildContext context, bool isDark, String courseId) {
    final sectionsAsync = ref.watch(courseSectionsProvider(courseId));

    return sectionsAsync.when(
      loading: () => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Header(isDark: isDark),
            const SizedBox(height: 32),
            const Center(child: CircularProgressIndicator()),
          ],
        ),
      ),
      error: (_, __) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Header(isDark: isDark),
            const SizedBox(height: 20),
            Text(
              'Failed to load sections. Please try again.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
            ),
          ],
        ),
      ),
      data: (sections) {
        final ready =
            sections.where((s) => _getBucket(s) == _Bucket.ready).toList();
        final displayed = _selectedTab == 0 ? ready : sections;

        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
          children: [
            _Header(isDark: isDark),
            const SizedBox(height: 20),

            // ── Mode cards (only shown when ≥1 ready section) ────────────────
            if (ready.isNotEmpty) ...[
              _buildModeCards(context, isDark),
              const SizedBox(height: 20),
            ],

            // ── Sections panel ────────────────────────────────────────────────
            if (sections.isEmpty)
              _buildEmptySections(context, isDark)
            else
              _buildSectionsPanel(
                context,
                isDark,
                sections: sections,
                ready: ready,
                displayed: displayed,
              ),
          ],
        );
      },
    );
  }

  // ── Mode cards ──────────────────────────────────────────────────────────────

  Widget _buildModeCards(BuildContext context, bool isDark) {
    final modes = [
      _ModeCardData(
        icon: Icons.auto_awesome_rounded,
        label: 'Smart Mix',
        description: 'AI-weighted questions targeting your weak areas',
        iconColor: const Color(0xFF7C3AED),
        iconBg: const Color(0xFFF5F3FF),
        darkIconColor: const Color(0xFFA78BFA),
        darkIconBg: const Color(0xFFA78BFA).withValues(alpha: 0.12),
        onTap: () => _pushQuiz('_all', 'smart'),
      ),
      _ModeCardData(
        icon: Icons.shuffle_rounded,
        label: 'Random Quiz',
        description: 'Random questions from all your materials',
        iconColor: AppColors.primary,
        iconBg: AppColors.primarySubtle,
        darkIconColor: AppColors.primaryLight,
        darkIconBg: AppColors.primaryLight.withValues(alpha: 0.12),
        onTap: () => _pushQuiz('_all', 'random'),
      ),
      _ModeCardData(
        icon: Icons.psychology_rounded,
        label: 'Assessment',
        description: 'Structured assessment with detailed scoring',
        iconColor: AppColors.warning,
        iconBg: AppColors.warningLight,
        darkIconColor: const Color(0xFFFBBF24),
        darkIconBg: const Color(0xFFFBBF24).withValues(alpha: 0.12),
        onTap: () => context.go('/assessment'),
      ),
    ];

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: List.generate(modes.length, (i) {
        final m = modes[i];
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(
              left: i == 0 ? 0 : 5,
              right: i == modes.length - 1 ? 0 : 5,
            ),
            child: Material(
              color: isDark ? AppColors.darkSurface : AppColors.surface,
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              child: InkWell(
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                onTap: m.onTap,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                    border: Border.all(
                      color: isDark ? AppColors.darkBorder : AppColors.border,
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: isDark ? m.darkIconBg : m.iconBg,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(m.icon,
                            size: 20,
                            color: isDark ? m.darkIconColor : m.iconColor),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        m.label,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              fontWeight: FontWeight.w600,
                              fontSize: 12,
                            ),
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        m.description,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: isDark
                                  ? AppColors.darkTextSecondary
                                  : AppColors.textSecondary,
                              fontSize: 10,
                              height: 1.3,
                            ),
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  // ── Sections panel ──────────────────────────────────────────────────────────

  Widget _buildSectionsPanel(
    BuildContext context,
    bool isDark, {
    required List<SectionModel> sections,
    required List<SectionModel> ready,
    required List<SectionModel> displayed,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Tab header ────────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.fromLTRB(4, 4, 4, 0),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: isDark ? AppColors.darkBorder : AppColors.border,
                ),
              ),
            ),
            child: Row(
              children: [
                _TabChip(
                  label: 'Ready (${ready.length})',
                  selected: _selectedTab == 0,
                  onTap: () => setState(() => _selectedTab = 0),
                  isDark: isDark,
                ),
                const SizedBox(width: 4),
                _TabChip(
                  label: 'All (${sections.length})',
                  selected: _selectedTab == 1,
                  onTap: () => setState(() => _selectedTab = 1),
                  isDark: isDark,
                ),
              ],
            ),
          ),

          // ── Section list ──────────────────────────────────────────────────
          if (displayed.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: Text(
                  _selectedTab == 0
                      ? 'No sections are ready yet.\nGenerate questions from the All tab.'
                      : 'No sections found.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                        fontSize: 13,
                        height: 1.5,
                      ),
                  textAlign: TextAlign.center,
                ),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: displayed.length,
              separatorBuilder: (_, __) => Divider(
                height: 1,
                indent: 12,
                endIndent: 12,
                color: isDark ? AppColors.darkBorder : AppColors.border,
              ),
              itemBuilder: (context, index) => _SectionCard(
                section: displayed[index],
                isDark: isDark,
                isGenerating: _generatingIds.contains(displayed[index].id),
                onGenerate: _handleGenerate,
                onStartQuiz: (id) => _pushQuiz(id, 'section'),
              ),
            ),
        ],
      ),
    );
  }

  // ── Empty sections ──────────────────────────────────────────────────────────

  Widget _buildEmptySections(BuildContext context, bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: isDark
                    ? AppColors.darkSurfaceVariant
                    : AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                Icons.library_books_outlined,
                size: 24,
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'No sections yet',
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            Text(
              'Upload materials in the Library first.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                    fontSize: 13,
                  ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => context.go('/library'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                ),
                textStyle: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600),
              ),
              child: const Text('Go to Library'),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Header widget ─────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  final bool isDark;
  const _Header({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Practice',
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: -0.5,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          'AI-powered quizzes for your course material',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color:
                    isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                fontSize: 13,
                height: 1.5,
              ),
        ),
      ],
    );
  }
}

// ── Tab chip ──────────────────────────────────────────────────────────────────

class _TabChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool isDark;

  const _TabChip({
    required this.label,
    required this.selected,
    required this.onTap,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: selected
                    ? Colors.white
                    : (isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary),
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                fontSize: 13,
              ),
        ),
      ),
    );
  }
}

// ── Section card ──────────────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  final SectionModel section;
  final bool isDark;
  final bool isGenerating;
  final Future<void> Function(String) onGenerate;
  final void Function(String) onStartQuiz;

  const _SectionCard({
    required this.section,
    required this.isDark,
    required this.isGenerating,
    required this.onGenerate,
    required this.onStartQuiz,
  });

  @override
  Widget build(BuildContext context) {
    final canStartQuiz = section.questionsCount > 0;
    final canGenerate = section.aiStatus == 'ANALYZED' &&
        section.questionsStatus != 'GENERATING' &&
        (section.questionsStatus == 'FAILED' ||
            section.questionsStatus == 'PENDING' ||
            section.questionsCount == 0);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Content ────────────────────────────────────────────────────────
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title + status badge
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Flexible(
                      child: Text(
                        section.title,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    _StatusBadge(section: section, isDark: isDark),
                  ],
                ),
                const SizedBox(height: 3),
                // Meta row
                Text(
                  '${section.estMinutes}m · Difficulty ${section.difficulty}/5',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary,
                        fontSize: 11,
                      ),
                ),
                // Question count
                if (section.questionsCount > 0 &&
                    section.questionsStatus != 'GENERATING') ...[
                  const SizedBox(height: 2),
                  Text(
                    '${section.questionsCount} questions available',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: isDark
                              ? AppColors.darkTextTertiary
                              : AppColors.textTertiary,
                          fontSize: 11,
                        ),
                  ),
                ],
                // Topic tags
                if (section.topicTags.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: section.topicTags.take(3).map((tag) {
                      return Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: isDark
                              ? Colors.white.withValues(alpha: 0.06)
                              : Colors.black.withValues(alpha: 0.04),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          tag,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                            color: isDark
                                ? AppColors.darkTextSecondary
                                : AppColors.textSecondary,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
                // Generating indicator
                if (section.questionsStatus == 'GENERATING') ...[
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      const SizedBox(
                        width: 10,
                        height: 10,
                        child: CircularProgressIndicator(
                          strokeWidth: 1.5,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        section.questionsCount > 0
                            ? '${section.questionsCount} ready — generating more...'
                            : 'Generating questions...',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.primary,
                              fontSize: 11,
                            ),
                      ),
                    ],
                  ),
                ],
                // Error message
                if (section.questionsStatus == 'FAILED' &&
                    section.questionsErrorMessage != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    section.questionsErrorMessage!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.error,
                          fontSize: 11,
                        ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(width: 10),

          // ── Action button ─────────────────────────────────────────────────
          if (canStartQuiz)
            _ActionBtn(
              label: 'Start Quiz',
              icon: Icons.play_arrow_rounded,
              filled: true,
              onTap: () => onStartQuiz(section.id),
            )
          else if (canGenerate)
            _ActionBtn(
              label: isGenerating
                  ? (section.questionsStatus == 'FAILED'
                      ? 'Retrying...'
                      : 'Generating...')
                  : (section.questionsStatus == 'FAILED' ? 'Retry' : 'Generate'),
              icon: isGenerating
                  ? null
                  : (section.questionsStatus == 'FAILED'
                      ? Icons.refresh_rounded
                      : Icons.auto_awesome_rounded),
              filled: false,
              loading: isGenerating,
              onTap: isGenerating ? null : () => onGenerate(section.id),
            )
          else
            _ActionBtn(
              label: section.aiStatus != 'ANALYZED' ? 'Analyzing' : 'In Progress',
              icon: null,
              filled: false,
              disabled: true,
              onTap: null,
            ),
        ],
      ),
    );
  }
}

// ── Action button ─────────────────────────────────────────────────────────────

class _ActionBtn extends StatelessWidget {
  final String label;
  final IconData? icon;
  final bool filled;
  final bool loading;
  final bool disabled;
  final VoidCallback? onTap;

  const _ActionBtn({
    required this.label,
    required this.icon,
    required this.filled,
    required this.onTap,
    this.loading = false,
    this.disabled = false,
  });

  @override
  Widget build(BuildContext context) {
    final sharedShape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
    );
    const sharedPadding =
        EdgeInsets.symmetric(horizontal: 12, vertical: 7);
    const sharedTextStyle =
        TextStyle(fontSize: 12, fontWeight: FontWeight.w600);

    Widget childRow(Color iconColor) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (loading)
              SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(
                  strokeWidth: 1.5,
                  color: iconColor,
                ),
              )
            else if (icon != null)
              Icon(icon, size: 13),
            if ((loading || icon != null)) const SizedBox(width: 4),
            Text(label),
          ],
        );

    if (filled) {
      return ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: sharedPadding,
          minimumSize: Size.zero,
          shape: sharedShape,
          textStyle: sharedTextStyle,
        ),
        child: childRow(Colors.white),
      );
    }

    return OutlinedButton(
      onPressed: (disabled || loading) ? null : onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primary,
        side: BorderSide(
          color: disabled
              ? Colors.grey.withValues(alpha: 0.3)
              : AppColors.primary.withValues(alpha: 0.5),
        ),
        padding: sharedPadding,
        minimumSize: Size.zero,
        shape: sharedShape,
        textStyle: sharedTextStyle,
      ),
      child: childRow(AppColors.primary),
    );
  }
}

// ── Status badge ──────────────────────────────────────────────────────────────

class _StatusBadge extends StatelessWidget {
  final SectionModel section;
  final bool isDark;

  const _StatusBadge({required this.section, required this.isDark});

  @override
  Widget build(BuildContext context) {
    if (section.aiStatus != 'ANALYZED') {
      return _badge('Analyzing',
          bg: isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
          fg: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary);
    }
    if (section.questionsStatus == 'GENERATING') {
      final lbl =
          section.questionsCount > 0 ? 'Ready + Generating' : 'Generating';
      return _badge(lbl,
          bg: isDark
              ? AppColors.primary.withValues(alpha: 0.15)
              : AppColors.primarySubtle,
          fg: AppColors.primary);
    }
    if (section.questionsCount > 0) {
      return _badge('Ready',
          bg: isDark
              ? const Color(0xFF065F46).withValues(alpha: 0.5)
              : const Color(0xFFD1FAE5),
          fg: isDark ? const Color(0xFF34D399) : const Color(0xFF059669));
    }
    if (section.questionsStatus == 'FAILED') {
      return _badge('Failed',
          bg: AppColors.error.withValues(alpha: 0.10),
          fg: AppColors.error);
    }
    return _badge('Needs Questions',
        bg: isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
        fg: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary);
  }

  Widget _badge(String label, {required Color bg, required Color fg}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 9,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}

// ── Mode card data ────────────────────────────────────────────────────────────

class _ModeCardData {
  final IconData icon;
  final String label;
  final String description;
  final Color iconColor;
  final Color iconBg;
  final Color darkIconColor;
  final Color darkIconBg;
  final VoidCallback onTap;

  const _ModeCardData({
    required this.icon,
    required this.label,
    required this.description,
    required this.iconColor,
    required this.iconBg,
    required this.darkIconColor,
    required this.darkIconBg,
    required this.onTap,
  });
}
