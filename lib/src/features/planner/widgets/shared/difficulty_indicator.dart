import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';

class DifficultyIndicator extends StatelessWidget {
  final int difficulty;
  final bool compact;

  const DifficultyIndicator({
    super.key,
    required this.difficulty,
    this.compact = true,
  });

  @override
  Widget build(BuildContext context) {
    final (color, label) = _info;

    if (compact) {
      return Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.4),
              blurRadius: 4,
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  (Color, String) get _info {
    if (difficulty <= 2) {
      return (AppColors.difficultyEasy, 'Easy');
    } else if (difficulty <= 3) {
      return (AppColors.difficultyMedium, 'Medium');
    } else {
      return (AppColors.difficultyHard, 'Hard');
    }
  }
}
