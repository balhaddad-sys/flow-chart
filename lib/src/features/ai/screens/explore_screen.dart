import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/services/cloud_functions_service.dart';

// ── Level options (matching backend ASSESSMENT_LEVELS) ───────────────────────

const _levels = [
  _LevelOption('MD1', 'MD1 (Foundations)'),
  _LevelOption('MD2', 'MD2 (Integrated Basics)'),
  _LevelOption('MD3', 'MD3 (Clinical Core)'),
  _LevelOption('MD4', 'MD4 (Advanced Clinical)'),
  _LevelOption('MD5', 'MD5 (Senior Clinical)'),
  _LevelOption('INTERN', 'Doctor Intern'),
  _LevelOption('RESIDENT', 'Resident'),
  _LevelOption('POSTGRADUATE', 'Doctor Postgraduate'),
];

class _LevelOption {
  final String id;
  final String label;
  const _LevelOption(this.id, this.label);
}

// ── Phase enum ───────────────────────────────────────────────────────────────

enum _ExplorePhase { setup, loading, teaching, quiz, results }

// ── Explore Screen ────────────────────────────────────────────────────────────

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  final _topicController = TextEditingController();
  _LevelOption _selectedLevel = _levels[2]; // MD3 default
  int _questionCount = 10;
  _ExplorePhase _phase = _ExplorePhase.setup;
  bool _loading = false;
  Map<String, dynamic>? _insightData;
  String? _errorText;

  // Quiz state
  List<Map<String, dynamic>> _quizQuestions = [];
  int _currentIndex = 0;
  final Map<String, int> _answers = {};
  final Map<String, int> _confidence = {};
  final Map<String, bool> _results = {};

  @override
  void dispose() {
    _topicController.dispose();
    super.dispose();
  }

  String get _topic => _topicController.text.trim();

  // ── Teaching Outline ────────────────────────────────────────────────────

  Future<void> _getInsight() async {
    if (_topic.isEmpty) return;
    setState(() {
      _phase = _ExplorePhase.loading;
      _loading = true;
      _errorText = null;
      _insightData = null;
    });
    try {
      final result = await ref
          .read(cloudFunctionsServiceProvider)
          .exploreTopicInsight(topic: _topic, level: _selectedLevel.id);
      if (!mounted) return;
      setState(() {
        _insightData = result;
        _phase = _ExplorePhase.teaching;
      });
    } catch (e) {
      if (!mounted) return;
      final msg = e is CloudFunctionException
          ? e.message
          : 'Failed to get insight. Please try again.';
      setState(() {
        _errorText = msg;
        _phase = _ExplorePhase.setup;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── Quiz Generation ─────────────────────────────────────────────────────

  Future<void> _getQuiz() async {
    if (_topic.isEmpty) return;
    setState(() {
      _phase = _ExplorePhase.loading;
      _loading = true;
      _errorText = null;
      _quizQuestions = [];
      _currentIndex = 0;
      _answers.clear();
      _confidence.clear();
      _results.clear();
    });
    try {
      final result = await ref
          .read(cloudFunctionsServiceProvider)
          .exploreQuiz(
            topic: _topic,
            level: _selectedLevel.id,
            count: _questionCount,
          );
      if (!mounted) return;
      final questions = result['questions'] as List?;
      if (questions == null || questions.isEmpty) {
        setState(() {
          _errorText = 'No questions generated. Try a different topic.';
          _phase = _ExplorePhase.setup;
        });
        return;
      }
      setState(() {
        _quizQuestions = questions
            .whereType<Map>()
            .map((m) => _deepCastMap(m))
            .toList();
        _phase = _ExplorePhase.quiz;
      });
    } catch (e) {
      if (!mounted) return;
      final msg = e is CloudFunctionException
          ? e.message
          : 'Failed to generate quiz. Please try again.';
      setState(() {
        _errorText = msg;
        _phase = _ExplorePhase.setup;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── Quiz from Teaching ──────────────────────────────────────────────────

  Future<void> _startQuizFromTeaching() async {
    await _getQuiz();
  }

  // ── Navigation ──────────────────────────────────────────────────────────

  void _goBack() {
    setState(() {
      _phase = _ExplorePhase.setup;
      _errorText = null;
    });
  }

  void _handleAnswer(String questionId, int optionIndex, int correctIndex) {
    if (_answers.containsKey(questionId)) return;
    setState(() {
      _answers[questionId] = optionIndex;
      _results[questionId] = optionIndex == correctIndex;
    });
  }

  void _handleNext() {
    if (_currentIndex >= _quizQuestions.length - 1) {
      setState(() => _phase = _ExplorePhase.results);
    } else {
      setState(() => _currentIndex++);
    }
  }

  void _setConfidence(String questionId, int value) {
    setState(() => _confidence[questionId] = value);
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
        leading: _phase != _ExplorePhase.setup
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: _goBack,
              )
            : null,
      ),
      body: switch (_phase) {
        _ExplorePhase.setup => _buildSetup(isDark),
        _ExplorePhase.loading => _buildLoading(isDark),
        _ExplorePhase.teaching => _buildTeaching(isDark),
        _ExplorePhase.quiz => _buildQuiz(isDark),
        _ExplorePhase.results => _buildResults(isDark),
      },
    );
  }

  // ── SETUP PHASE ─────────────────────────────────────────────────────────

  Widget _buildSetup(bool isDark) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text(
          'Enter any medical topic to get an AI-generated teaching outline or adaptive quiz.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.textSecondary,
                height: 1.5,
              ),
        ),
        AppSpacing.gapMd,

        // Topic input
        TextField(
          controller: _topicController,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _getInsight(),
          style: Theme.of(context).textTheme.bodyMedium,
          decoration: InputDecoration(
            hintText: 'e.g. Acute Coronary Syndrome, DKA management...',
            prefixIcon: const Icon(Icons.search_rounded, size: 20),
            suffixIcon: _topicController.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear_rounded, size: 18),
                    onPressed: () {
                      _topicController.clear();
                      setState(() => _errorText = null);
                    },
                  )
                : null,
          ),
          onChanged: (_) => setState(() {}),
        ),

        // Topic suggestions
        AppSpacing.gapSm,
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            'Acute Coronary Syndrome',
            'DKA Management',
            'COPD Exacerbation',
            'Sepsis Protocol',
            'Atrial Fibrillation',
            'Nephrotic Syndrome',
          ]
              .map((t) => _ChipButton(
                    label: t,
                    isDark: isDark,
                    onTap: () => _topicController.text = t,
                  ))
              .toList(),
        ),
        AppSpacing.gapMd,

        // Level picker
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
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  border: Border.all(
                    color: isDark ? AppColors.darkBorder : AppColors.border,
                  ),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedLevel.id,
                    isExpanded: true,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontSize: 13,
                          color: isDark
                              ? AppColors.darkTextPrimary
                              : AppColors.textPrimary,
                        ),
                    dropdownColor:
                        isDark ? AppColors.darkSurface : AppColors.surface,
                    items: _levels
                        .map(
                          (l) => DropdownMenuItem(
                            value: l.id,
                            child: Text(l.label),
                          ),
                        )
                        .toList(),
                    onChanged: (v) {
                      if (v != null) {
                        setState(() {
                          _selectedLevel =
                              _levels.firstWhere((l) => l.id == v);
                        });
                      }
                    },
                  ),
                ),
              ),
            ),
          ],
        ),
        AppSpacing.gapMd,

        // Question count slider
        Row(
          children: [
            Text(
              'Questions:',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(width: 8),
            Text(
              '$_questionCount',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
            ),
            Expanded(
              child: Slider(
                value: _questionCount.toDouble(),
                min: 3,
                max: 20,
                divisions: 17,
                activeColor: AppColors.primary,
                onChanged: (v) => setState(() => _questionCount = v.round()),
              ),
            ),
          ],
        ),
        AppSpacing.gapMd,

        // Action buttons
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: _topic.isEmpty ? null : _getInsight,
                icon: const Icon(Icons.auto_stories_outlined, size: 16),
                label: const Text('Learn Topic'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
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
                onPressed: _topic.isEmpty ? null : _getQuiz,
                icon: const Icon(Icons.quiz_outlined, size: 16),
                label: const Text('Start Quiz'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
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

        // Error
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
                    style:
                        const TextStyle(fontSize: 13, color: AppColors.error),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  // ── LOADING PHASE ───────────────────────────────────────────────────────

  Widget _buildLoading(bool isDark) {
    return Center(
      child: _LoadingCard(
        isDark: isDark,
        label: 'Generating content for "${_topic}"...',
      ),
    );
  }

  // ── TEACHING PHASE ──────────────────────────────────────────────────────

  Widget _buildTeaching(bool isDark) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        if (_insightData != null)
          _TopicInsightView(
            data: _insightData!,
            topicLabel: _topic,
            isDark: isDark,
          ),
        AppSpacing.gapLg,
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _getQuiz,
            icon: const Icon(Icons.quiz_outlined, size: 16),
            label: Text('Take Quiz ($_questionCount questions)'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              ),
              textStyle: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ── QUIZ PHASE ──────────────────────────────────────────────────────────

  Widget _buildQuiz(bool isDark) {
    if (_quizQuestions.isEmpty) return const SizedBox.shrink();
    final q = _quizQuestions[_currentIndex];
    final questionId = q['id']?.toString() ?? 'q_$_currentIndex';
    final stem = q['stem'] as String? ?? q['question'] as String? ?? '';
    final rawOptions = q['options'] as List? ?? [];
    final options = rawOptions.map((o) => o.toString()).toList();
    final correctIndex = (q['correctIndex'] as num?)?.toInt() ?? 0;
    final isAnswered = _answers.containsKey(questionId);
    final selectedAnswer = _answers[questionId];
    final isCorrect = _results[questionId] == true;
    final currentConfidence = _confidence[questionId];

    // Explanation
    final rawExplanation = q['explanation'];
    String keyTakeaway = '';
    String correctWhy = '';
    List<String> whyOthersWrong = [];
    if (rawExplanation is Map) {
      keyTakeaway = (rawExplanation['keyTakeaway'] as String? ?? '').trim();
      correctWhy = (rawExplanation['correctWhy'] as String? ?? '').trim();
      final rawOthers = rawExplanation['whyOthersWrong'];
      if (rawOthers is List) {
        whyOthersWrong = rawOthers.whereType<String>().toList();
      }
    }

    final isLast = _currentIndex >= _quizQuestions.length - 1;
    final answeredCount = _answers.length;
    final progress = _quizQuestions.isNotEmpty
        ? answeredCount / _quizQuestions.length
        : 0.0;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
      children: [
        // Progress header
        Row(
          children: [
            Text(
              _topic,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const Spacer(),
            Text(
              '${_currentIndex + 1} of ${_quizQuestions.length}',
              style: TextStyle(
                fontSize: 12,
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress,
            backgroundColor: isDark
                ? AppColors.darkSurfaceVariant
                : AppColors.surfaceVariant,
            color: AppColors.primary,
            minHeight: 6,
          ),
        ),
        const SizedBox(height: 20),

        // Stem
        Text(
          stem,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
                fontSize: 15,
                height: 1.5,
              ),
        ),
        const SizedBox(height: 16),

        // Confidence (before answering)
        if (!isAnswered) ...[
          Row(
            children: [
              Text(
                'How confident?',
                style: TextStyle(
                  fontSize: 12,
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                ),
              ),
              const SizedBox(width: 10),
              ...[
                (1, 'Low'),
                (3, 'Medium'),
                (5, 'High'),
              ].map((item) {
                final isActive = currentConfidence == item.$1;
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: GestureDetector(
                    onTap: () => _setConfidence(questionId, item.$1),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: isActive
                            ? AppColors.primary.withValues(alpha: 0.12)
                            : (isDark
                                ? AppColors.darkSurface
                                : AppColors.surface),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isActive
                              ? AppColors.primary.withValues(alpha: 0.4)
                              : (isDark
                                  ? AppColors.darkBorder
                                  : AppColors.border),
                        ),
                      ),
                      child: Text(
                        item.$2,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight:
                              isActive ? FontWeight.w700 : FontWeight.w500,
                          color: isActive
                              ? AppColors.primary
                              : (isDark
                                  ? AppColors.darkTextSecondary
                                  : AppColors.textSecondary),
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ],
          ),
          const SizedBox(height: 12),
          if (currentConfidence == null)
            Text(
              'Set confidence to unlock options',
              style: TextStyle(
                fontSize: 11,
                color: isDark
                    ? AppColors.darkTextTertiary
                    : AppColors.textTertiary,
              ),
            ),
        ] else ...[
          Text(
            'Confidence: ${_confidenceLabel(currentConfidence)}',
            style: TextStyle(
              fontSize: 12,
              color: isDark
                  ? AppColors.darkTextSecondary
                  : AppColors.textSecondary,
            ),
          ),
        ],
        const SizedBox(height: 12),

        // Options
        Opacity(
          opacity: currentConfidence == null && !isAnswered ? 0.5 : 1.0,
          child: IgnorePointer(
            ignoring: currentConfidence == null && !isAnswered,
            child: Column(
              children: options.asMap().entries.map((e) {
                final i = e.key;
                final opt = e.value;
                final isSelected = selectedAnswer == i;
                final isCorrectOpt = i == correctIndex;

                Color bgColor = isDark
                    ? AppColors.darkBackground
                    : AppColors.background;
                Color borderColor =
                    isDark ? AppColors.darkBorder : AppColors.border;
                Color textColor =
                    isDark ? AppColors.darkTextPrimary : AppColors.textPrimary;

                if (isAnswered) {
                  if (isCorrectOpt) {
                    bgColor = AppColors.success.withValues(alpha: 0.1);
                    borderColor = AppColors.success;
                  } else if (isSelected && !isCorrectOpt) {
                    bgColor = AppColors.error.withValues(alpha: 0.08);
                    borderColor = AppColors.error;
                    textColor = AppColors.error;
                  }
                }

                return GestureDetector(
                  onTap: isAnswered
                      ? null
                      : () =>
                          _handleAnswer(questionId, i, correctIndex),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 11),
                    decoration: BoxDecoration(
                      color: bgColor,
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusSm),
                      border: Border.all(color: borderColor),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: borderColor.withValues(alpha: 0.12),
                          ),
                          child: Center(
                            child: Text(
                              String.fromCharCode(65 + i),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: borderColor,
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
                              fontWeight: isAnswered && isCorrectOpt
                                  ? FontWeight.w600
                                  : FontWeight.w400,
                            ),
                          ),
                        ),
                        if (isAnswered && isCorrectOpt)
                          const Icon(Icons.check_circle_rounded,
                              size: 16, color: AppColors.success),
                        if (isAnswered && isSelected && !isCorrectOpt)
                          const Icon(Icons.cancel_rounded,
                              size: 16, color: AppColors.error),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),

        // Post-answer feedback
        if (isAnswered) ...[
          const SizedBox(height: 12),

          // Result banner + Next
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isCorrect
                  ? AppColors.success.withValues(alpha: 0.1)
                  : AppColors.error.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            ),
            child: Row(
              children: [
                Icon(
                  isCorrect
                      ? Icons.check_circle_rounded
                      : Icons.cancel_rounded,
                  size: 18,
                  color: isCorrect ? AppColors.success : AppColors.error,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    isCorrect
                        ? 'Correct!'
                        : 'Incorrect — ${String.fromCharCode(65 + correctIndex)}',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isCorrect ? AppColors.success : AppColors.error,
                    ),
                  ),
                ),
                ElevatedButton(
                  onPressed: _handleNext,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 8),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusSm),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  child: Text(isLast ? 'Results' : 'Next'),
                ),
              ],
            ),
          ),

          // Calibration feedback
          if (currentConfidence != null) ...[
            const SizedBox(height: 10),
            _CalibrationBanner(
              confidence: currentConfidence,
              isCorrect: isCorrect,
              isDark: isDark,
            ),
          ],

          // Key takeaway + Why correct
          if (keyTakeaway.isNotEmpty || correctWhy.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
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
                  if (keyTakeaway.isNotEmpty) ...[
                    Text(
                      'KEY TAKEAWAY',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      keyTakeaway,
                      style: TextStyle(
                        fontSize: 13,
                        height: 1.5,
                        color: isDark
                            ? AppColors.darkTextPrimary
                            : AppColors.textPrimary,
                      ),
                    ),
                    if (correctWhy.isNotEmpty) const SizedBox(height: 10),
                  ],
                  if (correctWhy.isNotEmpty) ...[
                    Text(
                      'WHY CORRECT',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: AppColors.success,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      correctWhy,
                      style: TextStyle(
                        fontSize: 13,
                        height: 1.5,
                        color: isDark
                            ? AppColors.darkTextPrimary
                            : AppColors.textPrimary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],

          // Why selected option is wrong
          if (selectedAnswer != null &&
              selectedAnswer != correctIndex &&
              selectedAnswer < whyOthersWrong.length &&
              whyOthersWrong[selectedAnswer].isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                border: Border.all(
                  color: AppColors.error.withValues(alpha: 0.2),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.cancel_outlined,
                          size: 14, color: AppColors.error),
                      SizedBox(width: 6),
                      Text(
                        'Why your answer is wrong',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.error,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    whyOthersWrong[selectedAnswer],
                    style: TextStyle(
                      fontSize: 12,
                      height: 1.5,
                      color: isDark
                          ? AppColors.darkTextPrimary
                          : AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ],
    );
  }

  // ── RESULTS PHASE ───────────────────────────────────────────────────────

  Widget _buildResults(bool isDark) {
    final totalAnswered = _results.length;
    final correctCount = _results.values.where((v) => v).length;
    final accuracy =
        totalAnswered > 0 ? (correctCount / totalAnswered * 100).round() : 0;

    // Calibration analysis
    final confidenceEntries = _confidence.entries.toList();
    double avgConfidence = 0;
    if (confidenceEntries.isNotEmpty) {
      avgConfidence = confidenceEntries
              .map((e) => e.value)
              .reduce((a, b) => a + b) /
          confidenceEntries.length;
    }
    final predictedAccuracy = ((avgConfidence - 1) / 4 * 100).round();
    final calibrationGap = (predictedAccuracy - accuracy).abs();

    // Overconfident misses
    final overconfidentMisses = _confidence.entries
        .where((e) => e.value >= 4 && _results[e.key] == false)
        .length;

    Color accuracyColor;
    if (accuracy >= 80) {
      accuracyColor = AppColors.success;
    } else if (accuracy >= 60) {
      accuracyColor = AppColors.warning;
    } else {
      accuracyColor = AppColors.error;
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        // Score card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkSurface : AppColors.surface,
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            border: Border.all(
              color: isDark ? AppColors.darkBorder : AppColors.border,
            ),
          ),
          child: Column(
            children: [
              Text(
                _topic,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                _selectedLevel.label,
                style: TextStyle(
                  fontSize: 12,
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                '$accuracy%',
                style: TextStyle(
                  fontSize: 48,
                  fontWeight: FontWeight.w800,
                  color: accuracyColor,
                ),
              ),
              Text(
                '$correctCount of $totalAnswered correct',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
        AppSpacing.gapMd,

        // Confidence calibration
        if (confidenceEntries.isNotEmpty) ...[
          Container(
            padding: const EdgeInsets.all(16),
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
                Row(
                  children: [
                    Icon(Icons.psychology_outlined,
                        size: 16, color: AppColors.info),
                    const SizedBox(width: 6),
                    Text(
                      'Confidence Calibration',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.info,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                _StatRow(
                  label: 'Avg confidence',
                  value: avgConfidence.toStringAsFixed(1),
                  isDark: isDark,
                ),
                _StatRow(
                  label: 'Predicted accuracy',
                  value: '$predictedAccuracy%',
                  isDark: isDark,
                ),
                _StatRow(
                  label: 'Actual accuracy',
                  value: '$accuracy%',
                  isDark: isDark,
                ),
                _StatRow(
                  label: 'Calibration gap',
                  value: '$calibrationGap%',
                  isDark: isDark,
                  highlighted: calibrationGap > 20,
                ),
                if (overconfidentMisses > 0) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.warning.withValues(alpha: 0.08),
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusSm),
                      border: Border(
                        left: BorderSide(color: AppColors.warning, width: 3),
                      ),
                    ),
                    child: Text(
                      '$overconfidentMisses overconfident miss${overconfidentMisses == 1 ? '' : 'es'} — review the clinical clues you over-weighted.',
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.4,
                        color: isDark
                            ? AppColors.darkTextPrimary
                            : AppColors.textPrimary,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          AppSpacing.gapMd,
        ],

        // Actions
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _goBack,
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  ),
                ),
                child: const Text('New Topic'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: ElevatedButton(
                onPressed: _getQuiz,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  ),
                ),
                child: const Text('Retry Quiz'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  String _confidenceLabel(int? confidence) {
    final safe = confidence ?? 0;
    if (safe >= 4) return 'High confidence';
    if (safe >= 3) return 'Moderate confidence';
    if (safe >= 1) return 'Low confidence';
    return 'Not set';
  }
}

// ── Calibration Banner ───────────────────────────────────────────────────────

class _CalibrationBanner extends StatelessWidget {
  final int confidence;
  final bool isCorrect;
  final bool isDark;

  const _CalibrationBanner({
    required this.confidence,
    required this.isCorrect,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    String title;
    String message;
    Color color;

    if (confidence >= 4 && !isCorrect) {
      title = 'Overconfident miss';
      message =
          'You were very confident but missed this. Identify the clinical clue you over-weighted.';
      color = AppColors.warning;
    } else if (confidence <= 2 && isCorrect) {
      title = 'Underconfident correct';
      message =
          'Your reasoning was right. Trust your diagnostic process for similar clues.';
      color = AppColors.info;
    } else if (confidence >= 4 && isCorrect) {
      title = 'Well-calibrated correct';
      message = 'Strong confidence and correct answer. Keep this template.';
      color = AppColors.success;
    } else {
      title = 'Calibration check';
      message =
          'Restate the decisive clue and compare with your confidence level.';
      color = isDark ? AppColors.darkTextSecondary : AppColors.textSecondary;
    }

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border(left: BorderSide(color: color, width: 3)),
      ),
      child: Text.rich(
        TextSpan(children: [
          TextSpan(
            text: '$title: ',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          TextSpan(
            text: message,
            style: TextStyle(
              fontSize: 12,
              height: 1.4,
              color:
                  isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
            ),
          ),
        ]),
      ),
    );
  }
}

// ── Stat Row ──────────────────────────────────────────────────────────────────

class _StatRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isDark;
  final bool highlighted;

  const _StatRow({
    required this.label,
    required this.value,
    required this.isDark,
    this.highlighted = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color:
                  isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: highlighted
                  ? AppColors.warning
                  : (isDark
                      ? AppColors.darkTextPrimary
                      : AppColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Chip Button ──────────────────────────────────────────────────────────────

class _ChipButton extends StatelessWidget {
  final String label;
  final bool isDark;
  final VoidCallback onTap;

  const _ChipButton({
    required this.label,
    required this.isDark,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? AppColors.darkBorder : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color:
                isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}

// ── Topic Insight View ────────────────────────────────────────────────────────

class _TopicInsightView extends StatelessWidget {
  final Map<String, dynamic> data;
  final String topicLabel;
  final bool isDark;

  const _TopicInsightView({
    required this.data,
    required this.topicLabel,
    required this.isDark,
  });

  List<T> _castList<T>(dynamic raw) {
    if (raw is! List) return [];
    return raw.whereType<T>().toList();
  }

  List<Map<String, dynamic>> _castMapList(dynamic raw) {
    if (raw is! List) return [];
    return raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final summary = (data['summary'] as String? ?? '').trim();
    final corePoints = _castList<String>(data['corePoints']);
    final teachingSections = _castMapList(data['teachingSections']);
    final clinicalFramework = data['clinicalFramework'] is Map
        ? Map<String, dynamic>.from(data['clinicalFramework'] as Map)
        : <String, dynamic>{};
    final clinicalPitfalls = _castList<String>(data['clinicalPitfalls']);
    final redFlags = _castList<String>(data['redFlags']);
    final studyApproach = _castList<String>(data['studyApproach']);
    final guidelineUpdates = _castMapList(data['guidelineUpdates']);
    final citations = _castMapList(data['citations']);
    final levelLabel = data['levelLabel'] as String? ?? '';

    final hasContent = summary.isNotEmpty ||
        corePoints.isNotEmpty ||
        teachingSections.isNotEmpty;

    if (!hasContent) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(
            color: isDark ? AppColors.darkBorder : AppColors.border,
          ),
        ),
        child: Text(
          'No content returned. Try a different topic.',
          style: TextStyle(
            fontSize: 13,
            color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        _SectionHeader(
          icon: Icons.auto_stories_outlined,
          title: 'Teaching Outline',
          subtitle: levelLabel.isNotEmpty
              ? '$topicLabel ($levelLabel)'
              : topicLabel,
          isDark: isDark,
        ),
        AppSpacing.gapSm,

        // Summary
        if (summary.isNotEmpty) ...[
          _Card(
            isDark: isDark,
            child: SelectableText(
              summary,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontSize: 14,
                    height: 1.65,
                    color: isDark
                        ? AppColors.darkTextPrimary
                        : AppColors.textPrimary,
                  ),
            ),
          ),
          AppSpacing.gapMd,
        ],

        // Core Points
        if (corePoints.isNotEmpty) ...[
          _BlockHeader(
            icon: Icons.star_outline_rounded,
            title: 'Core Points',
            color: AppColors.primary,
            isDark: isDark,
          ),
          AppSpacing.gapXs,
          _Card(
            isDark: isDark,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: corePoints
                  .map((p) => _BulletPoint(text: p, isDark: isDark))
                  .toList(),
            ),
          ),
          AppSpacing.gapMd,
        ],

        // Teaching Sections
        if (teachingSections.isNotEmpty) ...[
          _BlockHeader(
            icon: Icons.school_outlined,
            title: 'Teaching Sections',
            color: AppColors.secondary,
            isDark: isDark,
          ),
          AppSpacing.gapXs,
          ...teachingSections.map((section) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _TeachingSectionCard(
                    section: section, isDark: isDark),
              )),
          AppSpacing.gapSm,
        ],

        // Clinical Framework
        if (clinicalFramework.isNotEmpty) ...[
          ..._buildClinicalFramework(context, clinicalFramework),
        ],

        // Clinical Pitfalls
        if (clinicalPitfalls.isNotEmpty) ...[
          _BlockHeader(
            icon: Icons.warning_amber_rounded,
            title: 'Clinical Pitfalls',
            color: AppColors.warning,
            isDark: isDark,
          ),
          AppSpacing.gapXs,
          ...clinicalPitfalls.map((p) => _WarningItem(
                text: p,
                color: AppColors.warning,
                isDark: isDark,
              )),
          AppSpacing.gapMd,
        ],

        // Red Flags
        if (redFlags.isNotEmpty) ...[
          _BlockHeader(
            icon: Icons.flag_rounded,
            title: 'Red Flags',
            color: AppColors.error,
            isDark: isDark,
          ),
          AppSpacing.gapXs,
          ...redFlags.map((f) => _WarningItem(
                text: f,
                color: AppColors.error,
                isDark: isDark,
              )),
          AppSpacing.gapMd,
        ],

        // Study Approach
        if (studyApproach.isNotEmpty) ...[
          _BlockHeader(
            icon: Icons.route_outlined,
            title: 'Study Approach',
            color: AppColors.info,
            isDark: isDark,
          ),
          AppSpacing.gapXs,
          _Card(
            isDark: isDark,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: studyApproach.asMap().entries.map((e) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 20,
                        height: 20,
                        margin: const EdgeInsets.only(top: 1),
                        decoration: BoxDecoration(
                          color: AppColors.info.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Center(
                          child: Text(
                            '${e.key + 1}',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.info,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          e.value,
                          style: TextStyle(
                            fontSize: 13,
                            height: 1.5,
                            color: isDark
                                ? AppColors.darkTextPrimary
                                : AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
          AppSpacing.gapMd,
        ],

        // Guideline Updates
        if (guidelineUpdates.isNotEmpty) ...[
          _BlockHeader(
            icon: Icons.update_rounded,
            title: 'Guideline Updates',
            color: const Color(0xFF7C3AED),
            isDark: isDark,
          ),
          AppSpacing.gapXs,
          ...guidelineUpdates.map((g) => _GuidelineCard(
                guideline: g,
                isDark: isDark,
              )),
          AppSpacing.gapMd,
        ],

        // Citations
        if (citations.isNotEmpty) ...[
          _BlockHeader(
            icon: Icons.menu_book_outlined,
            title: 'References',
            color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
            isDark: isDark,
          ),
          AppSpacing.gapXs,
          _Card(
            isDark: isDark,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: citations.map((c) {
                final title = c['title'] as String? ?? '';
                final source = c['source'] as String? ?? '';
                final url = c['url'] as String? ?? '';
                final verified = c['verified'] == true;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: GestureDetector(
                    onTap: url.isNotEmpty
                        ? () => _openUrl(url)
                        : null,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          verified
                              ? Icons.verified_rounded
                              : Icons.open_in_new_rounded,
                          size: 13,
                          color: verified
                              ? AppColors.success
                              : (url.isNotEmpty
                                  ? AppColors.primary
                                  : (isDark
                                      ? AppColors.darkTextTertiary
                                      : AppColors.textTertiary)),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text.rich(
                            TextSpan(children: [
                              if (source.isNotEmpty)
                                TextSpan(
                                  text: '[$source] ',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: isDark
                                        ? AppColors.darkTextSecondary
                                        : AppColors.textSecondary,
                                  ),
                                ),
                              TextSpan(
                                text: title,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: url.isNotEmpty
                                      ? AppColors.primary
                                      : (isDark
                                          ? AppColors.darkTextPrimary
                                          : AppColors.textPrimary),
                                  decoration: url.isNotEmpty
                                      ? TextDecoration.underline
                                      : null,
                                ),
                              ),
                            ]),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          AppSpacing.gapMd,
        ],
      ],
    );
  }

  List<Widget> _buildClinicalFramework(
      BuildContext context, Map<String, dynamic> fw) {
    final pathophysiology = (fw['pathophysiology'] as String? ?? '').trim();
    final diagnosticApproach = _castList<String>(fw['diagnosticApproach']);
    final managementApproach = _castList<String>(fw['managementApproach']);
    final escalationTriggers = _castList<String>(fw['escalationTriggers']);

    final hasContent = pathophysiology.isNotEmpty ||
        diagnosticApproach.isNotEmpty ||
        managementApproach.isNotEmpty ||
        escalationTriggers.isNotEmpty;

    if (!hasContent) return [];

    return [
      _BlockHeader(
        icon: Icons.medical_information_outlined,
        title: 'Clinical Framework',
        color: const Color(0xFF059669),
        isDark: isDark,
      ),
      AppSpacing.gapXs,
      if (pathophysiology.isNotEmpty) ...[
        _Card(
          isDark: isDark,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Pathophysiology',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 6),
              SelectableText(
                pathophysiology,
                style: TextStyle(
                  fontSize: 13,
                  height: 1.6,
                  color: isDark
                      ? AppColors.darkTextPrimary
                      : AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
      ],
      if (diagnosticApproach.isNotEmpty) ...[
        _FrameworkList(
          title: 'Diagnostic Approach',
          items: diagnosticApproach,
          icon: Icons.search_rounded,
          color: const Color(0xFF2563EB),
          isDark: isDark,
        ),
        const SizedBox(height: 8),
      ],
      if (managementApproach.isNotEmpty) ...[
        _FrameworkList(
          title: 'Management Approach',
          items: managementApproach,
          icon: Icons.healing_outlined,
          color: const Color(0xFF059669),
          isDark: isDark,
        ),
        const SizedBox(height: 8),
      ],
      if (escalationTriggers.isNotEmpty) ...[
        _FrameworkList(
          title: 'Escalation Triggers',
          items: escalationTriggers,
          icon: Icons.priority_high_rounded,
          color: AppColors.error,
          isDark: isDark,
        ),
        const SizedBox(height: 8),
      ],
      AppSpacing.gapSm,
    ];
  }

  void _openUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
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

// ── Block Header ──────────────────────────────────────────────────────────────

class _BlockHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color color;
  final bool isDark;

  const _BlockHeader({
    required this.icon,
    required this.title,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Icon(icon, size: 14, color: color),
        ),
        const SizedBox(width: 8),
        Text(
          title,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: color,
                fontSize: 13,
              ),
        ),
      ],
    );
  }
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

class _Card extends StatelessWidget {
  final Widget child;
  final bool isDark;

  const _Card({required this.child, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
      ),
      child: child,
    );
  }
}

// ── Bullet Point ──────────────────────────────────────────────────────────────

class _BulletPoint extends StatelessWidget {
  final String text;
  final bool isDark;

  const _BulletPoint({required this.text, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
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
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 13,
                height: 1.5,
                color: isDark
                    ? AppColors.darkTextPrimary
                    : AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Teaching Section Card ─────────────────────────────────────────────────────

class _TeachingSectionCard extends StatefulWidget {
  final Map<String, dynamic> section;
  final bool isDark;

  const _TeachingSectionCard({
    required this.section,
    required this.isDark,
  });

  @override
  State<_TeachingSectionCard> createState() => _TeachingSectionCardState();
}

class _TeachingSectionCardState extends State<_TeachingSectionCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final title = widget.section['title'] as String? ?? '';
    final content = (widget.section['content'] as String? ?? '').trim();
    final rawKeyPoints = widget.section['keyPoints'];
    final keyPoints = rawKeyPoints is List
        ? rawKeyPoints.whereType<String>().toList()
        : <String>[];

    return Container(
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
          GestureDetector(
            onTap: () => setState(() => _expanded = !_expanded),
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                    ),
                  ),
                  Icon(
                    _expanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    size: 18,
                    color: widget.isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary,
                  ),
                ],
              ),
            ),
          ),
          if (_expanded) ...[
            if (content.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                child: Text(
                  content,
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.6,
                    color: widget.isDark
                        ? AppColors.darkTextPrimary
                        : AppColors.textPrimary,
                  ),
                ),
              ),
            if (keyPoints.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Key Points',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: widget.isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    ...keyPoints.map((kp) => _BulletPoint(
                          text: kp,
                          isDark: widget.isDark,
                        )),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

// ── Warning Item ──────────────────────────────────────────────────────────────

class _WarningItem extends StatelessWidget {
  final String text;
  final Color color;
  final bool isDark;

  const _WarningItem({
    required this.text,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border(
          left: BorderSide(color: color, width: 3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            color == AppColors.error
                ? Icons.flag_rounded
                : Icons.warning_amber_rounded,
            size: 15,
            color: color,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 13,
                height: 1.5,
                color: isDark
                    ? AppColors.darkTextPrimary
                    : AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Framework List ────────────────────────────────────────────────────────────

class _FrameworkList extends StatelessWidget {
  final String title;
  final List<String> items;
  final IconData icon;
  final Color color;
  final bool isDark;

  const _FrameworkList({
    required this.title,
    required this.items,
    required this.icon,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
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
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 6),
              Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                  color: color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...items.asMap().entries.map((e) => Padding(
                padding: const EdgeInsets.only(bottom: 5),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 18,
                      height: 18,
                      margin: const EdgeInsets.only(top: 1),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Center(
                        child: Text(
                          '${e.key + 1}',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: color,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        e.value,
                        style: TextStyle(
                          fontSize: 13,
                          height: 1.5,
                          color: isDark
                              ? AppColors.darkTextPrimary
                              : AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }
}

// ── Guideline Card ────────────────────────────────────────────────────────────

class _GuidelineCard extends StatelessWidget {
  final Map<String, dynamic> guideline;
  final bool isDark;

  const _GuidelineCard({
    required this.guideline,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final title = guideline['title'] as String? ?? '';
    final source = guideline['source'] as String? ?? '';
    final year = guideline['year'];
    final keyChange = (guideline['keyChange'] as String? ?? '').trim();
    final practiceImpact =
        (guideline['practiceImpact'] as String? ?? '').trim();
    final strength = guideline['strength'] as String? ?? 'MODERATE';
    final url = guideline['url'] as String? ?? '';

    Color strengthColor;
    if (strength == 'HIGH') {
      strengthColor = AppColors.success;
    } else if (strength == 'EMERGING') {
      strengthColor = AppColors.warning;
    } else {
      strengthColor = AppColors.info;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
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
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: url.isNotEmpty
                      ? () async {
                          final uri = Uri.tryParse(url);
                          if (uri != null && await canLaunchUrl(uri)) {
                            await launchUrl(uri,
                                mode: LaunchMode.externalApplication);
                          }
                        }
                      : null,
                  child: Text(
                    title,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: url.isNotEmpty
                          ? AppColors.primary
                          : (isDark
                              ? AppColors.darkTextPrimary
                              : AppColors.textPrimary),
                      decoration:
                          url.isNotEmpty ? TextDecoration.underline : null,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: strengthColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  strength,
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: strengthColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              if (source.isNotEmpty) ...[
                Text(
                  source,
                  style: TextStyle(
                    fontSize: 11,
                    color: isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary,
                  ),
                ),
              ],
              if (source.isNotEmpty && year != null)
                Text(
                  ' | ',
                  style: TextStyle(
                    fontSize: 11,
                    color: isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary,
                  ),
                ),
              if (year != null)
                Text(
                  '$year',
                  style: TextStyle(
                    fontSize: 11,
                    color: isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary,
                  ),
                ),
            ],
          ),
          if (keyChange.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              keyChange,
              style: TextStyle(
                fontSize: 12,
                height: 1.5,
                color: isDark
                    ? AppColors.darkTextPrimary
                    : AppColors.textPrimary,
              ),
            ),
          ],
          if (practiceImpact.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Impact: $practiceImpact',
              style: TextStyle(
                fontSize: 11,
                fontStyle: FontStyle.italic,
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Loading Card ──────────────────────────────────────────────────────────────

class _LoadingCard extends StatefulWidget {
  final bool isDark;
  final String label;

  const _LoadingCard({required this.isDark, required this.label});

  @override
  State<_LoadingCard> createState() => _LoadingCardState();
}

class _LoadingCardState extends State<_LoadingCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: widget.isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(
            color: widget.isDark ? AppColors.darkBorder : AppColors.border,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FadeTransition(
              opacity: Tween<double>(begin: 0.4, end: 1.0).animate(_ctrl),
              child: Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [
                      AppColors.primary.withValues(alpha: 0.15),
                      AppColors.secondary.withValues(alpha: 0.10),
                    ],
                  ),
                ),
                child: const Icon(
                  Icons.auto_awesome_rounded,
                  color: AppColors.primary,
                  size: 28,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              widget.label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'This usually takes 10–20 seconds.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: widget.isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                    fontSize: 12,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: 160,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: const LinearProgressIndicator(
                  backgroundColor: Color(0x1A6366F1),
                  color: AppColors.primary,
                ),
              ),
            ),
            const SizedBox(height: 20),
            ...List.generate(
                4,
                (i) => Padding(
                      padding: EdgeInsets.only(
                          bottom: 10, right: i == 3 ? 80 : (i == 1 ? 40 : 0)),
                      child: FadeTransition(
                        opacity: Tween<double>(begin: 0.15, end: 0.35)
                            .animate(_ctrl),
                        child: Container(
                          height: 12,
                          decoration: BoxDecoration(
                            color: widget.isDark
                                ? AppColors.darkSurfaceVariant
                                : AppColors.surfaceVariant,
                            borderRadius: BorderRadius.circular(6),
                          ),
                        ),
                      ),
                    )),
          ],
        ),
      ),
    );
  }
}

/// Recursively cast nested Maps from Firebase callable responses.
Map<String, dynamic> _deepCastMap(Map map) {
  return map.map<String, dynamic>((key, value) {
    return MapEntry(key.toString(), _deepCastValue(value));
  });
}

dynamic _deepCastValue(dynamic value) {
  if (value is Map) return _deepCastMap(value);
  if (value is List) return value.map(_deepCastValue).toList();
  return value;
}
