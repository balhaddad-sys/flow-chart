// FILE: lib/src/features/home/screens/home_screen.dart

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/services/haptic_service.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/course_selector_sheet.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../models/course_model.dart';
import '../../home/providers/home_provider.dart';
import '../../library/providers/library_provider.dart';
import '../../practice/providers/practice_provider.dart';
import '../widgets/diagnostic_directives.dart';
import '../widgets/exam_countdown.dart';
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
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        ),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      ),
    );
  }

  Future<void> _seedSampleDeck() async {
    HapticService.medium();
    setState(() => _seedingDeck = true);
    try {
      final result =
          await ref.read(cloudFunctionsServiceProvider).seedSampleDeck();
      if (!mounted) return;
      if (result['alreadySeeded'] == true) {
        _showSnackBar('Sample deck is already in your account.');
      } else {
        setState(() => _deckSeeded = true);
        HapticService.success();
        final count = result['questionCount'] ?? 0;
        _showSnackBar(
          'Sample deck ready — $count high-yield questions loaded!',
          backgroundColor: AppColors.success,
        );
      }
    } catch (e) {
      HapticService.error();
      _showSnackBar(
        'Failed to load sample deck. Please try again.',
        backgroundColor: AppColors.error,
      );
    } finally {
      if (mounted) setState(() => _seedingDeck = false);
    }
  }

  Future<void> _runFixPlan(String courseId) async {
    setState(() => _fixingPlan = true);
    try {
      await ref
          .read(cloudFunctionsServiceProvider)
          .runFixPlan(courseId: courseId);
      _showSnackBar(
        'Remediation plan generated. Check your plan for updated tasks.',
        backgroundColor: AppColors.success,
      );
    } catch (e) {
      _showSnackBar(
        'Failed to generate remediation plan. Please try again.',
        backgroundColor: AppColors.error,
      );
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
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.background,
      body: coursesAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Error loading courses: $e',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.textSecondary,
              ),
            ),
          ),
        ),
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

          // ── Dynamic CTA state ──────────────────────────────────────────
          final filesAsync = ref.watch(filesProvider(activeCourseId));
          final sectionsAsync =
              ref.watch(courseSectionsProvider(activeCourseId));
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
            primaryLabel = 'View Plan';
            primaryIcon = Icons.calendar_month_rounded;
            primaryRoute = '/planner';
          } else {
            primaryLabel = 'Start Practising';
            primaryIcon = Icons.play_arrow_rounded;
            primaryRoute = '/practice';
          }

          return RefreshIndicator(
            color: AppColors.primary,
            backgroundColor:
                isDark ? AppColors.darkSurface : AppColors.surface,
            onRefresh: () async {
              ref.invalidate(todayTasksProvider(activeCourseId));
              ref.invalidate(filesProvider(activeCourseId));
              ref.invalidate(courseSectionsProvider(activeCourseId));
              ref.invalidate(courseStatsProvider(activeCourseId));
            },
            child: CustomScrollView(
              slivers: [
                // ── Gradient header ──────────────────────────────────────
                SliverToBoxAdapter(
                  child: GradientHeader(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Date line
                        Text(
                          _formattedDate(),
                          style:
                              Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: isDark
                                        ? AppColors.darkTextSecondary
                                        : AppColors.textSecondary,
                                    fontWeight: FontWeight.w500,
                                    letterSpacing: 0.2,
                                  ),
                        ),
                        const SizedBox(height: 4),

                        // Greeting + course title
                        userAsync.when(
                          data: (user) {
                            final name =
                                user?.name.split(' ').first ?? '';
                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
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
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
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

                        const SizedBox(height: 16),

                        // Action row: primary CTA + course switcher
                        Row(
                          children: [
                            ElevatedButton.icon(
                              onPressed: () => context.go(primaryRoute),
                              icon: Icon(primaryIcon, size: 16),
                              label: Text(primaryLabel),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shadowColor: Colors.transparent,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 11,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(
                                      AppSpacing.radiusMd),
                                ),
                                textStyle: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            _CourseSwitcherButton(isDark: isDark),
                          ],
                        ),

                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
                ),

                // ── Content area ─────────────────────────────────────────
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      // Exam countdown
                      if (activeCourse.examDate != null) ...[
                        ExamCountdown(examDate: activeCourse.examDate!),
                        AppSpacing.gapMd,
                      ],

                      // Sample deck CTA
                      if (showSampleDeckCTA) ...[
                        _SampleDeckCard(
                          isDark: isDark,
                          loading: _seedingDeck,
                          onTap: _seedSampleDeck,
                        ),
                        AppSpacing.gapMd,
                      ],

                      // Real exam bank card
                      if (isRealExam) ...[
                        _ExamBankCard(
                          examShortLabel: examShortLabel,
                          isDark: isDark,
                          onTap: () => context.go(
                              '/exam-bank?exam=${Uri.encodeComponent(examType)}'),
                        ),
                        AppSpacing.gapMd,
                      ],

                      // Pipeline progress (shown while processing)
                      PipelineProgress(courseId: activeCourseId),
                      AppSpacing.gapMd,

                      // Performance section
                      SectionLabel(
                        text: 'Performance',
                        actionText: 'Analytics',
                        onAction: () => context.go('/analytics'),
                      ),
                      const SizedBox(height: 10),
                      StatsCards(courseId: activeCourseId),
                      AppSpacing.gapMd,

                      // Today's plan section
                      SectionLabel(
                        text: "Today's Plan",
                        actionText: 'View all',
                        onAction: () => context.go('/planner'),
                      ),
                      const SizedBox(height: 10),
                      TodayChecklist(courseId: activeCourseId),
                      AppSpacing.gapMd,

                      // Weak areas
                      WeakTopicsBanner(courseId: activeCourseId),

                      // Remediation plan button
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
                                : const Icon(
                                    Icons.construction_rounded,
                                    size: 15,
                                  ),
                            label: Text(
                              _fixingPlan
                                  ? 'Generating...'
                                  : 'Remediation Plan',
                            ),
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
                                  const EdgeInsets.symmetric(vertical: 11),
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

                      // Streak graph
                      if (stats != null && stats.streakDays > 0) ...[
                        AppSpacing.gapMd,
                        StreakGraph(
                          streakDays: stats.streakDays,
                          isDark: isDark,
                        ),
                      ],

                      // AI diagnostic directives
                      if (stats != null &&
                          stats.diagnosticDirectives.isNotEmpty) ...[
                        AppSpacing.gapMd,
                        DiagnosticDirectives(
                          directives: stats.diagnosticDirectives,
                          isDark: isDark,
                        ),
                      ],

                      AppSpacing.gapXl,
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
      'Friday', 'Saturday', 'Sunday',
    ];
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return '${days[now.weekday - 1]}, ${months[now.month - 1]} ${now.day}';
  }
}

// ── Course switcher icon button ──────────────────────────────────────────────

class _CourseSwitcherButton extends StatelessWidget {
  final bool isDark;

  const _CourseSwitcherButton({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 38,
      width: 38,
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.darkSurfaceVariant.withValues(alpha: 0.6)
            : Colors.white.withValues(alpha: 0.85),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          onTap: () => CourseSelectorSheet.show(context),
          child: Icon(
            Icons.more_horiz_rounded,
            size: 18,
            color: isDark
                ? AppColors.darkTextSecondary
                : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}

// ── Sample deck CTA card ─────────────────────────────────────────────────────

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
          color: isDark
              ? AppColors.primary.withValues(alpha: 0.25)
              : AppColors.primary.withValues(alpha: 0.20),
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(11),
            ),
            child: const Icon(
              Icons.bolt_rounded,
              color: AppColors.primary,
              size: 22,
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
                const SizedBox(height: 3),
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
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              minimumSize: Size.zero,
              shape: RoundedRectangleBorder(
                borderRadius:
                    BorderRadius.circular(AppSpacing.radiusMd),
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
                      strokeWidth: 1.5,
                      color: Colors.white,
                    ),
                  )
                : const Text('Try Sample'),
          ),
        ],
      ),
    );
  }
}

// ── Exam bank card ───────────────────────────────────────────────────────────

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
          color: isDark
              ? const Color(0xFFD97706).withValues(alpha: 0.25)
              : AppColors.border,
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7),
              borderRadius: BorderRadius.circular(11),
            ),
            child: const Icon(
              Icons.emoji_events_rounded,
              color: Color(0xFFD97706),
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$examShortLabel Question Bank',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 3),
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
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              minimumSize: Size.zero,
              shape: RoundedRectangleBorder(
                borderRadius:
                    BorderRadius.circular(AppSpacing.radiusMd),
              ),
              textStyle: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Open Bank'),
                SizedBox(width: 3),
                Icon(Icons.chevron_right_rounded, size: 14),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
