// FILE: lib/src/features/exam_bank/screens/exam_bank_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/utils/error_handler.dart';

// ── Exam catalog data ──────────────────────────────────────────────────────

const _examOptions = [
  _ExamGroup('UK Licensing', [
    _ExamOption('PLAB1', 'PLAB 1', '180 SBAs · GMC'),
    _ExamOption('PLAB2', 'PLAB 2', '18 stations · OSCE'),
  ]),
  _ExamGroup('UK Specialty', [
    _ExamOption('MRCP_PART1', 'MRCP Part 1', 'Best of Five · RCP'),
    _ExamOption('MRCP_PACES', 'MRCP PACES', '5 stations · Clinical'),
    _ExamOption('MRCGP_AKT', 'MRCGP AKT', '200 MCQs · GP'),
  ]),
  _ExamGroup('International', [
    _ExamOption('USMLE_STEP1', 'USMLE Step 1', 'Basic science · NBME'),
    _ExamOption('USMLE_STEP2', 'USMLE Step 2 CK', 'Clinical knowledge'),
  ]),
  _ExamGroup('University', [
    _ExamOption('FINALS', 'Medical Finals', 'SBA + OSCE · University'),
    _ExamOption('SBA', 'SBA Practice', 'General SBA'),
    _ExamOption('OSCE', 'OSCE Practice', 'General OSCE'),
  ]),
];

const _examMeta = {
  'PLAB1': _ExamMeta(
    focus: 'Clinical reasoning, UK guidelines, prescribing safety, GMC ethics',
    tip:
        'Anchor every answer to NICE guidelines and BNF drug choices. GMC ethics questions follow Good Medical Practice — know it.',
  ),
  'PLAB2': _ExamMeta(
    focus:
        'Clinical examination, communication, history taking, data interpretation',
    tip:
        'Use SOCRATES for pain, ICE for patient concerns, SBAR for handover. Every station has a hidden communication mark.',
  ),
  'MRCP_PART1': _ExamMeta(
    focus: 'Mechanism-level medicine, rare presentations, investigation logic',
    tip:
        'Know the pathophysiology behind each drug — Best of Five rewards mechanism understanding, not pattern-matching.',
  ),
  'MRCP_PACES': _ExamMeta(
    focus:
        'Physical examination, history, communication, data interpretation, ethics',
    tip:
        'Communication station: use IDEAS framework. Examiners mark empathy and structure separately from medical content.',
  ),
  'MRCGP_AKT': _ExamMeta(
    focus: 'Primary care, QOF, NNT, drug thresholds, referral pathways',
    tip:
        'Know QOF targets, QRISK thresholds, and when NOT to prescribe. Extended matching items need fast elimination.',
  ),
  'USMLE_STEP1': _ExamMeta(
    focus: 'Basic science mechanisms, pathophysiology, pharmacology, microbiology',
    tip:
        'Every clinical vignette links to basic science. Always ask "what is the underlying mechanism?" before choosing an answer.',
  ),
  'USMLE_STEP2': _ExamMeta(
    focus: 'Clinical reasoning, diagnosis, management, preventive care',
    tip:
        'Prioritise what to do NEXT, not the final diagnosis. Know USPSTF screening guidelines and first-line drugs.',
  ),
  'FINALS': _ExamMeta(
    focus: 'Core clinical medicine, surgery, O&G, psychiatry, paediatrics',
    tip:
        'Know common presentations and their first-line investigations and management — breadth over depth.',
  ),
  'SBA': _ExamMeta(
    focus: 'Core diagnosis, investigation logic, and first-line management',
    tip:
        'Use decisive clues in the stem and practice ruling out the strongest distractor.',
  ),
  'OSCE': _ExamMeta(
    focus: 'History, examination flow, communication, and safe escalation',
    tip:
        'Prioritise structure and safety first, then clinical depth and shared decisions.',
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class ExamBankScreen extends ConsumerStatefulWidget {
  final String? examType;

  const ExamBankScreen({super.key, this.examType});

  @override
  ConsumerState<ExamBankScreen> createState() => _ExamBankScreenState();
}

class _ExamBankScreenState extends ConsumerState<ExamBankScreen> {
  String? _selectedExam;
  bool _loading = false;
  String? _error;
  List<Map<String, dynamic>> _questions = [];
  int _currentIndex = 0;
  int? _selectedOption;
  bool _revealed = false;

  // Score tracking
  int _correctCount = 0;
  bool _quizComplete = false;

  @override
  void initState() {
    super.initState();
    _selectedExam = widget.examType;
    if (_selectedExam != null) _loadQuestions();
  }

  Future<void> _loadQuestions() async {
    if (_selectedExam == null) return;
    setState(() {
      _loading = true;
      _error = null;
      _questions = [];
      _currentIndex = 0;
      _selectedOption = null;
      _revealed = false;
      _correctCount = 0;
      _quizComplete = false;
    });
    try {
      final result = await ref
          .read(cloudFunctionsServiceProvider)
          .generateExamBankQuestions(
            examType: _selectedExam!,
            count: 10,
          );
      final questions = (result['questions'] as List?)
              ?.whereType<Map>()
              .map((q) => Map<String, dynamic>.from(q))
              .toList() ??
          [];
      if (!mounted) return;
      setState(() {
        _questions = questions;
        _loading = false;
      });
    } catch (e, st) {
      ErrorHandler.logError(e, st);
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load questions. Try again.';
        _loading = false;
      });
    }
  }

  void _selectExam(String key) {
    setState(() {
      _selectedExam = key;
      _selectedOption = null;
      _revealed = false;
    });
    _loadQuestions();
  }

  void _answer(int idx) {
    if (_revealed) return;
    setState(() => _selectedOption = idx);
  }

  void _reveal() => setState(() => _revealed = true);

  void _next() {
    final q = _questions[_currentIndex];
    final correctIdx = (q['correctIndex'] as num?)?.toInt() ?? 0;
    if (_selectedOption == correctIdx) {
      _correctCount++;
    }

    if (_currentIndex < _questions.length - 1) {
      setState(() {
        _currentIndex++;
        _selectedOption = null;
        _revealed = false;
      });
    } else {
      setState(() => _quizComplete = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        title: Text(
          _selectedExam != null
              ? '${_examDisplayName(_selectedExam!)} Bank'
              : 'Exam Bank',
        ),
        actions: [
          if (_selectedExam != null && _questions.isNotEmpty && !_quizComplete)
            TextButton(
              onPressed: () => setState(() {
                _selectedExam = null;
                _questions = [];
                _quizComplete = false;
              }),
              child: const Text('Change'),
            ),
        ],
      ),
      body: _loading
          ? _buildLoading()
          : _error != null
              ? _buildError(isDark)
              : _quizComplete
                  ? _buildResults(isDark)
                  : _selectedExam == null ||
                          _questions.isEmpty
                      ? _buildExamPicker(isDark)
                      : _buildQuiz(isDark),
    );
  }

  Widget _buildLoading() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(color: AppColors.primary),
          AppSpacing.gapMd,
          Text(
            'Generating questions for ${_examDisplayName(_selectedExam ?? '')}...',
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError(bool isDark) {
    return Center(
      child: Padding(
        padding: AppSpacing.screenPadding,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.error_outline_rounded,
                  size: 28, color: AppColors.error),
            ),
            AppSpacing.gapMd,
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            AppSpacing.gapLg,
            ElevatedButton.icon(
              onPressed: _loadQuestions,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Try Again'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusMd),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildExamPicker(bool isDark) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
      children: [
        Text(
          'Choose an exam to practise',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.textSecondary,
                height: 1.5,
              ),
        ),
        AppSpacing.gapLg,
        for (final group in _examOptions) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: Text(
              group.group.toUpperCase(),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.0,
                    fontSize: 11,
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
            ),
          ),
          for (final exam in group.exams)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _ExamCard(
                exam: exam,
                isDark: isDark,
                isSelected: _selectedExam == exam.key,
                onTap: () => _selectExam(exam.key),
              ),
            ),
          AppSpacing.gapMd,
        ],
      ],
    );
  }

  Widget _buildQuiz(bool isDark) {
    if (_currentIndex >= _questions.length) {
      return const SizedBox.shrink();
    }
    final q = _questions[_currentIndex];
    final stem = q['stem'] as String? ?? '';
    final options =
        (q['options'] as List?)?.whereType<String>().toList() ?? [];
    final correctIdx = (q['correctIndex'] as num?)?.toInt() ?? 0;
    final explanation = q['explanation'];
    final keyTakeaway = explanation is Map
        ? (explanation['keyTakeaway'] as String? ?? '')
        : '';

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
      children: [
        // ── Progress header ───────────────────────────────────────────
        Row(
          children: [
            Text(
              'Question ${_currentIndex + 1}/${_questions.length}',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const Spacer(),
            _ExamBadge(examKey: _selectedExam ?? '', isDark: isDark),
          ],
        ),
        AppSpacing.gapSm,
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(
            value: (_currentIndex + 1) / _questions.length,
            backgroundColor: isDark
                ? AppColors.darkSurfaceVariant
                : AppColors.surfaceVariant,
            color: AppColors.primary,
            minHeight: 4,
          ),
        ),
        AppSpacing.gapLg,

        // ── Exam tip (first question only) ───────────────────────────
        if (_currentIndex == 0 && _examMeta[_selectedExam] != null) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
              border:
                  Border.all(color: AppColors.warning.withValues(alpha: 0.25)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.bolt_rounded,
                    size: 14, color: AppColors.warning),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Exam tip: ${_examMeta[_selectedExam]!.tip}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontSize: 12,
                          height: 1.4,
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.textSecondary,
                        ),
                  ),
                ),
              ],
            ),
          ),
          AppSpacing.gapMd,
        ],

        // ── Stem ──────────────────────────────────────────────────────
        Container(
          padding: AppSpacing.cardPadding,
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkSurface : AppColors.surface,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: Border.all(
                color: isDark ? AppColors.darkBorder : AppColors.border),
            boxShadow: isDark ? null : AppSpacing.shadowSm,
          ),
          child: Text(
            stem,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                  height: 1.6,
                ),
          ),
        ),
        AppSpacing.gapMd,

        // ── Options ───────────────────────────────────────────────────
        for (int i = 0; i < options.length; i++) ...[
          _OptionTile(
            label: String.fromCharCode(65 + i),
            text: options[i],
            isSelected: _selectedOption == i,
            isCorrect: _revealed && i == correctIdx,
            isWrong: _revealed && _selectedOption == i && i != correctIdx,
            isDark: isDark,
            onTap: () => _answer(i),
          ),
          const SizedBox(height: 6),
        ],
        AppSpacing.gapMd,

        // ── Submit / reveal ───────────────────────────────────────────
        if (!_revealed)
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _selectedOption != null ? _reveal : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                disabledBackgroundColor: isDark
                    ? AppColors.darkSurfaceVariant
                    : AppColors.surfaceVariant,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusMd),
                ),
              ),
              child: const Text(
                'Check Answer',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          )
        else ...[
          // Key takeaway
          if (keyTakeaway.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                border:
                    Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.lightbulb_outline_rounded,
                      size: 14, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      keyTakeaway,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            fontSize: 13,
                            height: 1.5,
                          ),
                    ),
                  ),
                ],
              ),
            ),
          AppSpacing.gapMd,

          // Next / Finish
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _next,
              icon: Icon(
                _currentIndex < _questions.length - 1
                    ? Icons.arrow_forward_rounded
                    : Icons.check_circle_rounded,
                size: 18,
              ),
              label: Text(
                _currentIndex < _questions.length - 1
                    ? 'Next Question'
                    : 'See Results',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: _currentIndex < _questions.length - 1
                    ? AppColors.primary
                    : AppColors.success,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusMd),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildResults(bool isDark) {
    final total = _questions.length;
    final accuracy =
        total > 0 ? (_correctCount / total * 100).round() : 0;
    final Color scoreColor = accuracy >= 70
        ? AppColors.success
        : accuracy >= 50
            ? AppColors.warning
            : AppColors.error;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        // Score card
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: AppColors.primaryGradient,
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            boxShadow: AppColors.primaryGradientShadow,
          ),
          child: Column(
            children: [
              Text(
                '$accuracy%',
                style: const TextStyle(
                  fontSize: 52,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: -1,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '$_correctCount of $total correct',
                style: const TextStyle(
                  fontSize: 15,
                  color: Colors.white70,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusFull),
                ),
                child: Text(
                  accuracy >= 70
                      ? 'Great performance!'
                      : accuracy >= 50
                          ? 'Keep practising'
                          : 'More practice needed',
                  style: const TextStyle(
                    fontSize: 13,
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
        AppSpacing.gapLg,

        // Stats row
        Row(
          children: [
            _ResultStat(
              label: 'Correct',
              value: '$_correctCount',
              color: AppColors.success,
              isDark: isDark,
            ),
            const SizedBox(width: 10),
            _ResultStat(
              label: 'Incorrect',
              value: '${total - _correctCount}',
              color: AppColors.error,
              isDark: isDark,
            ),
            const SizedBox(width: 10),
            _ResultStat(
              label: 'Accuracy',
              value: '$accuracy%',
              color: scoreColor,
              isDark: isDark,
            ),
          ],
        ),
        AppSpacing.gapLg,

        // Practice more
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _loadQuestions,
            icon: const Icon(Icons.refresh_rounded, size: 18),
            label: const Text(
              'Practice More',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              ),
            ),
          ),
        ),
        AppSpacing.gapSm,
        SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            onPressed: () => context.pop(),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              ),
            ),
            child: const Text('Done'),
          ),
        ),
      ],
    );
  }

  String _examDisplayName(String key) {
    for (final group in _examOptions) {
      for (final exam in group.exams) {
        if (exam.key == key) return exam.label;
      }
    }
    return key;
  }
}

// ── Data classes ──────────────────────────────────────────────────────────

class _ExamGroup {
  final String group;
  final List<_ExamOption> exams;
  const _ExamGroup(this.group, this.exams);
}

class _ExamOption {
  final String key;
  final String label;
  final String badge;
  const _ExamOption(this.key, this.label, this.badge);
}

class _ExamMeta {
  final String focus;
  final String tip;
  const _ExamMeta({required this.focus, required this.tip});
}

// ── Widgets ───────────────────────────────────────────────────────────────

class _ExamBadge extends StatelessWidget {
  final String examKey;
  final bool isDark;

  const _ExamBadge({required this.examKey, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
      ),
      child: Text(
        examKey.replaceAll('_', ' '),
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: AppColors.primary,
        ),
      ),
    );
  }
}

class _ExamCard extends StatelessWidget {
  final _ExamOption exam;
  final bool isDark;
  final bool isSelected;
  final VoidCallback onTap;

  const _ExamCard({
    required this.exam,
    required this.isDark,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: AppSpacing.animFast,
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary.withValues(alpha: 0.05)
              : (isDark ? AppColors.darkSurface : AppColors.surface),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(
            color: isSelected
                ? AppColors.primary
                : (isDark ? AppColors.darkBorder : AppColors.border),
            width: isSelected ? 1.5 : 1,
          ),
          boxShadow: isDark ? null : AppSpacing.shadowSm,
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    exam.label,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: isSelected
                              ? AppColors.primary
                              : (isDark
                                  ? AppColors.darkTextPrimary
                                  : AppColors.textPrimary),
                        ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    exam.badge,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.textSecondary,
                          fontSize: 11,
                        ),
                  ),
                  if (_examMeta[exam.key] != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      _examMeta[exam.key]!.focus,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: isDark
                                ? AppColors.darkTextTertiary
                                : AppColors.textTertiary,
                            fontSize: 10,
                            height: 1.4,
                          ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            Icon(
              isSelected
                  ? Icons.check_circle_rounded
                  : Icons.chevron_right_rounded,
              size: 20,
              color: isSelected
                  ? AppColors.primary
                  : (isDark
                      ? AppColors.darkTextTertiary
                      : AppColors.textTertiary),
            ),
          ],
        ),
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  final String label;
  final String text;
  final bool isSelected;
  final bool isCorrect;
  final bool isWrong;
  final bool isDark;
  final VoidCallback onTap;

  const _OptionTile({
    required this.label,
    required this.text,
    required this.isSelected,
    required this.isCorrect,
    required this.isWrong,
    required this.isDark,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Color borderColor = isDark ? AppColors.darkBorder : AppColors.border;
    Color? bgColor;
    Color textColor =
        isDark ? AppColors.darkTextPrimary : AppColors.textPrimary;

    if (isCorrect) {
      bgColor = AppColors.success.withValues(alpha: 0.1);
      borderColor = AppColors.success;
      textColor = AppColors.success;
    } else if (isWrong) {
      bgColor = AppColors.error.withValues(alpha: 0.08);
      borderColor = AppColors.error;
      textColor = AppColors.error;
    } else if (isSelected) {
      bgColor = AppColors.primary.withValues(alpha: 0.08);
      borderColor = AppColors.primary;
      textColor = AppColors.primary;
    }

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: AppSpacing.animFast,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: bgColor ??
              (isDark ? AppColors.darkSurface : AppColors.surface),
          borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
          border: Border.all(
              color: borderColor, width: isCorrect || isWrong ? 1.5 : 1),
        ),
        child: Row(
          children: [
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: borderColor.withValues(alpha: 0.12),
                border: Border.all(color: borderColor.withValues(alpha: 0.4)),
              ),
              child: Center(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: textColor,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                text,
                style: TextStyle(
                  fontSize: 13,
                  color: textColor,
                  fontWeight: isSelected || isCorrect
                      ? FontWeight.w600
                      : FontWeight.w400,
                  height: 1.4,
                ),
              ),
            ),
            if (isCorrect)
              const Icon(Icons.check_circle_rounded,
                  size: 18, color: AppColors.success),
            if (isWrong)
              const Icon(Icons.cancel_rounded,
                  size: 18, color: AppColors.error),
          ],
        ),
      ),
    );
  }
}

class _ResultStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final bool isDark;

  const _ResultStat({
    required this.label,
    required this.value,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
