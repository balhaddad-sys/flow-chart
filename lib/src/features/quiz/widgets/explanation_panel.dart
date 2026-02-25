import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../models/question_model.dart';

class ExplanationPanel extends StatefulWidget {
  final QuestionModel question;
  final int selectedIndex;
  final Map<String, dynamic>? tutorResponse;

  const ExplanationPanel({
    super.key,
    required this.question,
    required this.selectedIndex,
    this.tutorResponse,
  });

  @override
  State<ExplanationPanel> createState() => _ExplanationPanelState();
}

class _ExplanationPanelState extends State<ExplanationPanel> {
  // Track which follow-up answers are revealed
  final Set<int> _revealedFollowUps = {};

  @override
  Widget build(BuildContext context) {
    final safeCorrectIndex = widget.question.options.isNotEmpty
        ? widget.question.correctIndex.clamp(0, widget.question.options.length - 1)
        : 0;
    final isCorrect = widget.selectedIndex == safeCorrectIndex;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Extract AI tutor fields (question-specific, generated on wrong answer)
    final tutor = widget.tutorResponse;
    final String whyCorrect = (tutor?['whyCorrect'] as String? ?? '').trim().isNotEmpty
        ? tutor!['whyCorrect'] as String
        : widget.question.explanation.correctWhy;
    final String whyStudentWrong = (tutor?['whyStudentWrong'] as String? ?? '').trim().isNotEmpty
        ? tutor!['whyStudentWrong'] as String
        : (widget.selectedIndex < widget.question.explanation.whyOthersWrong.length
            ? widget.question.explanation.whyOthersWrong[widget.selectedIndex]
            : 'This option is incorrect.');
    final String keyTakeaway = (tutor?['keyTakeaway'] as String? ?? '').trim().isNotEmpty
        ? tutor!['keyTakeaway'] as String
        : widget.question.explanation.keyTakeaway;
    final List<Map<String, dynamic>> followUps = tutor != null && tutor['followUps'] is List
        ? List<Map<String, dynamic>>.from(
            (tutor['followUps'] as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)))
        : [];

    return Container(
      padding: AppSpacing.cardPaddingLg,
      decoration: BoxDecoration(
        color: isCorrect
            ? AppColors.successLight.withValues(alpha: isDark ? 0.1 : 0.5)
            : AppColors.errorLight.withValues(alpha: isDark ? 0.1 : 0.5),
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: isCorrect
              ? AppColors.success.withValues(alpha: isDark ? 0.2 : 0.15)
              : AppColors.error.withValues(alpha: isDark ? 0.2 : 0.15),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ──────────────────────────────────────────────────────
          Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: (isCorrect ? AppColors.success : AppColors.error)
                      .withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                ),
                child: Icon(
                  isCorrect ? Icons.check : Icons.close,
                  color: isCorrect ? AppColors.success : AppColors.error,
                  size: 16,
                ),
              ),
              AppSpacing.hGapSm,
              Text(
                isCorrect ? 'Correct!' : 'Incorrect',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: isCorrect ? AppColors.success : AppColors.error,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),

          // ── Why correct ──────────────────────────────────────────────────
          if (whyCorrect.isNotEmpty) ...[
            AppSpacing.gapMd,
            Text(
              widget.question.options.isNotEmpty
                  ? 'Why ${widget.question.options[safeCorrectIndex]} is correct:'
                  : 'Why the correct answer is right:',
              style: Theme.of(context).textTheme.labelLarge,
            ),
            AppSpacing.gapXs,
            Text(
              whyCorrect,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],

          // ── Why student was wrong (only when incorrect) ──────────────────
          if (!isCorrect && whyStudentWrong.isNotEmpty) ...[
            AppSpacing.gapMd,
            Text(
              'Why your answer was wrong:',
              style: Theme.of(context).textTheme.labelLarge,
            ),
            AppSpacing.gapXs,
            Text(
              whyStudentWrong,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],

          // ── Key takeaway ─────────────────────────────────────────────────
          if (keyTakeaway.isNotEmpty) ...[
            AppSpacing.gapMd,
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: AppColors.infoLight.withValues(alpha: isDark ? 0.1 : 0.5),
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: AppColors.info.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Icon(Icons.lightbulb_outline,
                        color: AppColors.info, size: 14),
                  ),
                  AppSpacing.hGapSm,
                  Expanded(
                    child: Text(
                      keyTakeaway,
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(color: AppColors.info),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // ── Follow-up questions (AI-generated, question-specific) ─────────
          if (!isCorrect && followUps.isNotEmpty) ...[
            AppSpacing.gapLg,
            Row(
              children: [
                const Icon(Icons.quiz_outlined,
                    size: 16, color: AppColors.primary),
                AppSpacing.hGapXs,
                Text(
                  'Test your understanding',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: AppColors.primary,
                      ),
                ),
              ],
            ),
            AppSpacing.gapSm,
            ...followUps.asMap().entries.map((entry) {
              final i = entry.key;
              final fu = entry.value;
              final q = (fu['q'] as String? ?? '').trim();
              final a = (fu['a'] as String? ?? '').trim();
              if (q.isEmpty) return const SizedBox.shrink();
              final isRevealed = _revealedFollowUps.contains(i);
              return Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: _FollowUpCard(
                  question: q,
                  answer: a,
                  isRevealed: isRevealed,
                  isDark: isDark,
                  onReveal: () => setState(() => _revealedFollowUps.add(i)),
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}

class _FollowUpCard extends StatelessWidget {
  final String question;
  final String answer;
  final bool isRevealed;
  final bool isDark;
  final VoidCallback onReveal;

  const _FollowUpCard({
    required this.question,
    required this.answer,
    required this.isRevealed,
    required this.isDark,
    required this.onReveal,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.darkSurfaceVariant.withValues(alpha: 0.6)
            : AppColors.surfaceVariant.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.15),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            question,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(fontWeight: FontWeight.w500),
          ),
          if (isRevealed && answer.isNotEmpty) ...[
            AppSpacing.gapXs,
            const Divider(height: 12),
            Text(
              answer,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.primary,
                  ),
            ),
          ] else if (!isRevealed) ...[
            AppSpacing.gapXs,
            GestureDetector(
              onTap: onReveal,
              child: Text(
                'Tap to reveal answer',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppColors.primary,
                      decoration: TextDecoration.underline,
                    ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
