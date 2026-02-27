import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/widgets/course_selector_sheet.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../models/course_model.dart';
import '../../home/providers/home_provider.dart';
import '../../library/providers/library_provider.dart';
import '../../practice/providers/practice_provider.dart';
import '../widgets/exam_countdown.dart';
import '../widgets/diagnostic_directives.dart';
import '../widgets/pipeline_progress.dart';
import '../widgets/stats_cards.dart';
import '../widgets/streak_graph.dart';
import '../widgets/today_checklist.dart';
import '../widgets/weak_topics_banner.dart';

// Real exam types — matches web app REAL_EXAM_TYPES set
const _realExamTypes = {
  'PLAB1', 'PLAB2', 'MRCP_PART1', 'MRCP_PACES',
  'MRCGP_AKT', 'USMLE_STEP1', 'USMLE_STEP2', 'FINALS',
};

const _examShortLabels = {
  'PLAB1': 'PLAB 1',
  'PLAB2': 'PLAB 2',
  'MRCP_PART1': 'MRCP Part 1',
  'MRCP_PACES': 'MRCP PACES',
  'MRCGP_AKT': 'MRCGP AKT',
  'USMLE_STEP1': 'USMLE Step 1',
  'USMLE_STEP2': 'USMLE Step 2',
  'FINALS': 'Finals',
};

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  bool _seedingDeck = false;
  bool _deckSeeded = false;
  bool _fixingPlan = false;

  void _showSnackBar(String message, {Color? backgroundColor}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        backgroundColor: backgroundColor,
      ),
    );
  }

  Future<void> _seedSampleDeck() async {
    setState(() => _seedingDeck = true);
    try {
      final result = await ref.read(cloudFunctionsServiceProvider).seedSampleDeck();
      if (!mounted) return;
      if (result['alreadySeeded'] == true) {
        _showSnackBar('Sample deck is already in your account.');
      } else {
        setState(() => _deckSeeded = true);
        final count = result['questionCount'] ?? 0;
        _showSnackBar('Sample deck ready — $count high-yield questions loaded!', backgroundColor: const Color(0xFF059669));
      }
    } catch (e) {
      _showSnackBar('Failed to load sample deck. Please try again.', backgroundColor: const Color(0xFFDC2626));
    } finally {
      if (mounted) setState(() => _seedingDeck = false);
    }
  }

  Future<void> _runFixPlan(String courseId) async {
    setState(() => _fixingPlan = true);
    try {
      await ref.read(cloudFunctionsServiceProvider).runFixPlan(courseId: courseId);
      _showSnackBar('Remediation plan generated. Check your plan for updated tasks.', backgroundColor: const Color(0xFF059669));
    } catch (e) {
      _showSnackBar('Failed to generate remediation plan. Please try again.', backgroundColor: const Color(0xFFDC2626));
    } finally {
      if (mounted) setState(() => _fixingPlan = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final coursesAsync = ref.watch(coursesProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final userAsync = ref.watch(userModelProvider);

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
      body: coursesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (courses) {
          if (courses.isEmpty) {
            return EmptyState(
              icon: Icons.school_outlined,
              title: 'No courses yet',
              subtitle: 'Create a course to start studying',
              actionLabel: 'Get Started',
              onAction: () => context.go('/onboarding'),
            );
          }

          final storedId = ref.watch(activeCourseIdProvider);
          final activeCourse = storedId != null
              ? courses.cast<CourseModel?>().firstWhere(
                    (c) => c!.id == storedId,
                    orElse: () => null,
                  ) ??
                  courses.first
              : courses.first;
          final activeCourseId = activeCourse.id;

          WidgetsBinding.instance.addPostFrameCallback((_) {
            final current = ref.read(activeCourseIdProvider);
            if (current != activeCourseId) {
              ref.read(activeCourseIdProvider.notifier).state = activeCourseId;
            }
          });

          final examType = activeCourse.examType ?? '';
          final isRealExam = _realExamTypes.contains(examType);
          final examShortLabel = _examShortLabels[examType] ?? examType;

          // ── Dynamic CTA state ─────────────────────────────────────
          final filesAsync = ref.watch(filesProvider(activeCourseId));
          final sectionsAsync = ref.watch(courseSectionsProvider(activeCourseId));
          final statsAsync = ref.watch(courseStatsProvider(activeCourseId));
          final tasksAsync = ref.watch(todayTasksProvider(activeCourseId));

          final hasFiles = filesAsync.valueOrNull?.isNotEmpty ?? false;
          final hasSections = sectionsAsync.valueOrNull
                  ?.any((s) => s.aiStatus == 'ANALYZED') ??
              false;
          final tasks = tasksAsync.valueOrNull ?? [];
          final stats = statsAsync.valueOrNull;
          final hasPlan =
              tasks.isNotEmpty || (stats?.completionPercent ?? 0) > 0;
          final weakTopics = stats?.weakestTopics ?? [];
          final showSampleDeckCTA = !hasFiles && !_deckSeeded;

          // Determine primary CTA
          final String primaryLabel;
          final IconData primaryIcon;
          final String primaryRoute;
          if (!hasFiles) {
            primaryLabel = 'Upload Materials';
            primaryIcon = Icons.upload_file_rounded;
            primaryRoute = '/library';
          } else if (!hasSections) {
            primaryLabel = 'View Library';
            primaryIcon = Icons.auto_stories_rounded;
            primaryRoute = '/library';
          } else if (!hasPlan) {
            primaryLabel = 'Generate Plan';
            primaryIcon = Icons.calendar_month_rounded;
            primaryRoute = '/planner';
          } else {
            primaryLabel = 'Start Quiz';
            primaryIcon = Icons.quiz_outlined;
            primaryRoute = '/quiz/_all';
          }

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async {
              ref.invalidate(todayTasksProvider(activeCourseId));
              ref.invalidate(filesProvider(activeCourseId));
              ref.invalidate(courseSectionsProvider(activeCourseId));
            },
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: SafeArea(
                    bottom: false,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // ── Date ──────────────────────────────────────────
                          Text(
                            _formattedDate(),
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(
                                  color: isDark
                                      ? AppColors.darkTextSecondary
                                      : AppColors.textSecondary,
                                  fontWeight: FontWeight.w500,
                                  letterSpacing: 0.2,
                                ),
                          ),
                          const SizedBox(height: 4),

                          // ── Greeting ───────────────────────────────────────
                          userAsync.when(
                            data: (user) {
                              final name =
                                  user?.name.split(' ').first ?? '';
                              return Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${_greeting()}${name.isNotEmpty ? ', $name' : ''}',
                                    style: Theme.of(context)
                                        .textTheme
                                        .headlineMedium
                                        ?.copyWith(
                                          fontWeight: FontWeight.w700,
                                          letterSpacing: -0.5,
                                        ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    activeCourse.title,
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall
                                        ?.copyWith(
                                          color: isDark
                                              ? AppColors.darkTextSecondary
                                              : AppColors.textSecondary,
                                          fontSize: 13,
                                        ),
                                  ),
                                ],
                              );
                            },
                            loading: () => Text(
                              _greeting(),
                              style: Theme.of(context)
                                  .textTheme
                                  .headlineMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            error: (_, __) => Text(
                              _greeting(),
                              style: Theme.of(context)
                                  .textTheme
                                  .headlineMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                          ),

                          const SizedBox(height: 14),

                          // ── Action row ─────────────────────────────────────
                          Row(
                            children: [
                              ElevatedButton.icon(
                                onPressed: () =>
                                    context.go(primaryRoute),
                                icon: Icon(primaryIcon, size: 16),
                                label: Text(primaryLabel),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.primary,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 16, vertical: 10),
                                  shape: RoundedRectangleBorder(
                                    borderRadius:
                                        BorderRadius.circular(
                                            AppSpacing.radiusMd),
                                  ),
                                  textStyle: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                height: 36,
                                width: 36,
                                decoration: BoxDecoration(
                                  border: Border.all(
                                    color: isDark
                                        ? AppColors.darkBorder
                                        : AppColors.border,
                                  ),
                                  borderRadius:
                                      BorderRadius.circular(
                                          AppSpacing.radiusMd),
                                ),
                                child: InkWell(
                                  borderRadius:
                                      BorderRadius.circular(
                                          AppSpacing.radiusMd),
                                  onTap: () => CourseSelectorSheet.show(
                                      context),
                                  child: Icon(
                                    Icons.more_horiz_rounded,
                                    size: 18,
                                    color: isDark
                                        ? AppColors.darkTextSecondary
                                        : AppColors.textSecondary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                        ],
                      ),
                    ),
                  ),
                ),

                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      // ── Exam countdown ────────────────────────────────────
                      if (activeCourse.examDate != null) ...[
                        ExamCountdown(examDate: activeCourse.examDate!),
                        AppSpacing.gapMd,
                      ],

                      // ── Sample Deck CTA ───────────────────────────────────
                      if (showSampleDeckCTA) ...[
                        _SampleDeckCard(
                          isDark: isDark,
                          loading: _seedingDeck,
                          onTap: _seedSampleDeck,
                        ),
                        AppSpacing.gapMd,
                      ],

                      // ── Exam bank card ────────────────────────────────────
                      if (isRealExam) ...[
                        _ExamBankCard(
                          examShortLabel: examShortLabel,
                          isDark: isDark,
                          onTap: () => context.go('/exam-bank?exam=${Uri.encodeComponent(examType)}'),
                        ),
                        AppSpacing.gapMd,
                      ],

                      // ── Pipeline Progress ─────────────────────────────────
                      PipelineProgress(courseId: activeCourseId),
                      AppSpacing.gapMd,

                      // ── Performance ───────────────────────────────────────
                      Row(
                        children: [
                          Text(
                            'PERFORMANCE',
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(
                                  color: isDark
                                      ? AppColors.darkTextSecondary
                                      : AppColors.textSecondary,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 1.0,
                                  fontSize: 11,
                                ),
                          ),
                          const Spacer(),
                          GestureDetector(
                            onTap: () => context.go('/analytics'),
                            child: Text(
                              'View analytics',
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(
                                    color: AppColors.primary,
                                    fontWeight: FontWeight.w500,
                                    fontSize: 12,
                                  ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      StatsCards(courseId: activeCourseId),
                      AppSpacing.gapMd,

                      // ── Today's Plan ──────────────────────────────────────
                      Row(
                        children: [
                          Text(
                            'Today\'s Plan',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const Spacer(),
                          GestureDetector(
                            onTap: () => context.go('/planner'),
                            child: Text(
                              'View all',
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(
                                    color: AppColors.primary,
                                    fontWeight: FontWeight.w500,
                                    fontSize: 12,
                                  ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      TodayChecklist(courseId: activeCourseId),
                      AppSpacing.gapMd,

                      // ── Weak Areas ────────────────────────────────────────
                      WeakTopicsBanner(courseId: activeCourseId),

                      // ── Remediation Plan button ───────────────────────────
                      if (weakTopics.isNotEmpty) ...[
                        AppSpacing.gapSm,
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: _fixingPlan
                                ? null
                                : () => _runFixPlan(activeCourseId),
                            icon: _fixingPlan
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 1.5,
                                      color: AppColors.primary,
                                    ),
                                  )
                                : const Icon(Icons.build_outlined,
                                    size: 14),
                            label: Text(_fixingPlan
                                ? 'Generating...'
                                : 'Remediation Plan'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: isDark
                                  ? AppColors.darkTextPrimary
                                  : AppColors.textPrimary,
                              side: BorderSide(
                                color: isDark
                                    ? AppColors.darkBorder
                                    : AppColors.border,
                              ),
                              padding:
                                  const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(
                                    AppSpacing.radiusMd),
                              ),
                              textStyle: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ),
                      ],

                      // ── Streak graph ──────────────────────────────────
                      if (stats != null && (stats.streakDays) > 0) ...[
                        AppSpacing.gapMd,
                        StreakGraph(streakDays: stats.streakDays, isDark: isDark),
                      ],

                      // ── Diagnostic directives ──────────────────────────
                      if (stats != null && stats.diagnosticDirectives.isNotEmpty) ...[
                        AppSpacing.gapMd,
                        DiagnosticDirectives(
                          directives: stats.diagnosticDirectives,
                          isDark: isDark,
                        ),
                      ],

                      AppSpacing.gapLg,
                    ]),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  String _formattedDate() {
    final now = DateTime.now();
    const days = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday',
      'Friday', 'Saturday', 'Sunday'
    ];
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return '${days[now.weekday - 1]}, ${months[now.month - 1]} ${now.day}';
  }
}

// ── Sample Deck Card ──────────────────────────────────────────────────────────

class _SampleDeckCard extends StatelessWidget {
  final bool isDark;
  final bool loading;
  final VoidCallback onTap;

  const _SampleDeckCard({
    required this.isDark,
    required this.loading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
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
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.bolt_rounded,
              color: AppColors.primary,
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Try a Sample High-Yield Deck',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  '10 pre-authored Cardiology & Pharmacology SBAs.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                        fontSize: 11,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          ElevatedButton(
            onPressed: loading ? null : onTap,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 0,
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              minimumSize: Size.zero,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              ),
              textStyle: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            child: loading
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                        strokeWidth: 1.5, color: Colors.white),
                  )
                : const Text('Try Sample'),
          ),
        ],
      ),
    );
  }
}

// ── Exam bank card ────────────────────────────────────────────────────────────

class _ExamBankCard extends StatelessWidget {
  final String examShortLabel;
  final bool isDark;
  final VoidCallback onTap;

  const _ExamBankCard({
    required this.examShortLabel,
    required this.isDark,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 4,
                  offset: const Offset(0, 1),
                ),
              ],
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.emoji_events_rounded,
              color: Color(0xFFD97706),
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$examShortLabel Question Bank',
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  'Practise with exam-specific questions and track weak topics.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                        fontSize: 12,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          ElevatedButton(
            onPressed: onTap,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 0,
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              minimumSize: Size.zero,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              ),
              textStyle: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: const [
                Text('Open Bank'),
                SizedBox(width: 4),
                Icon(Icons.chevron_right_rounded, size: 14),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
