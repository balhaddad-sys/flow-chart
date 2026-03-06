import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../models/question_model.dart';
import 'option_button.dart';

class QuestionCard extends StatelessWidget {
  final QuestionModel question;
  final int? selectedIndex;
  final bool hasSubmitted;
  final void Function(int) onOptionSelected;
  final int questionNumber;
  final int totalQuestions;

  const QuestionCard({
    super.key,
    required this.question,
    this.selectedIndex,
    required this.hasSubmitted,
    required this.onOptionSelected,
    this.questionNumber = 0,
    this.totalQuestions = 0,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (question.options.isEmpty) {
      return Text(
        'No options available for this question.',
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppColors.textTertiary,
            ),
      );
    }

    final safeCorrectIndex =
        question.correctIndex.clamp(0, question.options.length - 1);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Type + metadata bar (compact) ──────────────────────────
        Row(
          children: [
            // SBA badge
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(5),
              ),
              child: Text(
                question.type.isNotEmpty ? question.type : 'SBA',
                style: const TextStyle(
                  color: AppColors.primary,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
            ),
            const SizedBox(width: 6),
            _DifficultyBadge(difficulty: question.difficulty),
            const Spacer(),
            if (question.topicTags.isNotEmpty)
              Flexible(
                child: Text(
                  question.topicTags.first,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
                ),
              ),
          ],
        ),

        const SizedBox(height: 6),

        // ── Clinical vignette / stem ────────────────────────────────
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: isDark
                ? AppColors.darkSurface
                : AppColors.surface,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: Border.all(
              color: isDark ? AppColors.darkBorder : AppColors.border,
            ),
          ),
          child: Text(
            question.stem,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w500,
                  height: 1.45,
                  fontSize: 13,
                ),
          ),
        ),

        const SizedBox(height: 8),

        // ── Options ─────────────────────────────────────────────────
        ...List.generate(question.options.length, (i) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: OptionButton(
              index: i,
              text: question.options[i],
              isSelected: selectedIndex == i,
              isCorrect: hasSubmitted ? i == safeCorrectIndex : null,
              hasSubmitted: hasSubmitted,
              onTap: () => onOptionSelected(i),
            ),
          );
        }),
      ],
    );
  }
}

class _DifficultyBadge extends StatelessWidget {
  final int difficulty;

  const _DifficultyBadge({required this.difficulty});

  @override
  Widget build(BuildContext context) {
    final (label, color, icon) = switch (difficulty) {
      <= 2 => ('Easy', AppColors.difficultyEasy, Icons.signal_cellular_alt_1_bar_rounded),
      <= 3 => ('Medium', AppColors.difficultyMedium, Icons.signal_cellular_alt_2_bar_rounded),
      _ => ('Hard', AppColors.difficultyHard, Icons.signal_cellular_alt_rounded),
    };

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
