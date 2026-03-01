import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

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
  Map<String, dynamic>? _insightData;
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
      _insightData = null;
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
      setState(() => _insightData = result);
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
      _insightData = null;
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
          _quizQuestions = questions.cast<Map<String, dynamic>>());
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
                              _insightData = null;
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
          if (_insightData != null) ...[
            AppSpacing.gapLg,
            _TopicInsightView(
              data: _insightData!,
              topicLabel: _topicController.text.trim(),
              isDark: isDark,
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
        // ── Header ──
        _SectionHeader(
          icon: Icons.auto_stories_outlined,
          title: 'Teaching Outline',
          subtitle: levelLabel.isNotEmpty
              ? '$topicLabel ($levelLabel)'
              : topicLabel,
          isDark: isDark,
        ),
        AppSpacing.gapSm,

        // ── Summary ──
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

        // ── Core Points ──
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

        // ── Teaching Sections ──
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

        // ── Clinical Framework ──
        if (clinicalFramework.isNotEmpty) ...[
          ..._buildClinicalFramework(context, clinicalFramework),
        ],

        // ── Clinical Pitfalls ──
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

        // ── Red Flags ──
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

        // ── Study Approach ──
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

        // ── Guideline Updates ──
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

        // ── Citations ──
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
                          Icons.open_in_new_rounded,
                          size: 13,
                          color: url.isNotEmpty
                              ? AppColors.primary
                              : (isDark
                                  ? AppColors.darkTextTertiary
                                  : AppColors.textTertiary),
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
          // Header (tappable)
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

          // Expanded content
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

    // Safely extract explanation — backend returns a Map, not a String
    final rawExplanation = q['explanation'];
    String explanation = '';
    String? correctWhy;
    List<String> whyOthersWrong = [];
    if (rawExplanation is Map) {
      explanation = (rawExplanation['keyTakeaway'] as String? ?? '').trim();
      correctWhy = (rawExplanation['correctWhy'] as String? ?? '').trim();
      final rawOthers = rawExplanation['whyOthersWrong'];
      if (rawOthers is List) {
        whyOthersWrong = rawOthers.whereType<String>().toList();
      }
    } else if (rawExplanation is String) {
      explanation = rawExplanation.trim();
    }

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
          ] else ...[
            const SizedBox(height: 10),

            // Why correct answer is right
            if (correctWhy != null && correctWhy.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.06),
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusSm),
                  border: Border.all(
                    color: AppColors.success.withValues(alpha: 0.2),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.check_circle_outline_rounded,
                            size: 14, color: AppColors.success),
                        const SizedBox(width: 6),
                        Text(
                          'Why ${options.length > correctIndex ? options[correctIndex] : "correct"} is right',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.success,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      correctWhy,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            fontSize: 12,
                            height: 1.5,
                            color: widget.isDark
                                ? AppColors.darkTextPrimary
                                : AppColors.textPrimary,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],

            // Why selected wrong answer is wrong
            if (_selectedIndex != null &&
                _selectedIndex != correctIndex &&
                _selectedIndex! < whyOthersWrong.length &&
                whyOthersWrong[_selectedIndex!].isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.06),
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusSm),
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
                      whyOthersWrong[_selectedIndex!],
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            fontSize: 12,
                            height: 1.5,
                            color: widget.isDark
                                ? AppColors.darkTextPrimary
                                : AppColors.textPrimary,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],

            // Key takeaway
            if (explanation.isNotEmpty)
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
