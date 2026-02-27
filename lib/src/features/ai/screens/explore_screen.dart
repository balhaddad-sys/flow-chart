import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';

// ── Level options ─────────────────────────────────────────────────────────────

const _levels = [
  'Medical Student',
  'Foundation Year',
  'Core Trainee',
  'Registrar',
];

// ── Explore Screen ────────────────────────────────────────────────────────────

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  final _topicController = TextEditingController();
  String _selectedLevel = _levels[0];
  bool _loadingInsight = false;
  bool _loadingQuiz = false;
  String? _insightText;
  String? _errorText;
  List<Map<String, dynamic>>? _quizQuestions;

  @override
  void dispose() {
    _topicController.dispose();
    super.dispose();
  }

  Future<void> _getInsight() async {
    final topic = _topicController.text.trim();
    if (topic.isEmpty) return;
    setState(() {
      _loadingInsight = true;
      _errorText = null;
      _insightText = null;
      _quizQuestions = null;
    });
    try {
      final result = await ref
          .read(cloudFunctionsServiceProvider)
          .exploreTopicInsight(
            topic: topic,
            level: _selectedLevel,
          );
      if (!mounted) return;
      final insight =
          result['insight'] as String? ??
          result['text'] as String? ??
          result['content'] as String? ??
          'No content returned.';
      setState(() => _insightText = insight);
    } catch (e) {
      if (!mounted) return;
      setState(() => _errorText = 'Failed to get insight. Please try again.');
    } finally {
      if (mounted) setState(() => _loadingInsight = false);
    }
  }

  Future<void> _getQuiz() async {
    final topic = _topicController.text.trim();
    if (topic.isEmpty) return;
    setState(() {
      _loadingQuiz = true;
      _errorText = null;
      _insightText = null;
      _quizQuestions = null;
    });
    try {
      final result = await ref
          .read(cloudFunctionsServiceProvider)
          .exploreQuiz(
            topic: topic,
            level: _selectedLevel,
            count: 5,
          );
      if (!mounted) return;
      final questions = result['questions'] as List?;
      if (questions == null || questions.isEmpty) {
        setState(() => _errorText = 'No questions generated. Try a different topic.');
        return;
      }
      setState(() =>
          _quizQuestions = questions.whereType<Map<String, dynamic>>().toList());
    } catch (e) {
      if (!mounted) return;
      setState(() => _errorText = 'Failed to generate quiz. Please try again.');
    } finally {
      if (mounted) setState(() => _loadingQuiz = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        title: const Text('Explore Topic'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          // ── Description ───────────────────────────────────────────────────
          Text(
            'Enter any medical topic to get an AI-generated teaching outline or a quick quiz.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                  height: 1.5,
                ),
          ),
          AppSpacing.gapMd,

          // ── Topic input ───────────────────────────────────────────────────
          TextField(
            controller: _topicController,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _getInsight(),
            style: Theme.of(context).textTheme.bodyMedium,
            decoration: InputDecoration(
              hintText: 'e.g. Acute Coronary Syndrome, Diabetes management...',
              prefixIcon: const Icon(Icons.search_rounded, size: 20),
              suffixIcon:
                  _topicController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear_rounded, size: 18),
                          onPressed: () {
                            _topicController.clear();
                            setState(() {
                              _insightText = null;
                              _quizQuestions = null;
                              _errorText = null;
                            });
                          },
                        )
                      : null,
            ),
            onChanged: (_) => setState(() {}),
          ),
          AppSpacing.gapMd,

          // ── Level picker ──────────────────────────────────────────────────
          Row(
            children: [
              Text(
                'Level:',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.darkSurface : AppColors.surface,
                    borderRadius:
                        BorderRadius.circular(AppSpacing.radiusMd),
                    border: Border.all(
                      color:
                          isDark ? AppColors.darkBorder : AppColors.border,
                    ),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedLevel,
                      isExpanded: true,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            fontSize: 13,
                            color: isDark
                                ? AppColors.darkTextPrimary
                                : AppColors.textPrimary,
                          ),
                      dropdownColor: isDark
                          ? AppColors.darkSurface
                          : AppColors.surface,
                      items: _levels
                          .map(
                            (l) => DropdownMenuItem(
                              value: l,
                              child: Text(l),
                            ),
                          )
                          .toList(),
                      onChanged: (v) {
                        if (v != null) setState(() => _selectedLevel = v);
                      },
                    ),
                  ),
                ),
              ),
            ],
          ),
          AppSpacing.gapMd,

          // ── Action buttons ────────────────────────────────────────────────
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed:
                      (_loadingInsight ||
                              _loadingQuiz ||
                              _topicController.text.trim().isEmpty)
                          ? null
                          : _getInsight,
                  icon: _loadingInsight
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 1.5,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.auto_stories_outlined, size: 16),
                  label: Text(
                      _loadingInsight ? 'Loading...' : 'Teaching Outline'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                    textStyle: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed:
                      (_loadingInsight ||
                              _loadingQuiz ||
                              _topicController.text.trim().isEmpty)
                          ? null
                          : _getQuiz,
                  icon: _loadingQuiz
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 1.5,
                            color: AppColors.primary,
                          ),
                        )
                      : const Icon(Icons.quiz_outlined, size: 16),
                  label: Text(
                      _loadingQuiz ? 'Generating...' : 'Quick Quiz'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: const BorderSide(color: AppColors.primary),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                    textStyle: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
            ],
          ),

          // ── Error ─────────────────────────────────────────────────────────
          if (_errorText != null) ...[
            AppSpacing.gapMd,
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                border: Border.all(
                  color: AppColors.error.withValues(alpha: 0.3),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded,
                      size: 16, color: AppColors.error),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _errorText!,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.error),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // ── Teaching Outline result ───────────────────────────────────────
          if (_insightText != null) ...[
            AppSpacing.gapLg,
            _SectionHeader(
              icon: Icons.auto_stories_outlined,
              title: 'Teaching Outline',
              subtitle: _topicController.text.trim(),
              isDark: isDark,
            ),
            AppSpacing.gapSm,
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.surface,
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                border: Border.all(
                  color: isDark ? AppColors.darkBorder : AppColors.border,
                ),
              ),
              child: SelectableText(
                _insightText!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontSize: 14,
                      height: 1.65,
                      color: isDark
                          ? AppColors.darkTextPrimary
                          : AppColors.textPrimary,
                    ),
              ),
            ),
          ],

          // ── Quiz result ───────────────────────────────────────────────────
          if (_quizQuestions != null) ...[
            AppSpacing.gapLg,
            _SectionHeader(
              icon: Icons.quiz_outlined,
              title: 'Quick Quiz',
              subtitle: '${_quizQuestions!.length} questions on ${_topicController.text.trim()}',
              isDark: isDark,
            ),
            AppSpacing.gapSm,
            ..._quizQuestions!.asMap().entries.map((entry) {
              final idx = entry.key;
              final q = entry.value;
              return _ExploreQuizCard(
                index: idx,
                question: q,
                isDark: isDark,
              );
            }),
          ],
        ],
      ),
    );
  }
}

// ── Section Header ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool isDark;

  const _SectionHeader({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 16, color: AppColors.primary),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              Text(
                subtitle,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textSecondary,
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Quiz Card ─────────────────────────────────────────────────────────────────

class _ExploreQuizCard extends StatefulWidget {
  final int index;
  final Map<String, dynamic> question;
  final bool isDark;

  const _ExploreQuizCard({
    required this.index,
    required this.question,
    required this.isDark,
  });

  @override
  State<_ExploreQuizCard> createState() => _ExploreQuizCardState();
}

class _ExploreQuizCardState extends State<_ExploreQuizCard> {
  int? _selectedIndex;
  bool _revealed = false;

  @override
  Widget build(BuildContext context) {
    final q = widget.question;
    final stem = q['stem'] as String? ?? q['question'] as String? ?? '';
    final rawOptions = q['options'] as List? ?? [];
    final options = rawOptions.map((o) => o.toString()).toList();
    final correctIndex = (q['correctIndex'] as num?)?.toInt() ?? 0;
    final explanation = q['explanation'] as String? ??
        (q['explanation'] is Map
            ? (q['explanation'] as Map)['keyTakeaway'] as String? ?? ''
            : '');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: widget.isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: widget.isDark ? AppColors.darkBorder : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Question number + stem
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Center(
                  child: Text(
                    '${widget.index + 1}',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  stem,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        height: 1.4,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Options
          ...options.asMap().entries.map((e) {
            final i = e.key;
            final opt = e.value;
            final isSelected = _selectedIndex == i;
            final isCorrect = i == correctIndex;

            Color? bgColor;
            Color? borderColor;
            Color textColor =
                widget.isDark ? AppColors.darkTextPrimary : AppColors.textPrimary;

            if (_revealed) {
              if (isCorrect) {
                bgColor = AppColors.success.withValues(alpha: 0.1);
                borderColor = AppColors.success;
                textColor = AppColors.success;
              } else if (isSelected && !isCorrect) {
                bgColor = AppColors.error.withValues(alpha: 0.08);
                borderColor = AppColors.error;
                textColor = AppColors.error;
              }
            } else if (isSelected) {
              bgColor = AppColors.primary.withValues(alpha: 0.08);
              borderColor = AppColors.primary;
              textColor = AppColors.primary;
            }

            return GestureDetector(
              onTap: _revealed
                  ? null
                  : () => setState(() => _selectedIndex = i),
              child: Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: bgColor ??
                      (widget.isDark
                          ? AppColors.darkBackground
                          : AppColors.background),
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusSm),
                  border: Border.all(
                    color: borderColor ??
                        (widget.isDark
                            ? AppColors.darkBorder
                            : AppColors.border),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: (borderColor ?? AppColors.primary)
                            .withValues(alpha: 0.12),
                      ),
                      child: Center(
                        child: Text(
                          String.fromCharCode(65 + i), // A, B, C, D
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color:
                                borderColor ?? AppColors.primary,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        opt,
                        style: TextStyle(
                          fontSize: 13,
                          color: textColor,
                          fontWeight: isSelected || (_revealed && isCorrect)
                              ? FontWeight.w600
                              : FontWeight.w400,
                        ),
                      ),
                    ),
                    if (_revealed && isCorrect)
                      const Icon(Icons.check_circle_rounded,
                          size: 16, color: AppColors.success),
                    if (_revealed && isSelected && !isCorrect)
                      const Icon(Icons.cancel_rounded,
                          size: 16, color: AppColors.error),
                  ],
                ),
              ),
            );
          }),

          // Reveal button / Explanation
          if (!_revealed) ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _selectedIndex == null
                    ? null
                    : () => setState(() => _revealed = true),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: BorderSide(
                    color: _selectedIndex == null
                        ? (widget.isDark
                            ? AppColors.darkBorder
                            : AppColors.border)
                        : AppColors.primary,
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(AppSpacing.radiusSm),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                child: const Text('Reveal Answer'),
              ),
            ),
          ] else if (explanation.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.06),
                borderRadius:
                    BorderRadius.circular(AppSpacing.radiusSm),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.lightbulb_outline_rounded,
                      size: 14, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      explanation,
                      style:
                          Theme.of(context).textTheme.bodySmall?.copyWith(
                                fontSize: 12,
                                height: 1.5,
                                color: widget.isDark
                                    ? AppColors.darkTextSecondary
                                    : AppColors.textSecondary,
                              ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
