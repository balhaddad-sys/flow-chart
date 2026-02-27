// FILE: lib/src/features/quiz/widgets/explanation_panel.dart
import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../models/question_model.dart';

/// Collapsible explanation panel that auto-expands after the user answers.
///
/// Shows:
///   - Toggle header with correct / incorrect indicator + chevron
///   - "Why this is correct" block
///   - "Key Takeaway" block (teal left border)
///   - AI Tutor Help button + Flag icon button in footer
class ExplanationPanel extends StatefulWidget {
  final QuestionModel question;
  final int selectedIndex;
  final bool isCorrect;
  final Map<String, dynamic>? tutorResponse;
  final VoidCallback? onTutorHelp;
  final VoidCallback? onFlag;

  const ExplanationPanel({
    super.key,
    required this.question,
    required this.selectedIndex,
    required this.isCorrect,
    this.tutorResponse,
    this.onTutorHelp,
    this.onFlag,
  });

  @override
  State<ExplanationPanel> createState() => _ExplanationPanelState();
}

class _ExplanationPanelState extends State<ExplanationPanel> {
  // Auto-expand when first shown (user just answered)
  bool _expanded = true;
  bool _requestingTutor = false;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final explanation = widget.question.explanation;

    final Color headerAccent =
        widget.isCorrect ? const Color(0xFF10B981) : const Color(0xFFF59E0B);
    final Color headerBg = widget.isCorrect
        ? (isDark
            ? const Color(0xFF10B981).withValues(alpha: 0.08)
            : const Color(0xFFECFDF5))
        : (isDark
            ? const Color(0xFFF59E0B).withValues(alpha: 0.08)
            : const Color(0xFFFFFBEB));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Toggle header ─────────────────────────────────────────────────────
        GestureDetector(
          onTap: () => setState(() => _expanded = !_expanded),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              color: _expanded ? headerBg : (isDark ? AppColors.darkSurface : AppColors.surface),
              border: Border.all(
                color: _expanded
                    ? headerAccent.withValues(alpha: 0.35)
                    : (isDark ? AppColors.darkBorder : AppColors.border),
              ),
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            ),
            child: Row(
              children: [
                Icon(
                  widget.isCorrect
                      ? Icons.check_circle_rounded
                      : Icons.cancel_rounded,
                  size: 18,
                  color: headerAccent,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    widget.isCorrect ? 'Correct!' : 'Incorrect',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: headerAccent,
                    ),
                  ),
                ),
                Text(
                  _expanded ? 'Hide' : 'Show explanation',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
                ),
                const SizedBox(width: 4),
                AnimatedRotation(
                  turns: _expanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: Icon(
                    Icons.keyboard_arrow_down_rounded,
                    size: 18,
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),

        // ── Animated content ──────────────────────────────────────────────────
        AnimatedSize(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeInOut,
          child: _expanded
              ? _buildContent(context, explanation, isDark)
              : const SizedBox.shrink(),
        ),
      ],
    );
  }

  Widget _buildContent(
    BuildContext context,
    QuestionExplanation? explanation,
    bool isDark,
  ) {
    if (explanation == null) {
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Text(
          'No explanation available.',
          style: TextStyle(
            fontSize: 13,
            color:
                isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
          ),
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.darkSurface.withValues(alpha: 0.75)
            : AppColors.surface,
        border: Border.all(
          color: isDark
              ? AppColors.darkBorder.withValues(alpha: 0.7)
              : AppColors.border,
        ),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Why correct ────────────────────────────────────────────────────
          if (explanation.correctWhy.isNotEmpty) ...[
            _SectionLabel(
              label: 'WHY THIS IS CORRECT',
              color: isDark ? const Color(0xFF4ADE80) : const Color(0xFF16A34A),
            ),
            const SizedBox(height: 6),
            Text(
              explanation.correctWhy,
              style: TextStyle(
                fontSize: 14,
                height: 1.55,
                color: isDark
                    ? AppColors.darkTextPrimary.withValues(alpha: 0.9)
                    : AppColors.textPrimary.withValues(alpha: 0.9),
              ),
            ),
          ],

          // ── Why others wrong ───────────────────────────────────────────────
          if (explanation.whyOthersWrong.isNotEmpty) ...[
            const SizedBox(height: 16),
            _SectionLabel(
              label: 'WHY OTHER OPTIONS ARE INCORRECT',
              color: isDark
                  ? AppColors.darkTextSecondary
                  : AppColors.textSecondary,
            ),
            const SizedBox(height: 6),
            ...explanation.whyOthersWrong.map(
              (reason) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 5),
                      child: Text(
                        '–',
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.textSecondary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        reason,
                        style: TextStyle(
                          fontSize: 14,
                          height: 1.5,
                          color: isDark
                              ? AppColors.darkTextPrimary.withValues(alpha: 0.8)
                              : AppColors.textPrimary.withValues(alpha: 0.8),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],

          // ── Key takeaway ───────────────────────────────────────────────────
          if (explanation.keyTakeaway.isNotEmpty) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primary
                    .withValues(alpha: isDark ? 0.08 : 0.06),
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                border: Border(
                  left: BorderSide(
                    color: AppColors.primary.withValues(alpha: 0.6),
                    width: 3,
                  ),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: const Icon(
                      Icons.auto_awesome_rounded,
                      size: 15,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const _SectionLabel(
                          label: 'KEY TAKEAWAY',
                          color: AppColors.primary,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          explanation.keyTakeaway,
                          style: TextStyle(
                            fontSize: 14,
                            height: 1.55,
                            color: isDark
                                ? AppColors.darkTextPrimary
                                : AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],

          // ── Footer actions ─────────────────────────────────────────────────
          const SizedBox(height: 16),
          Row(
            children: [
              // AI Tutor Help
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _requestingTutor
                      ? null
                      : () async {
                          setState(() => _requestingTutor = true);
                          try {
                            await Future.microtask(
                                () => widget.onTutorHelp?.call());
                          } finally {
                            if (mounted) {
                              setState(() => _requestingTutor = false);
                            }
                          }
                        },
                  icon: _requestingTutor
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 1.5,
                            color: AppColors.secondary,
                          ),
                        )
                      : const Icon(Icons.auto_awesome_rounded, size: 14),
                  label: Text(
                    _requestingTutor ? 'Loading...' : 'AI Tutor Help',
                    style: const TextStyle(fontSize: 12),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.secondary,
                    side: BorderSide(
                        color: AppColors.secondary.withValues(alpha: 0.4)),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 8),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                    textStyle: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w500),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Flag button
              IconButton(
                onPressed: widget.onFlag,
                icon: const Icon(Icons.flag_outlined),
                iconSize: 20,
                tooltip: 'Flag question',
                style: IconButton.styleFrom(
                  foregroundColor: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                  padding: const EdgeInsets.all(8),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Section label ─────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String label;
  final Color color;

  const _SectionLabel({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
        color: color,
      ),
    );
  }
}
