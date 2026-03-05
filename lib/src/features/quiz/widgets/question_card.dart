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
        // ── Type + metadata bar ─────────────────────────────────────
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: isDark
                  ? [
                      AppColors.primary.withValues(alpha: 0.12),
                      AppColors.accent.withValues(alpha: 0.06),
                    ]
                  : [
                      AppColors.primary.withValues(alpha: 0.08),
                      AppColors.accent.withValues(alpha: 0.04),
                    ],
            ),
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: Border.all(
              color: AppColors.primary.withValues(alpha: isDark ? 0.15 : 0.1),
            ),
          ),
          child: Row(
            children: [
              // SBA badge
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  question.type.isNotEmpty ? question.type : 'SBA',
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Difficulty
              _DifficultyBadge(difficulty: question.difficulty),
              const Spacer(),
              // Topic tag
              if (question.topicTags.isNotEmpty)
                Flexible(
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: isDark
                          ? AppColors.darkSurfaceVariant
                          : AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(6),
                    ),
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
                ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // ── Clinical vignette / stem ────────────────────────────────
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark
                ? AppColors.darkSurface
                : AppColors.surface,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: Border.all(
              color: isDark ? AppColors.darkBorder : AppColors.border,
            ),
            boxShadow: isDark ? null : AppSpacing.shadowSm,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // "Clinical Vignette" or "Question" label
              Row(
                children: [
                  Icon(
                    question.stem.length > 200
                        ? Icons.description_rounded
                        : Icons.help_outline_rounded,
                    size: 15,
                    color: isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    question.stem.length > 200
                        ? 'Clinical Vignette'
                        : 'Question Stem',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isDark
                          ? AppColors.darkTextTertiary
                          : AppColors.textTertiary,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                question.stem,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w500,
                      height: 1.6,
                      letterSpacing: 0.1,
                    ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // ── "Select the single best answer" instruction ─────────────
        if (!hasSubmitted)
          Padding(
            padding: const EdgeInsets.only(bottom: 12, left: 2),
            child: Text(
              'Select the single best answer:',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isDark
                    ? AppColors.darkTextTertiary
                    : AppColors.textTertiary,
                letterSpacing: 0.2,
              ),
            ),
          ),

        // ── Options ─────────────────────────────────────────────────
        ...List.generate(question.options.length, (i) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
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
