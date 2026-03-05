import 'dart:async';
import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/widgets/primary_button.dart';

// ── Exam catalog ────────────────────────────────────────────────────────────

const _examOptions = [
  _ExamGroup('UK Licensing', Icons.local_hospital_rounded, Color(0xFF0D9488), [
    _ExamOption('PLAB1', 'PLAB 1', '180 SBAs · GMC', Icons.quiz_outlined),
    _ExamOption('PLAB2', 'PLAB 2', '18 stations · OSCE', Icons.people_outline_rounded),
  ]),
  _ExamGroup('UK Specialty', Icons.workspace_premium_rounded, Color(0xFF7C3AED), [
    _ExamOption('MRCP_PART1', 'MRCP Part 1', 'Best of Five · RCP', Icons.science_outlined),
    _ExamOption('MRCP_PACES', 'MRCP PACES', '5 stations · Clinical', Icons.medical_services_rounded),
    _ExamOption('MRCGP_AKT', 'MRCGP AKT', '200 MCQs · GP', Icons.health_and_safety_outlined),
  ]),
  _ExamGroup('International', Icons.public_rounded, Color(0xFF0891B2), [
    _ExamOption('USMLE_STEP1', 'USMLE Step 1', 'Basic science · NBME', Icons.biotech_outlined),
    _ExamOption('USMLE_STEP2', 'USMLE Step 2 CK', 'Clinical knowledge', Icons.medication_outlined),
  ]),
  _ExamGroup('University', Icons.school_rounded, Color(0xFFD97706), [
    _ExamOption('FINALS', 'Medical Finals', 'SBA + OSCE', Icons.assignment_outlined),
    _ExamOption('SBA', 'SBA Practice', 'General SBA', Icons.checklist_rounded),
    _ExamOption('OSCE', 'OSCE Practice', 'General OSCE', Icons.groups_outlined),
  ]),
];

// ── Main screen ─────────────────────────────────────────────────────────────

class ExamBankScreen extends ConsumerStatefulWidget {
  final String? examType;
  const ExamBankScreen({super.key, this.examType});

  @override
  ConsumerState<ExamBankScreen> createState() => _ExamBankScreenState();
}

class _AnswerRecord {
  final int selectedOption;
  final bool isCorrect;
  final int timeSpentSec;
  const _AnswerRecord({required this.selectedOption, required this.isCorrect, required this.timeSpentSec});
}

class _ExamBankScreenState extends ConsumerState<ExamBankScreen> with TickerProviderStateMixin {
  String? _selectedExam;
  String _selectedExamLabel = '';
  bool _loading = false;
  String? _error;
  List<Map<String, dynamic>> _questions = [];
  int _currentIndex = 0;
  int? _selectedOption;
  bool _revealed = false;
  bool _showDigDeeper = false;

  // Answer tracking
  final Map<int, _AnswerRecord> _answers = {};
  Set<String> _seenQuestionIds = {};

  // Progressive loading
  bool _isGeneratingMore = false;
  static const int _initialBatchSize = 3;
  static const int _backgroundBatchSize = 7;

  // Timer
  final Stopwatch _stopwatch = Stopwatch();
  Timer? _tickTimer;
  int _elapsedSeconds = 0;

  // Animations
  late AnimationController _questionAnimController;
  late Animation<double> _questionFadeIn;
  late Animation<Offset> _questionSlideIn;

  int get _correctCount => _answers.values.where((a) => a.isCorrect).length;
  int get _totalAnswered => _answers.length;

  @override
  void initState() {
    super.initState();
    _questionAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
    _questionFadeIn = CurvedAnimation(parent: _questionAnimController, curve: Curves.easeOut);
    _questionSlideIn = Tween<Offset>(begin: const Offset(0.03, 0), end: Offset.zero)
        .animate(CurvedAnimation(parent: _questionAnimController, curve: Curves.easeOutCubic));

    if (widget.examType != null) {
      _selectedExam = widget.examType;
      _selectedExamLabel = _findExamLabel(widget.examType!);
      _loadQuestions();
    }
  }

  @override
  void dispose() {
    _tickTimer?.cancel();
    _stopwatch.stop();
    _questionAnimController.dispose();
    super.dispose();
  }

  String _findExamLabel(String key) {
    for (final g in _examOptions) {
      for (final e in g.exams) {
        if (e.key == key) return e.label;
      }
    }
    return key;
  }

  void _startTimer() {
    _stopwatch..reset()..start();
    _elapsedSeconds = 0;
    _tickTimer?.cancel();
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _elapsedSeconds = _stopwatch.elapsed.inSeconds);
    });
  }

  void _stopTimer() {
    _stopwatch.stop();
    _tickTimer?.cancel();
  }

  void _animateQuestion() {
    _questionAnimController.reset();
    _questionAnimController.forward();
  }

  /// Minimum generation version required. Questions generated with an older
  /// version are auto-cleared so the user gets fresh evidence-based content.
  /// v2 = Claude-primary with evidence-based + recency mandates.
  static const int _requiredGenerationVersion = 2;

  // ── Load: saved questions first, then generate more ──

  Future<void> _loadQuestions({bool forceRefresh = false}) async {
    if (_selectedExam == null) return;
    setState(() {
      _loading = true;
      _error = null;
      _questions = [];
      _currentIndex = 0;
      _answers.clear();
      _seenQuestionIds.clear();
      _selectedOption = null;
      _revealed = false;
      _showDigDeeper = false;
      _isGeneratingMore = false;
    });

    try {
      final uid = ref.read(uidProvider);
      final firestore = ref.read(firestoreServiceProvider);

      // Auto-clear stale questions generated with old AI/prompts.
      // Wrapped in its own try/catch so a failure here doesn't block generation.
      if (uid != null) {
        try {
          if (forceRefresh) {
            await firestore.clearExamBankQuestions(uid, _selectedExam!);
          } else {
            final version = await firestore.getExamBankVersion(uid, _selectedExam!);
            if (version > 0 && version < _requiredGenerationVersion) {
              await firestore.clearExamBankQuestions(uid, _selectedExam!);
            }
          }
        } catch (_) {
          // Permission or network error clearing cache — continue anyway
        }
        if (!mounted) return;
      }

      List<Map<String, dynamic>> saved = [];
      if (uid != null && !forceRefresh) {
        saved = await firestore.getExamBankQuestions(uid, _selectedExam!);
      }

      if (!mounted) return;

      if (saved.isNotEmpty) {
        _seenQuestionIds = saved
            .map((q) => q['id']?.toString() ?? '')
            .where((id) => id.isNotEmpty)
            .toSet();

        Map<String, Map<String, dynamic>> progress = {};
        if (uid != null) {
          progress = await ref.read(firestoreServiceProvider)
              .getExamBankProgress(uid, _selectedExam!);
        }

        final Map<int, _AnswerRecord> restoredAnswers = {};
        for (var i = 0; i < saved.length; i++) {
          final qId = saved[i]['id']?.toString() ?? '';
          if (qId.isNotEmpty && progress.containsKey(qId)) {
            final p = progress[qId]!;
            restoredAnswers[i] = _AnswerRecord(
              selectedOption: (p['answerIndex'] as num?)?.toInt() ?? 0,
              isCorrect: p['isCorrect'] == true,
              timeSpentSec: (p['timeSpentSec'] as num?)?.toInt() ?? 0,
            );
          }
        }
        _answers.addAll(restoredAnswers);

        int startIndex = 0;
        for (var i = 0; i < saved.length; i++) {
          if (!restoredAnswers.containsKey(i)) {
            startIndex = i;
            break;
          }
          if (i == saved.length - 1) startIndex = saved.length - 1;
        }

        if (!mounted) return;
        setState(() { _questions = saved; _loading = false; });
        _goToQuestion(startIndex);
        _generateMoreInBackground();
      } else {
        final result = await ref.read(cloudFunctionsServiceProvider)
            .generateExamBankQuestions(examType: _selectedExam!, count: _initialBatchSize);
        final questions = (result['questions'] as List?)
                ?.whereType<Map>()
                .map((m) => _deepCastMap(m))
                .toList() ?? [];
        if (!mounted) return;
        _addNewQuestions(questions);
        setState(() => _loading = false);
        _startTimer();
        _animateQuestion();
        if (_questions.isNotEmpty) _generateMoreInBackground();
      }
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString();
      final userMsg = msg.contains('DEADLINE_EXCEEDED') || msg.contains('deadline-exceeded')
          ? 'Generation timed out. Please try again.'
          : msg.contains('AI_FAILED')
              ? 'AI could not generate questions right now. Please try again shortly.'
              : msg.contains('RATE_LIMIT')
                  ? 'Too many requests. Please wait a moment and try again.'
                  : 'Failed to load questions. Please try again.';
      setState(() { _error = userMsg; _loading = false; });
    }
  }

  void _addNewQuestions(List<Map<String, dynamic>> newQuestions) {
    final toAdd = <Map<String, dynamic>>[];
    for (final q in newQuestions) {
      final id = q['id']?.toString() ?? '';
      if (id.isEmpty || _seenQuestionIds.contains(id)) continue;
      _seenQuestionIds.add(id);
      toAdd.add(q);
    }
    if (toAdd.isNotEmpty) {
      setState(() => _questions = [..._questions, ...toAdd]);
    }
  }

  Future<void> _generateMoreInBackground() async {
    if (_selectedExam == null || _isGeneratingMore) return;
    setState(() => _isGeneratingMore = true);
    try {
      final result = await ref.read(cloudFunctionsServiceProvider)
          .generateExamBankQuestions(examType: _selectedExam!, count: _backgroundBatchSize);
      final moreQuestions = (result['questions'] as List?)
              ?.whereType<Map>()
              .map((m) => _deepCastMap(m))
              .toList() ?? [];
      if (!mounted) return;
      _addNewQuestions(moreQuestions);
      setState(() => _isGeneratingMore = false);
    } catch (_) {
      if (mounted) setState(() => _isGeneratingMore = false);
    }
  }

  void _maybeGenerateMore() {
    final unanswered = _questions.length - _answers.length;
    if (unanswered <= 2 && !_isGeneratingMore) {
      _generateMoreInBackground();
    }
  }

  void _selectExam(String key, String label) {
    setState(() {
      _selectedExam = key;
      _selectedExamLabel = label;
      _selectedOption = null;
      _revealed = false;
      _showDigDeeper = false;
    });
    _loadQuestions();
  }

  void _answer(int idx) {
    if (_revealed || _answers.containsKey(_currentIndex)) return;
    HapticFeedback.selectionClick();
    setState(() => _selectedOption = idx);
  }

  void _reveal() {
    if (_selectedOption == null || _answers.containsKey(_currentIndex)) return;
    _stopTimer();
    final q = _questions[_currentIndex];
    final correctIdx = (q['correctIndex'] as num?)?.toInt() ?? 0;
    final safeCorrect = (q['options'] as List?)?.isNotEmpty == true
        ? correctIdx.clamp(0, (q['options'] as List).length - 1)
        : 0;
    final isCorrect = _selectedOption == safeCorrect;
    HapticFeedback.mediumImpact();
    setState(() {
      _revealed = true;
      _answers[_currentIndex] = _AnswerRecord(
        selectedOption: _selectedOption!,
        isCorrect: isCorrect,
        timeSpentSec: _elapsedSeconds,
      );
    });
    _submitToLearningAlgorithm(q, _selectedOption!, safeCorrect, isCorrect);
    _saveProgress(q, _selectedOption!, isCorrect, _elapsedSeconds);
    _maybeGenerateMore();
  }

  Future<void> _submitToLearningAlgorithm(
    Map<String, dynamic> question, int answerIndex, int correctIndex, bool isCorrect,
  ) async {
    final questionId = question['id'] as String?;
    if (questionId == null || questionId.isEmpty) return;
    try {
      await ref.read(cloudFunctionsServiceProvider).submitAttempt(
        questionId: questionId,
        answerIndex: answerIndex,
        timeSpentSec: _elapsedSeconds,
      );
    } catch (e) {
      debugPrint('[ExamBank] submitAttempt failed: $e');
    }
  }

  Future<void> _saveProgress(
    Map<String, dynamic> question, int answerIndex, bool isCorrect, int timeSpentSec,
  ) async {
    final uid = ref.read(uidProvider);
    final questionId = question['id'] as String?;
    if (uid == null || questionId == null || questionId.isEmpty || _selectedExam == null) return;
    try {
      final progressMap = <String, Map<String, dynamic>>{};
      for (final entry in _answers.entries) {
        final qId = _questions[entry.key]['id']?.toString() ?? '';
        if (qId.isNotEmpty) {
          progressMap[qId] = {
            'answerIndex': entry.value.selectedOption,
            'isCorrect': entry.value.isCorrect,
            'timeSpentSec': entry.value.timeSpentSec,
          };
        }
      }
      await ref.read(firestoreServiceProvider)
          .saveExamBankProgress(uid, _selectedExam!, progressMap);
    } catch (e) {
      debugPrint('[ExamBank] saveProgress failed: $e');
    }
  }

  void _goToQuestion(int index) {
    if (index < 0 || index >= _questions.length) return;
    final wasAnswered = _answers.containsKey(index);
    setState(() {
      _currentIndex = index;
      _showDigDeeper = false;
      if (wasAnswered) {
        _selectedOption = _answers[index]!.selectedOption;
        _revealed = true;
        _stopTimer();
      } else {
        _selectedOption = null;
        _revealed = false;
        _startTimer();
      }
    });
    _animateQuestion();
  }

  void _next() {
    if (_currentIndex < _questions.length - 1) {
      _goToQuestion(_currentIndex + 1);
    }
  }

  void _prev() {
    if (_currentIndex > 0) {
      _goToQuestion(_currentIndex - 1);
    }
  }

  bool get _isLastLoadedQuestion => _currentIndex == _questions.length - 1;
  bool get _hasMoreComing => _isGeneratingMore;
  bool get _allDone => _answers.length == _questions.length && !_hasMoreComing;
  bool get _isCurrentAnswered => _answers.containsKey(_currentIndex);

  String _formatTime(int s) {
    final m = s ~/ 60;
    final sec = s % 60;
    if (m > 0) return '$m:${sec.toString().padLeft(2, '0')}';
    return '${sec}s';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
      body: _selectedExam == null || (_questions.isEmpty && !_loading && _error == null)
          ? _buildExamPicker(isDark)
          : _loading
              ? _buildLoading(isDark)
              : _error != null
                  ? _buildError(isDark)
                  : _questions.isEmpty
                      ? _buildEmpty(isDark)
                      : _allDone && !_revealed
                          ? _buildResults(isDark)
                          : _buildQuiz(isDark),
    );
  }

  // ── Exam Picker ─────────────────────────────────────────────────────────

  Widget _buildExamPicker(bool isDark) {
    return CustomScrollView(
      slivers: [
        // Hero header
        SliverToBoxAdapter(
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Back button row
                  Row(
                    children: [
                      GestureDetector(
                        onTap: () {
                          if (context.canPop()) context.pop(); else context.go('/today');
                        },
                        child: Container(
                          width: 40, height: 40,
                          decoration: BoxDecoration(
                            color: isDark ? AppColors.darkSurface : AppColors.surface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.border),
                          ),
                          child: Icon(Icons.arrow_back_rounded, size: 20,
                              color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Title section
                  Row(
                    children: [
                      Container(
                        width: 52, height: 52,
                        decoration: BoxDecoration(
                          gradient: AppColors.heroGradient,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.3),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: const Icon(Icons.school_rounded, color: Colors.white, size: 26),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Exam Bank',
                                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                    fontWeight: FontWeight.w800, letterSpacing: -0.5)),
                            const SizedBox(height: 4),
                            Text('AI-powered questions mapped to official exam blueprints',
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                                    height: 1.3)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 28),
                ],
              ),
            ),
          ),
        ),

        // Exam groups
        for (final group in _examOptions) ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 4, 24, 12),
              child: Row(
                children: [
                  Container(
                    width: 28, height: 28,
                    decoration: BoxDecoration(
                      color: group.color.withValues(alpha: isDark ? 0.15 : 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(group.icon, size: 14, color: group.color),
                  ),
                  const SizedBox(width: 10),
                  Text(group.group,
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                          color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary)),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.55,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final exam = group.exams[index];
                  return _ExamCard(
                    exam: exam,
                    groupColor: group.color,
                    isDark: isDark,
                    onTap: () => _selectExam(exam.key, exam.label),
                  );
                },
                childCount: group.exams.length,
              ),
            ),
          ),
        ],

        // Bottom spacing
        const SliverToBoxAdapter(child: SizedBox(height: 32)),
      ],
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────

  Widget _buildLoading(bool isDark) {
    return SafeArea(
      child: Column(
        children: [
          // Back button
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: IconButton(
                icon: const Icon(Icons.arrow_back_rounded, size: 22),
                onPressed: () {
                  setState(() {
                    _selectedExam = null;
                    _loading = false;
                    _questions = [];
                  });
                },
                visualDensity: VisualDensity.compact,
              ),
            ),
          ),
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 40),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Animated icon
                    TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.0, end: 1.0),
                duration: const Duration(milliseconds: 800),
                curve: Curves.easeOutBack,
                builder: (context, value, child) {
                  return Transform.scale(scale: value, child: child);
                },
                child: Container(
                  width: 80, height: 80,
                  decoration: BoxDecoration(
                    gradient: AppColors.heroGradient,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.3),
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.school_rounded, color: Colors.white, size: 36),
                ),
              ),
              const SizedBox(height: 32),

              Text(_selectedExamLabel,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800, letterSpacing: -0.3)),
              const SizedBox(height: 8),
              Text('Preparing your questions...',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary)),
              const SizedBox(height: 36),

              // Progress bar
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  color: AppColors.primary,
                  backgroundColor: isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
                  minHeight: 6,
                ),
              ),
              const SizedBox(height: 24),

              // Steps
              _LoadingStep(label: 'Loading saved progress', isActive: true, isDone: false, isDark: isDark),
              const SizedBox(height: 10),
              _LoadingStep(label: 'Generating new questions', isActive: false, isDone: false, isDark: isDark),
              const SizedBox(height: 10),
              _LoadingStep(label: 'Preparing your session', isActive: false, isDone: false, isDark: isDark),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────

  Widget _buildError(bool isDark) {
    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: IconButton(
                icon: const Icon(Icons.arrow_back_rounded, size: 22),
                onPressed: () {
                  setState(() {
                    _selectedExam = null;
                    _error = null;
                    _questions = [];
                  });
                },
                visualDensity: VisualDensity.compact,
              ),
            ),
          ),
          Expanded(
            child: Center(
              child: Padding(
                padding: AppSpacing.screenPadding,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 72, height: 72,
                      decoration: BoxDecoration(
                        color: AppColors.error.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 36),
                    ),
                    const SizedBox(height: 20),
                    Text('Something went wrong',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    Text(_error!,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
                        textAlign: TextAlign.center),
                    const SizedBox(height: 24),
                    SizedBox(width: 220, child: PrimaryButton(label: 'Try Again', onPressed: _loadQuestions, icon: Icons.refresh_rounded)),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => setState(() {
                        _selectedExam = null;
                        _error = null;
                        _questions = [];
                      }),
                      child: const Text('Choose different exam'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Empty ───────────────────────────────────────────────────────────────

  Widget _buildEmpty(bool isDark) {
    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: IconButton(
                icon: const Icon(Icons.arrow_back_rounded, size: 22),
                onPressed: () {
                  setState(() { _selectedExam = null; _questions = []; });
                },
                visualDensity: VisualDensity.compact,
              ),
            ),
          ),
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 72, height: 72,
                      decoration: BoxDecoration(
                        color: AppColors.warning.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: const Icon(Icons.quiz_outlined, color: AppColors.warning, size: 36),
                    ),
                    const SizedBox(height: 20),
                    Text('No questions generated',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    Text('The AI couldn\'t generate questions for this exam. Please try again.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
                        textAlign: TextAlign.center),
                    const SizedBox(height: 24),
                    SizedBox(width: 220, child: PrimaryButton(label: 'Retry', onPressed: _loadQuestions, icon: Icons.refresh_rounded)),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => setState(() { _selectedExam = null; _questions = []; }),
                      child: const Text('Choose different exam'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Quiz ────────────────────────────────────────────────────────────────

  Widget _buildQuiz(bool isDark) {
    if (_currentIndex >= _questions.length) return const SizedBox.shrink();
    final q = _questions[_currentIndex];
    final stem = (q['stem'] as String? ?? '').trim();
    final options = (q['options'] as List?)?.map((e) => e.toString()).toList() ?? [];
    final correctIdx = (q['correctIndex'] as num?)?.toInt() ?? 0;
    final safeCorrect = options.isNotEmpty ? correctIdx.clamp(0, options.length - 1) : 0;
    final difficulty = (q['difficulty'] as num?)?.toInt() ?? 3;
    final tags = (q['tags'] as List?)?.map((e) => e.toString()).toList() ?? [];
    final explanation = q['explanation'] is Map ? Map<String, dynamic>.from(q['explanation'] as Map) : <String, dynamic>{};
    final correctWhy = (explanation['correctWhy'] as String? ?? explanation['correct_why'] as String? ?? '').trim();
    final whyOthersWrong = (explanation['whyOthersWrong'] as List? ?? explanation['why_others_wrong'] as List? ?? [])
        .map((e) => e.toString()).toList();
    final keyTakeaway = (explanation['keyTakeaway'] as String? ?? explanation['key_takeaway'] as String? ?? '').trim();
    final citations = (q['citations'] as List? ?? []).whereType<Map>().map((c) => Map<String, dynamic>.from(c)).toList();

    final isCorrect = _revealed && _selectedOption == safeCorrect;
    final progress = _questions.isNotEmpty ? (_totalAnswered / _questions.length) : 0.0;
    final timerColor = _elapsedSeconds > 120 ? AppColors.error : _elapsedSeconds > 60 ? AppColors.warning : (isDark ? AppColors.darkTextSecondary : AppColors.textSecondary);

    return Column(
      children: [
        // ── Custom top bar ───────────────────────────────────────────
        SafeArea(
          bottom: false,
          child: Container(
            padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
            child: Column(
              children: [
                Row(
                  children: [
                    // Close
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 22),
                      onPressed: () {
                        if (context.canPop()) context.pop(); else context.go('/today');
                      },
                      visualDensity: VisualDensity.compact,
                    ),
                    const SizedBox(width: 4),
                    // Question number
                    Text(
                      'Q${_currentIndex + 1}',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800, fontSize: 18),
                    ),
                    Text(
                      ' / ${_questions.length}${_isGeneratingMore ? '+' : ''}',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500,
                          color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary),
                    ),
                    const Spacer(),
                    // Timer
                    if (!_isCurrentAnswered)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: timerColor.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.timer_outlined, size: 14, color: timerColor),
                            const SizedBox(width: 4),
                            Text(_formatTime(_elapsedSeconds),
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                                    fontFeatures: const [FontFeature.tabularFigures()], color: timerColor)),
                          ],
                        ),
                      ),
                    const SizedBox(width: 8),
                    // Score pill
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppColors.success.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.check_circle_rounded, color: AppColors.success, size: 14),
                          const SizedBox(width: 4),
                          Text('$_correctCount/$_totalAnswered',
                              style: const TextStyle(color: AppColors.success, fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  fontFeatures: [FontFeature.tabularFigures()])),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                // Progress bar
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: _isGeneratingMore && _totalAnswered == 0 ? null : progress.clamp(0.0, 1.0),
                    backgroundColor: isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
                    color: AppColors.primary,
                    minHeight: 3,
                  ),
                ),
              ],
            ),
          ),
        ),

        // ── Question content ──────────────────────────────────────────
        Expanded(
          child: SlideTransition(
            position: _questionSlideIn,
            child: FadeTransition(
              opacity: _questionFadeIn,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                children: [
                  // ── Metadata chips ──────────────────────────────────
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      _MetaChip(
                        label: _selectedExamLabel,
                        color: AppColors.secondary,
                        isDark: isDark,
                      ),
                      _DiffBadge(difficulty: difficulty),
                      if (tags.isNotEmpty)
                        _MetaChip(label: tags.first, color: AppColors.accent, isDark: isDark),
                      if (_isGeneratingMore)
                        _MetaChip(
                          label: 'Loading more...',
                          color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary,
                          isDark: isDark,
                          showSpinner: true,
                        ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // ── Stem ────────────────────────────────────────────
                  Text(stem,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          fontWeight: FontWeight.w500, height: 1.65, fontSize: 16)),
                  const SizedBox(height: 24),

                  // ── Options ─────────────────────────────────────────
                  for (int i = 0; i < options.length; i++) ...[
                    _OptionTile(
                      label: String.fromCharCode(65 + i),
                      text: options[i],
                      isSelected: _selectedOption == i,
                      isCorrect: _revealed && i == safeCorrect,
                      isWrong: _revealed && _selectedOption == i && i != safeCorrect,
                      isDimmed: _revealed && i != safeCorrect && _selectedOption != i,
                      isDark: isDark,
                      onTap: () => _answer(i),
                    ),
                    if (i < options.length - 1) const SizedBox(height: 10),
                  ],
                  const SizedBox(height: 20),

                  // ── Submit button ───────────────────────────────────
                  if (!_revealed)
                    PrimaryButton(
                      label: 'Check Answer',
                      onPressed: _selectedOption != null ? _reveal : null,
                      icon: Icons.check_rounded,
                    ),

                  // ── Post-reveal ─────────────────────────────────────
                  if (_revealed) ...[
                    // Result banner
                    _ResultBanner(isCorrect: isCorrect, isDark: isDark),
                    const SizedBox(height: 16),

                    // Explanation card
                    if (correctWhy.isNotEmpty)
                      _ExplanationCard(
                        correctWhy: correctWhy,
                        correctOption: options.isNotEmpty ? options[safeCorrect] : '',
                        wrongExplanation: (!isCorrect && _selectedOption != null && _selectedOption! < whyOthersWrong.length)
                            ? whyOthersWrong[_selectedOption!] : null,
                        keyTakeaway: keyTakeaway,
                        isDark: isDark,
                      ),

                    // Dig deeper
                    if (whyOthersWrong.length > 1) ...[
                      const SizedBox(height: 12),
                      _DigDeeperSection(
                        isExpanded: _showDigDeeper,
                        onToggle: () => setState(() => _showDigDeeper = !_showDigDeeper),
                        options: options,
                        whyOthersWrong: whyOthersWrong,
                        correctWhy: correctWhy,
                        safeCorrect: safeCorrect,
                        isDark: isDark,
                      ),
                    ],

                    // Citations
                    if (citations.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      _CitationsCard(citations: citations, isDark: isDark),
                    ],

                    const SizedBox(height: 20),

                    // Navigation
                    _buildNavButtons(isDark),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildNavButtons(bool isDark) {
    return Row(
      children: [
        if (_currentIndex > 0)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(right: 8),
              child: OutlinedButton.icon(
                onPressed: _prev,
                icon: const Icon(Icons.arrow_back_rounded, size: 16),
                label: const Text('Previous'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSpacing.radiusMd)),
                ),
              ),
            ),
          ),
        Expanded(
          flex: _currentIndex > 0 ? 2 : 1,
          child: _buildNextAction(isDark),
        ),
      ],
    );
  }

  Widget _buildNextAction(bool isDark) {
    if (!_isLastLoadedQuestion) {
      return PrimaryButton(
        label: 'Next Question',
        onPressed: _next,
        icon: Icons.arrow_forward_rounded,
      );
    }
    if (_hasMoreComing) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: isDark ? 0.08 : 0.05),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.15)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: 16, height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
            ),
            const SizedBox(width: 10),
            Text('More questions arriving...',
                style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600, fontSize: 14)),
          ],
        ),
      );
    }
    return PrimaryButton(
      label: 'View Results',
      onPressed: () => setState(() => _revealed = false),
      icon: Icons.bar_chart_rounded,
    );
  }

  // ── Results ─────────────────────────────────────────────────────────────

  Widget _buildResults(bool isDark) {
    final percent = _totalAnswered > 0 ? (_correctCount / _totalAnswered * 100).round() : 0;
    final (grade, gradeColor, label) = _gradeInfo(percent);
    final avgTime = _answers.isNotEmpty
        ? (_answers.values.map((a) => a.timeSpentSec).reduce((a, b) => a + b) / _answers.length).round()
        : 0;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        children: [
          // Close button
          Align(
            alignment: Alignment.centerLeft,
            child: GestureDetector(
              onTap: () {
                if (context.canPop()) context.pop(); else context.go('/today');
              },
              child: Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkSurface : AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.border),
                ),
                child: Icon(Icons.close_rounded, size: 20,
                    color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary),
              ),
            ),
          ),
          const SizedBox(height: 28),

          // Score circle
          Center(
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.0, end: percent / 100.0),
              duration: const Duration(milliseconds: 1200),
              curve: Curves.easeOutCubic,
              builder: (context, value, child) {
                return SizedBox(
                  width: 140, height: 140,
                  child: CustomPaint(
                    painter: _ScoreRingPainter(
                      progress: value,
                      color: gradeColor,
                      trackColor: isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
                    ),
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(grade,
                              style: TextStyle(fontSize: 36, fontWeight: FontWeight.w900, color: gradeColor, height: 1)),
                          const SizedBox(height: 2),
                          Text('${(value * 100).round()}%',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600,
                                  color: gradeColor.withValues(alpha: 0.7))),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 20),

          Center(
            child: Text(label,
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: gradeColor)),
          ),
          const SizedBox(height: 6),
          Center(
            child: Text('$_selectedExamLabel — $_correctCount of $_totalAnswered correct',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary)),
          ),
          const SizedBox(height: 28),

          // Stats cards
          Row(
            children: [
              Expanded(child: _StatCard(
                icon: Icons.check_circle_rounded, color: AppColors.success,
                value: '$_correctCount', label: 'Correct', isDark: isDark,
              )),
              const SizedBox(width: 10),
              Expanded(child: _StatCard(
                icon: Icons.cancel_rounded, color: AppColors.error,
                value: '${_totalAnswered - _correctCount}', label: 'Incorrect', isDark: isDark,
              )),
              const SizedBox(width: 10),
              Expanded(child: _StatCard(
                icon: Icons.timer_outlined, color: AppColors.accent,
                value: _formatTime(avgTime), label: 'Avg Time', isDark: isDark,
              )),
            ],
          ),
          const SizedBox(height: 28),

          // Action buttons
          PrimaryButton(
            label: 'Continue Practicing',
            onPressed: () {
              _generateMoreInBackground();
              for (int i = 0; i < _questions.length; i++) {
                if (!_answers.containsKey(i)) {
                  _goToQuestion(i);
                  return;
                }
              }
              _goToQuestion(_questions.length - 1);
            },
            icon: Icons.play_arrow_rounded,
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _loadQuestions(forceRefresh: true),
              icon: const Icon(Icons.auto_awesome_rounded, size: 16),
              label: const Text('Fresh Start'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.secondary,
                side: BorderSide(color: AppColors.secondary.withValues(alpha: 0.3)),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSpacing.radiusMd)),
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => setState(() {
                _selectedExam = null;
                _questions = [];
                _answers.clear();
                _seenQuestionIds.clear();
              }),
              icon: const Icon(Icons.swap_horiz_rounded, size: 18),
              label: const Text('Change Exam'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSpacing.radiusMd)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static (String, Color, String) _gradeInfo(int percent) {
    if (percent >= 90) return ('A+', AppColors.success, 'Outstanding!');
    if (percent >= 80) return ('A', AppColors.success, 'Excellent!');
    if (percent >= 70) return ('B', AppColors.primary, 'Well Done');
    if (percent >= 60) return ('C', AppColors.warning, 'Good Effort');
    if (percent >= 50) return ('D', AppColors.warning, 'Needs Work');
    return ('F', AppColors.error, 'Keep Studying');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper widgets
// ═══════════════════════════════════════════════════════════════════════════

class _ExamGroup {
  final String group;
  final IconData icon;
  final Color color;
  final List<_ExamOption> exams;
  const _ExamGroup(this.group, this.icon, this.color, this.exams);
}

class _ExamOption {
  final String key;
  final String label;
  final String badge;
  final IconData icon;
  const _ExamOption(this.key, this.label, this.badge, this.icon);
}

// ── Exam card (grid) ─────────────────────────────────────────────────────

class _ExamCard extends StatelessWidget {
  final _ExamOption exam;
  final Color groupColor;
  final bool isDark;
  final VoidCallback onTap;
  const _ExamCard({required this.exam, required this.groupColor, required this.isDark, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.border),
          boxShadow: isDark ? null : AppSpacing.shadowSm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                color: groupColor.withValues(alpha: isDark ? 0.15 : 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(exam.icon, size: 18, color: groupColor),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(exam.label,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700, fontSize: 14),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Text(exam.badge,
                    style: TextStyle(fontSize: 11,
                        color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Meta chip ────────────────────────────────────────────────────────────

class _MetaChip extends StatelessWidget {
  final String label;
  final Color color;
  final bool isDark;
  final bool showSpinner;
  const _MetaChip({required this.label, required this.color, required this.isDark, this.showSpinner = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.12 : 0.08),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showSpinner) ...[
            SizedBox(width: 10, height: 10,
                child: CircularProgressIndicator(strokeWidth: 1.5, color: color)),
            const SizedBox(width: 5),
          ],
          Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
        ],
      ),
    );
  }
}

// ── Difficulty badge ─────────────────────────────────────────────────────

class _DiffBadge extends StatelessWidget {
  final int difficulty;
  const _DiffBadge({required this.difficulty});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (difficulty) {
      <= 2 => ('Easy', AppColors.difficultyEasy),
      <= 3 => ('Medium', AppColors.difficultyMedium),
      _ => ('Hard', AppColors.difficultyHard),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.signal_cellular_alt_rounded, size: 11, color: color),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

// ── Option tile ──────────────────────────────────────────────────────────

class _OptionTile extends StatelessWidget {
  final String label;
  final String text;
  final bool isSelected;
  final bool isCorrect;
  final bool isWrong;
  final bool isDimmed;
  final bool isDark;
  final VoidCallback onTap;

  const _OptionTile({
    required this.label, required this.text, required this.isSelected,
    required this.isCorrect, required this.isWrong, this.isDimmed = false,
    required this.isDark, required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Color borderColor = isDark ? AppColors.darkBorder : AppColors.border;
    Color bgColor;
    Color labelBg;
    Color labelText;

    if (isCorrect) {
      borderColor = AppColors.success;
      bgColor = AppColors.success.withValues(alpha: isDark ? 0.08 : 0.04);
      labelBg = AppColors.success;
      labelText = Colors.white;
    } else if (isWrong) {
      borderColor = AppColors.error;
      bgColor = AppColors.error.withValues(alpha: isDark ? 0.08 : 0.04);
      labelBg = AppColors.error;
      labelText = Colors.white;
    } else if (isSelected) {
      borderColor = AppColors.primary;
      bgColor = AppColors.primary.withValues(alpha: isDark ? 0.08 : 0.04);
      labelBg = AppColors.primary;
      labelText = Colors.white;
    } else {
      bgColor = isDark ? AppColors.darkSurface : AppColors.surface;
      labelBg = isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant;
      labelText = isDark ? AppColors.darkTextSecondary : AppColors.textSecondary;
    }

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(color: borderColor, width: isSelected || isCorrect || isWrong ? 1.5 : 1),
        ),
        child: Opacity(
          opacity: isDimmed ? 0.4 : 1.0,
          child: Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 32, height: 32,
                decoration: BoxDecoration(
                  color: labelBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Center(child: Text(label,
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: labelText))),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(text,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                      decoration: isWrong ? TextDecoration.lineThrough : null,
                      decorationColor: AppColors.error.withValues(alpha: 0.4),
                      height: 1.45))),
              if (isCorrect)
                Container(width: 24, height: 24,
                    decoration: BoxDecoration(color: AppColors.success.withValues(alpha: 0.12), shape: BoxShape.circle),
                    child: const Icon(Icons.check_rounded, color: AppColors.success, size: 16)),
              if (isWrong)
                Container(width: 24, height: 24,
                    decoration: BoxDecoration(color: AppColors.error.withValues(alpha: 0.12), shape: BoxShape.circle),
                    child: const Icon(Icons.close_rounded, color: AppColors.error, size: 16)),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Result banner ────────────────────────────────────────────────────────

class _ResultBanner extends StatelessWidget {
  final bool isCorrect;
  final bool isDark;
  const _ResultBanner({required this.isCorrect, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final color = isCorrect ? AppColors.success : AppColors.error;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.1 : 0.06),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(isCorrect ? Icons.check_rounded : Icons.close_rounded,
                color: color, size: 18),
          ),
          const SizedBox(width: 12),
          Text(isCorrect ? 'Correct!' : 'Incorrect',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: color)),
        ],
      ),
    );
  }
}

// ── Explanation card ─────────────────────────────────────────────────────

class _ExplanationCard extends StatelessWidget {
  final String correctWhy;
  final String correctOption;
  final String? wrongExplanation;
  final String keyTakeaway;
  final bool isDark;

  const _ExplanationCard({
    required this.correctWhy, required this.correctOption,
    this.wrongExplanation, required this.keyTakeaway, required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Why correct
          Row(
            children: [
              Icon(Icons.lightbulb_rounded, size: 16, color: AppColors.success),
              const SizedBox(width: 8),
              Text('Why correct', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.success)),
            ],
          ),
          const SizedBox(height: 8),
          Text(correctWhy, style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.55)),

          // Why your answer was wrong
          if (wrongExplanation != null && wrongExplanation!.isNotEmpty) ...[
            const SizedBox(height: 16),
            Container(height: 1, color: isDark ? AppColors.darkBorder : AppColors.border),
            const SizedBox(height: 16),
            Row(
              children: [
                Icon(Icons.info_outline_rounded, size: 16, color: AppColors.error),
                const SizedBox(width: 8),
                Text('Why your answer was wrong',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.error)),
              ],
            ),
            const SizedBox(height: 8),
            Text(wrongExplanation!, style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.55)),
          ],

          // Key takeaway
          if (keyTakeaway.isNotEmpty) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: isDark ? 0.08 : 0.05),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.auto_awesome_rounded, size: 16, color: AppColors.primary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Key Takeaway',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary)),
                        const SizedBox(height: 4),
                        Text(keyTakeaway, style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.5)),
                      ],
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

// ── Dig deeper section ───────────────────────────────────────────────────

class _DigDeeperSection extends StatelessWidget {
  final bool isExpanded;
  final VoidCallback onToggle;
  final List<String> options;
  final List<String> whyOthersWrong;
  final String correctWhy;
  final int safeCorrect;
  final bool isDark;

  const _DigDeeperSection({
    required this.isExpanded, required this.onToggle, required this.options,
    required this.whyOthersWrong, required this.correctWhy,
    required this.safeCorrect, required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        GestureDetector(
          onTap: onToggle,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.secondary.withValues(alpha: isDark ? 0.08 : 0.05),
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              border: Border.all(color: AppColors.secondary.withValues(alpha: 0.15)),
            ),
            child: Row(
              children: [
                Icon(isExpanded ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                    size: 20, color: AppColors.secondary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    isExpanded ? 'Hide all options' : 'Why each option?',
                    style: const TextStyle(color: AppColors.secondary, fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.secondary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(5),
                  ),
                  child: Text('${options.length} options',
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.secondary)),
                ),
              ],
            ),
          ),
        ),
        if (isExpanded && whyOthersWrong.isNotEmpty)
          ...List.generate(
            math.min(options.length, whyOthersWrong.length),
            (i) => Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: i == safeCorrect
                      ? AppColors.success.withValues(alpha: isDark ? 0.06 : 0.04)
                      : isDark ? AppColors.darkSurface : AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: i == safeCorrect
                        ? AppColors.success.withValues(alpha: 0.2)
                        : isDark ? AppColors.darkBorder : AppColors.border,
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 26, height: 26,
                      decoration: BoxDecoration(
                        color: i == safeCorrect
                            ? AppColors.success.withValues(alpha: 0.15)
                            : isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
                        borderRadius: BorderRadius.circular(7),
                      ),
                      child: Center(
                        child: Text(String.fromCharCode(65 + i),
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                                color: i == safeCorrect ? AppColors.success
                                    : isDark ? AppColors.darkTextSecondary : AppColors.textSecondary)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(options[i], maxLines: 2, overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                                  color: i == safeCorrect ? AppColors.success : null)),
                          const SizedBox(height: 4),
                          Text(
                            i == safeCorrect ? (correctWhy.isNotEmpty ? correctWhy : 'This is the correct answer.') : whyOthersWrong[i],
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.5),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

// ── Citations card ───────────────────────────────────────────────────────

class _CitationsCard extends StatelessWidget {
  final List<Map<String, dynamic>> citations;
  final bool isDark;
  const _CitationsCard({required this.citations, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surfaceVariant.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.menu_book_rounded, size: 14,
                  color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary),
              const SizedBox(width: 6),
              Text('References',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                      color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary)),
            ],
          ),
          const SizedBox(height: 10),
          for (final c in citations)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: GestureDetector(
                onTap: () {
                  final url = c['url'] as String?;
                  if (url != null && url.isNotEmpty) {
                    launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
                  }
                },
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.accent.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(c['source']?.toString() ?? 'Ref',
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.accent)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(c['title']?.toString() ?? '',
                          maxLines: 2, overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12, color: AppColors.accent,
                              decoration: TextDecoration.underline,
                              decorationColor: AppColors.accent.withValues(alpha: 0.3))),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Stat card (results) ──────────────────────────────────────────────────

class _StatCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String value;
  final String label;
  final bool isDark;
  const _StatCard({required this.icon, required this.color, required this.value, required this.label, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.border),
      ),
      child: Column(
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 11,
              color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary)),
        ],
      ),
    );
  }
}

// ── Loading step ─────────────────────────────────────────────────────────

class _LoadingStep extends StatelessWidget {
  final String label;
  final bool isActive;
  final bool isDone;
  final bool isDark;
  const _LoadingStep({required this.label, required this.isActive, required this.isDone, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final color = isDone
        ? AppColors.success
        : isActive
            ? AppColors.primary
            : isDark ? AppColors.darkTextTertiary : AppColors.textTertiary;
    return Row(
      children: [
        Container(
          width: 24, height: 24,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color.withValues(alpha: isDone || isActive ? 0.12 : 0.06),
          ),
          child: isDone
              ? Icon(Icons.check_rounded, size: 14, color: color)
              : isActive
                  ? SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 1.5, color: color))
                  : Icon(Icons.circle, size: 6, color: color.withValues(alpha: 0.3)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                color: isDone || isActive ? color : (isDark ? AppColors.darkTextTertiary : AppColors.textTertiary),
              )),
        ),
      ],
    );
  }
}

// ── Score ring painter (results) ─────────────────────────────────────────

class _ScoreRingPainter extends CustomPainter {
  final double progress;
  final Color color;
  final Color trackColor;

  _ScoreRingPainter({required this.progress, required this.color, required this.trackColor});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 8;
    const strokeWidth = 8.0;

    // Track
    canvas.drawCircle(center, radius, Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth);

    // Progress arc
    final sweepAngle = 2 * math.pi * progress;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      sweepAngle,
      false,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_ScoreRingPainter oldDelegate) =>
      progress != oldDelegate.progress || color != oldDelegate.color;
}

// ── Deep cast helpers ────────────────────────────────────────────────────

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
