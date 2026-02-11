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

  const QuestionCard({
    super.key,
    required this.question,
    this.selectedIndex,
    required this.hasSubmitted,
    required this.onOptionSelected,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          children: [
            _difficultyChip(question.difficulty),
            ...question.topicTags.take(2).map((tag) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.darkSurfaceVariant
                        : AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                  ),
                  child: Text(
                    tag,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.textSecondary,
                        ),
                  ),
                )),
          ],
        ),
        AppSpacing.gapMd,
        Text(
          question.stem,
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                fontWeight: FontWeight.w500,
                height: 1.5,
              ),
        ),
        AppSpacing.gapLg,
        ...List.generate(question.options.length, (i) {
          return Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: OptionButton(
              index: i,
              text: question.options[i],
              isSelected: selectedIndex == i,
              isCorrect: hasSubmitted ? i == question.correctIndex : null,
              hasSubmitted: hasSubmitted,
              onTap: () => onOptionSelected(i),
            ),
          );
        }),
      ],
    );
  }

  Widget _difficultyChip(int difficulty) {
    final label = difficulty <= 2
        ? 'Easy'
        : difficulty <= 3
            ? 'Medium'
            : 'Hard';
    final color = difficulty <= 2
        ? AppColors.difficultyEasy
        : difficulty <= 3
            ? AppColors.difficultyMedium
            : AppColors.difficultyHard;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
