import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
import '../providers/exam_bank_provider.dart';

/// Exam options that match the web app's EXAM_CATALOG.
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

  @override
  void initState() {
    super.initState();
    _selectedExam = widget.examType;
    if (_selectedExam != null) _loadQuestions();
  }

  Future<void> _loadQuestions() async {
    if (_selectedExam == null) return;
    setState(() { _loading = true; _error = null; _questions = []; _currentIndex = 0; });
    try {
      final result = await ref.read(cloudFunctionsServiceProvider).generateExamBankQuestions(
        examType: _selectedExam!,
        count: 10,
      );
      final questions = (result['questions'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      if (!mounted) return;
      setState(() { _questions = questions; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = 'Failed to load questions. Try again.'; _loading = false; });
    }
  }

  void _selectExam(String key) {
    setState(() { _selectedExam = key; _selectedOption = null; _revealed = false; });
    _loadQuestions();
  }

  void _answer(int idx) {
    if (_revealed) return;
    setState(() { _selectedOption = idx; });
  }

  void _reveal() => setState(() => _revealed = true);

  void _next() {
    if (_currentIndex < _questions.length - 1) {
      setState(() { _currentIndex++; _selectedOption = null; _revealed = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
        title: const Text('Exam Bank'),
      ),
      body: _selectedExam == null || _questions.isEmpty && !_loading
          ? _buildExamPicker(isDark)
          : _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? _buildError(isDark)
                  : _buildQuiz(isDark),
    );
  }

  Widget _buildExamPicker(bool isDark) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text('Choose an exam to practise',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                  height: 1.5)),
        AppSpacing.gapLg,
        for (final group in _examOptions) ...[
          Text(group.group,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.0,
                    fontSize: 11,
                    color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary)),
          AppSpacing.gapSm,
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

  Widget _buildError(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline_rounded, size: 48,
              color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary),
          AppSpacing.gapMd,
          Text(_error!, style: Theme.of(context).textTheme.bodyMedium),
          AppSpacing.gapMd,
          ElevatedButton(onPressed: _loadQuestions, child: const Text('Retry')),
        ],
      ),
    );
  }

  Widget _buildQuiz(bool isDark) {
    if (_currentIndex >= _questions.length) return const SizedBox.shrink();
    final q = _questions[_currentIndex];
    final stem = q['stem'] as String? ?? '';
    final options = (q['options'] as List?)?.cast<String>() ?? [];
    final correctIdx = (q['correctIndex'] as num?)?.toInt() ?? 0;
    final explanation = q['explanation'];
    final keyTakeaway = explanation is Map ? (explanation['keyTakeaway'] as String? ?? '') : '';

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        // Progress
        Row(
          children: [
            Text('Question ${_currentIndex + 1}/${_questions.length}',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
            const Spacer(),
            TextButton(
              onPressed: () => setState(() {
                _selectedExam = null;
                _questions = [];
              }),
              child: const Text('Change Exam'),
            ),
          ],
        ),
        AppSpacing.gapSm,
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(
            value: (_currentIndex + 1) / _questions.length,
            backgroundColor: isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
            color: AppColors.primary, minHeight: 3),
        ),
        AppSpacing.gapLg,

        // Stem
        Text(stem, style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w600, height: 1.5)),
        AppSpacing.gapMd,

        // Options
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

        // Submit / Next
        if (!_revealed)
          ElevatedButton(
            onPressed: _selectedOption != null ? _reveal : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSpacing.radiusMd)),
            ),
            child: const Text('Check Answer'),
          )
        else ...[
          if (keyTakeaway.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.lightbulb_outline_rounded, size: 14, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Expanded(child: Text(keyTakeaway, style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontSize: 13, height: 1.5))),
                ],
              ),
            ),
          AppSpacing.gapMd,
          if (_currentIndex < _questions.length - 1)
            ElevatedButton(
              onPressed: _next,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSpacing.radiusMd)),
              ),
              child: const Text('Next Question'),
            )
          else
            ElevatedButton(
              onPressed: () => context.pop(),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.success,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSpacing.radiusMd)),
              ),
              child: const Text('Done'),
            ),
        ],
      ],
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

class _ExamCard extends StatelessWidget {
  final _ExamOption exam;
  final bool isDark;
  final bool isSelected;
  final VoidCallback onTap;
  const _ExamCard({required this.exam, required this.isDark, required this.isSelected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(
            color: isSelected ? AppColors.primary : (isDark ? AppColors.darkBorder : AppColors.border),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(exam.label, style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600, fontSize: 14)),
                  const SizedBox(height: 2),
                  Text(exam.badge, style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary, fontSize: 11)),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 20,
                color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary),
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
    required this.label, required this.text, required this.isSelected,
    required this.isCorrect, required this.isWrong, required this.isDark, required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Color borderColor = isDark ? AppColors.darkBorder : AppColors.border;
    Color? bgColor;
    Color textColor = isDark ? AppColors.darkTextPrimary : AppColors.textPrimary;
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
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: bgColor ?? (isDark ? AppColors.darkBackground : AppColors.background),
          borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
          border: Border.all(color: borderColor),
        ),
        child: Row(
          children: [
            Container(
              width: 24, height: 24,
              decoration: BoxDecoration(shape: BoxShape.circle, color: borderColor.withValues(alpha: 0.15)),
              child: Center(child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: textColor))),
            ),
            const SizedBox(width: 10),
            Expanded(child: Text(text, style: TextStyle(fontSize: 13, color: textColor,
                fontWeight: isSelected || isCorrect ? FontWeight.w600 : FontWeight.w400))),
            if (isCorrect) const Icon(Icons.check_circle_rounded, size: 16, color: AppColors.success),
            if (isWrong) const Icon(Icons.cancel_rounded, size: 16, color: AppColors.error),
          ],
        ),
      ),
    );
  }
}
