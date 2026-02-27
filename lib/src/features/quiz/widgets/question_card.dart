import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/widgets/formatted_text.dart';
import '../../../models/question_model.dart';

/// Question card matching the web app's CardHeader layout:
///   1. Meta row: Q#/total + difficulty badge
///   2. Stem (hero text)
///   3. Topic tags (subtle, below stem)
class QuestionCard extends StatelessWidget {
  final QuestionModel question;
  final int currentIndex;
  final int totalQuestions;

  const QuestionCard({
    super.key,
    required this.question,
    required this.currentIndex,
    required this.totalQuestions,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Difficulty label matching web
    final diffLabel = question.difficulty <= 2
        ? 'Easy'
        : question.difficulty >= 4
            ? 'Hard'
            : 'Medium';
    final diffColor = question.difficulty <= 2
        ? (isDark ? const Color(0xFF4ADE80) : const Color(0xFF16A34A))
        : question.difficulty >= 4
            ? (isDark ? const Color(0xFFF87171) : const Color(0xFFDC2626))
            : (isDark ? const Color(0xFFFBBF24) : const Color(0xFFCA8A04));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Meta row ─────────────────────────────────────────────
        Row(
          children: [
            // Q number / total
            RichText(
              text: TextSpan(
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  fontFamily: 'monospace',
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                ),
                children: [
                  TextSpan(text: '${currentIndex + 1}'),
                  TextSpan(
                    text: '/$totalQuestions',
                    style: TextStyle(
                      color: isDark
                          ? AppColors.darkTextTertiary.withValues(alpha: 0.4)
                          : AppColors.textTertiary.withValues(alpha: 0.4),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // Difficulty badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: isDark
                    ? AppColors.darkSurfaceVariant
                    : AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                diffLabel,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: diffColor,
                ),
              ),
            ),
          ],
        ),

        // ── Stem (hero text) ─────────────────────────────────────
        const SizedBox(height: 16),
        FormattedText(
          text: question.stem,
          baseStyle: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w500,
            height: 1.6,
            letterSpacing: -0.01 * 17,
            color: isDark
                ? AppColors.darkTextPrimary
                : AppColors.textPrimary,
          ),
        ),

        // ── Topic tags (subtle, below stem) ──────────────────────
        if (question.topicTags.isNotEmpty) ...[
          const SizedBox(height: 10),
          Wrap(
            spacing: 4,
            runSpacing: 4,
            children: question.topicTags.take(3).map((tag) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.06)
                      : Colors.black.withValues(alpha: 0.04),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  tag,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ],
    );
  }
}
