// FILE: lib/src/features/assessment/screens/assessment_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/utils/error_handler.dart';
import '../../../core/widgets/primary_button.dart';
import '../../home/providers/home_provider.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Assessment Screen
// ─────────────────────────────────────────────────────────────────────────────

class AssessmentScreen extends ConsumerStatefulWidget {
  const AssessmentScreen({super.key});

  @override
  ConsumerState<AssessmentScreen> createState() => _AssessmentScreenState();
}

class _AssessmentScreenState extends ConsumerState<AssessmentScreen> {
  // ── Catalog state ──────────────────────────────────────────────────────────
  bool _catalogLoading = false;
  String? _catalogError;
  List<Map<String, dynamic>> _topics = [];
  List<Map<String, dynamic>> _levels = [];
  String _selectedTopic = '';
  String _selectedLevel = 'MD3';
  int _questionCount = 15;

  // ── Session state ──────────────────────────────────────────────────────────
  bool _starting = false;
  String? _sessionId;
  String _sessionLevelLabel = '';
  int _targetTimeSec = 70;
  List<Map<String, dynamic>> _questions = [];
  int _currentIndex = 0;
  int _currentConfidence = 3;
  final Map<String, Map<String, dynamic>> _answers = {};

  bool _submitting = false;
  bool _finishing = false;
  String? _runtimeError;
  Map<String, dynamic>? _report;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadCatalog());
  }

  Future<void> _loadCatalog() async {
    final courseId = ref.read(activeCourseIdProvider);
    if (courseId == null) return;
    setState(() {
      _catalogLoading = true;
      _catalogError = null;
    });
    try {
      final result =
          await ref.read(cloudFunctionsServiceProvider).getAssessmentCatalog();
      final topics = List<Map<String, dynamic>>.from(
        (result['topics'] as List?)
                ?.map((e) => Map<String, dynamic>.from(e as Map)) ??
            [],
      );
      final levels = List<Map<String, dynamic>>.from(
        (result['levels'] as List?)
                ?.map((e) => Map<String, dynamic>.from(e as Map)) ??
            [],
      );
      setState(() {
        _topics = topics;
        _levels = levels;
        _selectedLevel = (result['defaultLevel'] as String?) ?? 'MD3';
        _selectedTopic = topics.firstWhere(
              (t) => (t['availableQuestions'] as int? ?? 0) >= 5,
              orElse: () =>
                  topics.isNotEmpty ? topics.first : <String, dynamic>{},
            )['id'] as String? ??
            '';
      });
    } catch (e) {
      ErrorHandler.logError(e);
      setState(() => _catalogError = e.toString());
    } finally {
      setState(() => _catalogLoading = false);
    }
  }

  Future<void> _startAssessment() async {
    final courseId = ref.read(activeCourseIdProvider);
    if (courseId == null || _selectedTopic.isEmpty) return;
    setState(() {
      _starting = true;
      _runtimeError = null;
      _report = null;
    });
    try {
      final result =
          await ref.read(cloudFunctionsServiceProvider).startAssessmentSession(
                assessmentId: _selectedTopic,
                courseId: courseId,
              );
      final questions = List<Map<String, dynamic>>.from(
        (result['questions'] as List?)
                ?.map((e) => Map<String, dynamic>.from(e as Map)) ??
            [],
      );
      setState(() {
        _sessionId = result['sessionId'] as String?;
        _questions = questions;
        _sessionLevelLabel =
            (result['levelLabel'] ?? result['level'] ?? _selectedLevel)
                as String;
        _targetTimeSec = (result['targetTimeSec'] as int?) ?? 70;
        _currentIndex = 0;
        _currentConfidence = 3;
        _answers.clear();
      });
    } catch (e) {
      ErrorHandler.logError(e);
      setState(() => _runtimeError = e.toString());
    } finally {
      setState(() => _starting = false);
    }
  }

  Future<void> _submitAnswer(int optionIndex) async {
    if (_sessionId == null || _submitting) return;
    final q = _currentQuestion;
    if (q == null || _answers.containsKey(q['id'])) return;
    setState(() {
      _submitting = true;
      _runtimeError = null;
    });
    try {
      final result = await ref
          .read(cloudFunctionsServiceProvider)
          .submitAssessmentAnswer(
            sessionId: _sessionId!,
            questionId: q['id'] as String,
            answerIndex: optionIndex,
          );
      setState(() {
        _answers[q['id'] as String] = {
          'answerIndex': optionIndex,
          'correct': result['correct'] ?? false,
          'correctIndex': result['correctIndex'] ?? 0,
          'explanation': result['explanation'],
        };
      });
      if (result['isComplete'] == true) {
        await _finishAssessment();
      }
    } catch (e) {
      ErrorHandler.logError(e);
      setState(() => _runtimeError = e.toString());
    } finally {
      setState(() => _submitting = false);
    }
  }

  Future<void> _finishAssessment() async {
    if (_sessionId == null) return;
    setState(() {
      _finishing = true;
      _runtimeError = null;
    });
    try {
      final result = await ref
          .read(cloudFunctionsServiceProvider)
          .finishAssessmentSession(sessionId: _sessionId!);
      setState(() => _report = result);
    } catch (e) {
      ErrorHandler.logError(e);
      setState(() => _runtimeError = e.toString());
    } finally {
      setState(() => _finishing = false);
    }
  }

  void _nextQuestion() {
    final q = _currentQuestion;
    if (q == null || !_answers.containsKey(q['id'])) return;
    if (_currentIndex >= _questions.length - 1) {
      _finishAssessment();
      return;
    }
    setState(() {
      _currentIndex++;
      _currentConfidence = 3;
    });
  }

  void _restart() {
    setState(() {
      _sessionId = null;
      _questions = [];
      _currentIndex = 0;
      _currentConfidence = 3;
      _answers.clear();
      _runtimeError = null;
      _report = null;
      _finishing = false;
      _submitting = false;
    });
  }

  Map<String, dynamic>? get _currentQuestion =>
      _currentIndex < _questions.length ? _questions[_currentIndex] : null;

  int get _selectedTopicAvailable {
    final meta = _topics.where((t) => t['id'] == _selectedTopic);
    if (meta.isEmpty) return 0;
    return (meta.first['availableQuestions'] as int?) ?? 0;
  }

  String _formatTopicTag(String tag) {
    return tag
        .replaceAll(RegExp(r'[-_]+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim()
        .split(' ')
        .map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '')
        .join(' ');
  }

  @override
  Widget build(BuildContext context) {
    final courseId = ref.watch(activeCourseIdProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (courseId == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Assessment')),
        body: Center(
          child: Padding(
            padding: AppSpacing.screenPadding,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.psychology_outlined,
                      size: 36, color: AppColors.primary),
                ),
                AppSpacing.gapLg,
                Text('No course selected',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        )),
                AppSpacing.gapSm,
                Text(
                  'Select or create a course to run adaptive topic assessments.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
                ),
                AppSpacing.gapLg,
                PrimaryButton(
                  label: 'Create Course',
                  onPressed: () => context.go('/onboarding'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        title: Text(
          _report != null
              ? 'Assessment Report'
              : _sessionId != null
                  ? 'Adaptive Assessment'
                  : 'Assessment Setup',
        ),
        actions: [
          if (_sessionId != null && _report == null)
            TextButton(
              onPressed: _finishing ? null : _finishAssessment,
              child: Text(
                _finishing ? 'Finishing...' : 'End now',
                style: const TextStyle(color: AppColors.error),
              ),
            ),
        ],
      ),
      body: _report != null
          ? _buildReport(context, isDark)
          : _sessionId != null && _currentQuestion != null
              ? _buildQuiz(context, isDark)
              : _buildSetup(context, isDark),
    );
  }

  // ── Setup View ─────────────────────────────────────────────────────────────
  Widget _buildSetup(BuildContext context, bool isDark) {
    return ListView(
      padding: AppSpacing.screenPadding,
      children: [
        if (_runtimeError != null) ...[
          _ErrorBanner(message: _runtimeError!, isDark: isDark),
          AppSpacing.gapMd,
        ],

        // ── Header ──────────────────────────────────────────────────────
        Text(
          'Adaptive Assessment',
          style: Theme.of(context)
              .textTheme
              .titleLarge
              ?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 4),
        Text(
          'Choose your target topic and difficulty level to begin.',
          style: TextStyle(
            fontSize: 13,
            height: 1.5,
            color: isDark
                ? AppColors.darkTextSecondary
                : AppColors.textSecondary,
          ),
        ),
        AppSpacing.gapLg,

        if (_catalogLoading)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: CircularProgressIndicator(),
            ),
          )
        else if (_catalogError != null)
          _ErrorBanner(message: _catalogError!, isDark: isDark)
        else ...[
          // Topic dropdown
          _FieldLabel('Topic'),
          const SizedBox(height: 6),
          _DropdownField(
            value: _selectedTopic.isEmpty ? null : _selectedTopic,
            hint: 'Select topic',
            isDark: isDark,
            items: _topics.map((t) {
              final id = t['id'] as String? ?? '';
              final label = t['label'] as String? ?? _formatTopicTag(id);
              final count = t['availableQuestions'] as int? ?? 0;
              return DropdownMenuItem(
                value: id,
                child: Text('$label ($count Qs)'),
              );
            }).toList(),
            onChanged: (v) => setState(() => _selectedTopic = v ?? ''),
          ),
          AppSpacing.gapMd,

          // Level dropdown
          _FieldLabel('Level'),
          const SizedBox(height: 6),
          _DropdownField<String>(
            value: _selectedLevel,
            hint: 'Select level',
            isDark: isDark,
            items: _levels.map((l) {
              final id = l['id'] as String? ?? '';
              final label = l['label'] as String? ?? id;
              return DropdownMenuItem(value: id, child: Text(label));
            }).toList(),
            onChanged: (v) =>
                setState(() => _selectedLevel = v ?? 'MD3'),
          ),
          AppSpacing.gapMd,

          // Question count slider
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _FieldLabel('Questions'),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusFull),
                ),
                child: Text(
                  '$_questionCount',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: AppColors.primary,
              thumbColor: AppColors.primary,
              inactiveTrackColor: isDark
                  ? AppColors.darkSurfaceVariant
                  : AppColors.surfaceVariant,
              overlayColor: AppColors.primary.withValues(alpha: 0.1),
            ),
            child: Slider(
              value: _questionCount.toDouble(),
              min: 5,
              max: 30,
              divisions: 25,
              label: '$_questionCount',
              onChanged: (v) => setState(() => _questionCount = v.round()),
            ),
          ),

          // Topic description
          if (_selectedTopic.isNotEmpty) ...[
            Builder(builder: (_) {
              final meta = _topics.where((t) => t['id'] == _selectedTopic);
              final desc = meta.isNotEmpty
                  ? (meta.first['description'] as String?) ?? ''
                  : '';
              if (desc.isEmpty) return const SizedBox.shrink();
              return Column(
                children: [
                  AppSpacing.gapSm,
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isDark
                          ? AppColors.darkSurfaceVariant
                          : AppColors.surfaceVariant,
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                    child: Text(desc,
                        style: Theme.of(context).textTheme.bodySmall),
                  ),
                ],
              );
            }),
          ],

          // Warning if insufficient questions
          if (_selectedTopic.isNotEmpty &&
              _selectedTopicAvailable < _questionCount) ...[
            AppSpacing.gapSm,
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                border: Border.all(
                    color: AppColors.warning.withValues(alpha: 0.3)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.warning_amber_rounded,
                      size: 14, color: AppColors.warning),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Only $_selectedTopicAvailable validated questions available. '
                      'Generate more section questions for stronger diversity.',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.warning),
                    ),
                  ),
                ],
              ),
            ),
          ],

          AppSpacing.gapLg,
          PrimaryButton(
            label: 'Start Assessment',
            icon: Icons.arrow_forward_rounded,
            isLoading: _starting,
            onPressed: (_selectedTopic.isNotEmpty &&
                    _selectedTopicAvailable > 0 &&
                    !_starting)
                ? _startAssessment
                : null,
          ),
          AppSpacing.gapSm,
          Center(
            child: TextButton(
              onPressed: () => context.pop(),
              child: const Text('Back to Practice'),
            ),
          ),
        ],
      ],
    );
  }

  // ── Quiz View ──────────────────────────────────────────────────────────────
  Widget _buildQuiz(BuildContext context, bool isDark) {
    final q = _currentQuestion!;
    final qId = q['id'] as String;
    final stem = q['stem'] as String? ?? '';
    final options = List<String>.from((q['options'] as List?) ?? []);
    final answer = _answers[qId];
    final progress = _questions.isNotEmpty
        ? (_answers.length / _questions.length * 100).clamp(0, 100).toDouble()
        : 0.0;

    return ListView(
      padding: AppSpacing.screenPadding,
      children: [
        if (_runtimeError != null) ...[
          _ErrorBanner(message: _runtimeError!, isDark: isDark),
          AppSpacing.gapMd,
        ],

        // Progress header
        Row(
          children: [
            _Chip(label: _sessionLevelLabel, isDark: isDark),
            const SizedBox(width: 6),
            _Chip(
                label: _formatTopicTag(_selectedTopic), isDark: isDark),
            const Spacer(),
            Text(
              '${_currentIndex + 1}/${_questions.length}',
              style: Theme.of(context)
                  .textTheme
                  .labelMedium
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress / 100,
            minHeight: 5,
            backgroundColor: isDark
                ? AppColors.darkSurfaceVariant
                : AppColors.surfaceVariant,
            color: AppColors.primary,
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            _ProgressMeta(
              icon: Icons.gps_fixed,
              label: '${_answers.length} answered',
              isDark: isDark,
            ),
            const SizedBox(width: 12),
            _ProgressMeta(
              icon: Icons.timer_outlined,
              label: 'Target ${_targetTimeSec}s/question',
              isDark: isDark,
            ),
          ],
        ),
        AppSpacing.gapLg,

        // Stem
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

        // Confidence selector
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: Border.all(
                color: isDark ? AppColors.darkBorder : AppColors.border),
          ),
          child: Row(
            children: [
              Text(
                'Confidence:',
                style: TextStyle(
                  fontSize: 12,
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                ),
              ),
              const SizedBox(width: 8),
              ...List.generate(5, (i) {
                final val = i + 1;
                final selected = _currentConfidence == val;
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: GestureDetector(
                    onTap: answer == null
                        ? () => setState(() => _currentConfidence = val)
                        : null,
                    child: AnimatedContainer(
                      duration: AppSpacing.animFast,
                      width: 30,
                      height: 28,
                      decoration: BoxDecoration(
                        color: selected
                            ? AppColors.primary.withValues(alpha: 0.15)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: selected
                              ? AppColors.primary
                              : (isDark
                                  ? AppColors.darkBorder
                                  : AppColors.border),
                        ),
                      ),
                      child: Center(
                        child: Text(
                          '$val',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: selected
                                ? FontWeight.w700
                                : FontWeight.w400,
                            color:
                                selected ? AppColors.primary : null,
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }),
              const SizedBox(width: 6),
              Text(
                _currentConfidence <= 2
                    ? 'Low'
                    : _currentConfidence == 3
                        ? 'Medium'
                        : 'High',
                style: TextStyle(
                  fontSize: 11,
                  color: isDark
                      ? AppColors.darkTextTertiary
                      : AppColors.textTertiary,
                ),
              ),
            ],
          ),
        ),
        AppSpacing.gapMd,

        // Options
        ...options.asMap().entries.map((entry) {
          final idx = entry.key;
          final text = entry.value;
          final isSelected =
              answer != null && answer['answerIndex'] == idx;
          final isCorrectOpt =
              answer != null && answer['correctIndex'] == idx;

          Color borderColor =
              isDark ? AppColors.darkBorder : AppColors.border;
          Color bgColor =
              isDark ? AppColors.darkSurface : AppColors.surface;

          if (answer != null) {
            if (isCorrectOpt) {
              borderColor = AppColors.success.withValues(alpha: 0.6);
              bgColor = AppColors.success.withValues(alpha: 0.08);
            } else if (isSelected) {
              borderColor = AppColors.error.withValues(alpha: 0.6);
              bgColor = AppColors.error.withValues(alpha: 0.08);
            }
          }

          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: GestureDetector(
              onTap: (answer == null && !_submitting)
                  ? () => _submitAnswer(idx)
                  : null,
              child: AnimatedContainer(
                duration: AppSpacing.animFast,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusMd),
                  border: Border.all(color: borderColor),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isDark
                            ? AppColors.darkSurfaceVariant
                            : AppColors.surfaceVariant,
                        border: Border.all(
                            color: isDark
                                ? AppColors.darkBorder
                                : AppColors.border),
                      ),
                      child: Center(
                        child: Text(
                          String.fromCharCode(65 + idx),
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                        child: Text(text,
                            style: const TextStyle(
                                fontSize: 14, height: 1.4))),
                    if (answer != null && isCorrectOpt)
                      const Icon(Icons.check_circle,
                          color: AppColors.success, size: 18),
                    if (answer != null &&
                        isSelected &&
                        answer['correct'] != true)
                      const Icon(Icons.cancel,
                          color: AppColors.error, size: 18),
                  ],
                ),
              ),
            ),
          );
        }),

        if (_submitting)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Center(
                child: CircularProgressIndicator(strokeWidth: 2)),
          ),

        // Answer feedback
        if (answer != null) ...[
          AppSpacing.gapMd,
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color:
                  (answer['correct'] == true ? AppColors.success : AppColors.error)
                      .withValues(alpha: 0.08),
              borderRadius:
                  BorderRadius.circular(AppSpacing.radiusMd),
              border: Border.all(
                color:
                    (answer['correct'] == true ? AppColors.success : AppColors.error)
                        .withValues(alpha: 0.3),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  answer['correct'] == true
                      ? Icons.check_circle_outline_rounded
                      : Icons.cancel_outlined,
                  size: 16,
                  color: answer['correct'] == true
                      ? AppColors.success
                      : AppColors.error,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    answer['correct'] == true
                        ? 'Correct answer.'
                        : 'Incorrect. Correct option: ${String.fromCharCode(65 + (answer['correctIndex'] as int))}.',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: answer['correct'] == true
                          ? AppColors.success
                          : AppColors.error,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (answer['explanation'] is Map &&
              (answer['explanation'] as Map)['keyTakeaway'] != null) ...[
            AppSpacing.gapSm,
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.05),
                borderRadius:
                    BorderRadius.circular(AppSpacing.radiusMd),
                border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'KEY TAKEAWAY',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    (answer['explanation'] as Map)['keyTakeaway']
                        as String,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.5,
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
          AppSpacing.gapMd,
          PrimaryButton(
            label: _currentIndex >= _questions.length - 1
                ? 'Finish Assessment'
                : 'Next Question',
            icon: _currentIndex < _questions.length - 1
                ? Icons.arrow_forward_rounded
                : null,
            isLoading: _finishing,
            onPressed: _finishing ? null : _nextQuestion,
          ),
        ],
        const SizedBox(height: 32),
      ],
    );
  }

  // ── Report View ────────────────────────────────────────────────────────────
  Widget _buildReport(BuildContext context, bool isDark) {
    final r = _report!;
    final readiness = (r['readinessScore'] as num?)?.toInt() ?? 0;
    final accuracy = (r['overallAccuracy'] as num?)?.toInt() ?? 0;
    final avgTime = (r['avgTimeSec'] as num?)?.toInt() ?? 0;
    final targetTime = (r['targetTimeSec'] as num?)?.toInt() ?? 70;
    final answeredCount = (r['answeredCount'] as num?)?.toInt() ?? 0;
    final totalQuestions = (r['totalQuestions'] as num?)?.toInt() ?? 0;
    final weaknessProfile = List<Map<String, dynamic>>.from(
      (r['weaknessProfile'] as List?)
              ?.map((e) => Map<String, dynamic>.from(e as Map)) ??
          [],
    );
    final recommendations =
        r['recommendations'] as Map<String, dynamic>? ?? {};
    final summary = recommendations['summary'] as String? ?? '';
    final actions = List<Map<String, dynamic>>.from(
      (recommendations['actions'] as List?)
              ?.map((e) => Map<String, dynamic>.from(e as Map)) ??
          [],
    );
    final examTips = List<String>.from(
      (recommendations['examTips'] as List?)?.map((e) => e.toString()) ?? [],
    );

    String paceInsight() {
      if (avgTime > targetTime * 1.3) {
        return 'You are slower than target. Train with strict timed sets.';
      }
      if (avgTime < targetTime * 0.6) {
        return 'You are faster than target. Slow down slightly to avoid avoidable misses.';
      }
      return 'Pacing is within target range.';
    }

    final readinessColor = readiness >= 70
        ? AppColors.success
        : readiness >= 50
            ? AppColors.warning
            : AppColors.error;

    return ListView(
      padding: AppSpacing.screenPadding,
      children: [
        // ── Score banner ────────────────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: AppColors.primaryGradient,
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            boxShadow: AppColors.primaryGradientShadow,
          ),
          child: Column(
            children: [
              Text(
                '$readiness%',
                style: const TextStyle(
                  fontSize: 52,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: -1,
                ),
              ),
              const Text(
                'Readiness Score',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.white70,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (summary.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  summary,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Colors.white,
                    height: 1.5,
                  ),
                ),
              ],
            ],
          ),
        ),
        AppSpacing.gapMd,

        // ── Stats row ───────────────────────────────────────────────────
        Row(
          children: [
            _ReportCard(
              label: 'Readiness',
              value: '$readiness%',
              color: readinessColor,
              isDark: isDark,
            ),
            const SizedBox(width: 8),
            _ReportCard(
              label: 'Accuracy',
              value: '$accuracy%',
              subtitle: '$answeredCount/$totalQuestions',
              isDark: isDark,
            ),
            const SizedBox(width: 8),
            _ReportCard(
              label: 'Pace',
              value: '${avgTime}s',
              subtitle: 'Target ${targetTime}s',
              isDark: isDark,
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          paceInsight(),
          style: TextStyle(
            fontSize: 12,
            color: isDark
                ? AppColors.darkTextTertiary
                : AppColors.textTertiary,
          ),
        ),
        AppSpacing.gapLg,

        // ── Weakness profile ────────────────────────────────────────────
        if (weaknessProfile.isNotEmpty) ...[
          Text(
            'Weakness Profile',
            style: Theme.of(context)
                .textTheme
                .titleSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          AppSpacing.gapSm,
          ...weaknessProfile.map((topic) {
            final tag = topic['tag'] as String? ?? '';
            final sev = topic['severity'] as String? ?? 'STRONG';
            final topicAccuracy =
                (topic['accuracy'] as num?)?.toInt() ?? 0;
            final topicAvg =
                (topic['avgTimeSec'] as num?)?.toInt() ?? 0;
            final weakness =
                ((topic['weaknessScore'] as num?)?.toDouble() ?? 0)
                    .clamp(0, 1);
            final attempts = (topic['attempts'] as num?)?.toInt() ?? 0;

            Color sevColor;
            String sevLabel;
            if (sev == 'CRITICAL') {
              sevColor = AppColors.error;
              sevLabel = 'Critical';
            } else if (sev == 'REINFORCE') {
              sevColor = AppColors.warning;
              sevLabel = 'Reinforce';
            } else {
              sevColor = AppColors.success;
              sevLabel = 'Strong';
            }

            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.surface,
                borderRadius:
                    BorderRadius.circular(AppSpacing.radiusMd),
                border: Border.all(
                    color: isDark ? AppColors.darkBorder : AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _formatTopicTag(tag),
                              style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600),
                            ),
                            Text(
                              '$attempts question${attempts == 1 ? '' : 's'} analyzed',
                              style: TextStyle(
                                fontSize: 11,
                                color: isDark
                                    ? AppColors.darkTextTertiary
                                    : AppColors.textTertiary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: sevColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          sevLabel,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: sevColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      _MiniStat(
                          label: 'Accuracy',
                          value: '$topicAccuracy%',
                          isDark: isDark),
                      const SizedBox(width: 6),
                      _MiniStat(
                          label: 'Avg Time',
                          value: '${topicAvg}s',
                          isDark: isDark),
                      const SizedBox(width: 6),
                      _MiniStat(
                          label: 'Weakness',
                          value: '${(weakness * 100).round()}%',
                          isDark: isDark),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: LinearProgressIndicator(
                      value: topicAccuracy / 100,
                      minHeight: 5,
                      backgroundColor: isDark
                          ? AppColors.darkSurfaceVariant
                          : AppColors.surfaceVariant,
                      color: sevColor,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],

        // ── Recovery actions ────────────────────────────────────────────
        if (actions.isNotEmpty) ...[
          AppSpacing.gapLg,
          Text(
            'Recommended Recovery Actions',
            style: Theme.of(context)
                .textTheme
                .titleSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          AppSpacing.gapSm,
          ...actions.map((action) {
            final title = action['title'] as String? ?? '';
            final rationale = action['rationale'] as String? ?? '';
            final mins =
                (action['recommendedMinutes'] as num?)?.toInt() ?? 0;
            final drills = List<String>.from(
                (action['drills'] as List?)?.map((e) => e.toString()) ??
                    []);
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.surface,
                borderRadius:
                    BorderRadius.circular(AppSpacing.radiusMd),
                border: Border.all(
                    color:
                        isDark ? AppColors.darkBorder : AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(title,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600)),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(
                              color: isDark
                                  ? AppColors.darkBorder
                                  : AppColors.border),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.timer_outlined,
                                size: 12,
                                color: AppColors.textTertiary),
                            const SizedBox(width: 3),
                            Text('$mins min',
                                style: const TextStyle(fontSize: 11)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (rationale.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      rationale,
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                      ),
                    ),
                  ],
                  if (drills.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    ...drills.map((d) => Padding(
                          padding: const EdgeInsets.only(bottom: 4, left: 8),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('• ',
                                  style: TextStyle(fontSize: 13)),
                              Expanded(
                                child: Text(
                                  d,
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: isDark
                                        ? AppColors.darkTextSecondary
                                        : AppColors.textSecondary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        )),
                  ],
                ],
              ),
            );
          }),
        ],

        // ── Exam tips ──────────────────────────────────────────────────
        if (examTips.isNotEmpty) ...[
          AppSpacing.gapLg,
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark
                  ? AppColors.darkSurfaceVariant
                  : AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'EXAM EXECUTION TIPS',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 10),
                ...examTips.map((tip) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.trending_up,
                              size: 14, color: AppColors.primary),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              tip,
                              style: TextStyle(
                                fontSize: 13,
                                height: 1.4,
                                color: isDark
                                    ? AppColors.darkTextSecondary
                                    : AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    )),
              ],
            ),
          ),
        ],

        AppSpacing.gapLg,
        PrimaryButton(
          label: 'New Assessment',
          icon: Icons.refresh_rounded,
          onPressed: _restart,
        ),
        AppSpacing.gapSm,
        Center(
          child: TextButton(
            onPressed: () => context.go('/planner'),
            child: const Text('Open Planner'),
          ),
        ),
        const SizedBox(height: 32),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper widgets
// ─────────────────────────────────────────────────────────────────────────────

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context)
          .textTheme
          .labelLarge
          ?.copyWith(fontWeight: FontWeight.w600),
    );
  }
}

class _DropdownField<T> extends StatelessWidget {
  final T? value;
  final String hint;
  final bool isDark;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;

  const _DropdownField({
    required this.value,
    required this.hint,
    required this.isDark,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
            color: isDark ? AppColors.darkBorder : AppColors.border),
        color: isDark ? AppColors.darkSurface : AppColors.surface,
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isExpanded: true,
          hint: Text(hint),
          items: items,
          onChanged: onChanged,
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool isDark;
  const _Chip({required this.label, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
        border:
            Border.all(color: isDark ? AppColors.darkBorder : AppColors.border),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
        ),
      ),
    );
  }
}

class _ProgressMeta extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isDark;
  const _ProgressMeta(
      {required this.icon, required this.label, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon,
            size: 12,
            color:
                isDark ? AppColors.darkTextTertiary : AppColors.textTertiary),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color:
                isDark ? AppColors.darkTextTertiary : AppColors.textTertiary,
          ),
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  final String message;
  final bool isDark;
  const _ErrorBanner({required this.message, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline_rounded,
              size: 14, color: AppColors.error),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(fontSize: 13, color: AppColors.error),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  final String label;
  final String value;
  final String? subtitle;
  final Color? color;
  final bool isDark;

  const _ReportCard({
    required this.label,
    required this.value,
    this.subtitle,
    this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(
              color: isDark ? AppColors.darkBorder : AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: isDark
                    ? AppColors.darkTextTertiary
                    : AppColors.textTertiary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
            ),
            if (subtitle != null)
              Text(
                subtitle!,
                style: TextStyle(
                  fontSize: 10,
                  color: isDark
                      ? AppColors.darkTextTertiary
                      : AppColors.textTertiary,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final bool isDark;

  const _MiniStat(
      {required this.label, required this.value, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
              color: isDark ? AppColors.darkBorder : AppColors.border),
        ),
        child: Column(
          children: [
            Text(
              label.toUpperCase(),
              style: TextStyle(
                fontSize: 9,
                letterSpacing: 0.8,
                color: isDark
                    ? AppColors.darkTextTertiary
                    : AppColors.textTertiary,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}
