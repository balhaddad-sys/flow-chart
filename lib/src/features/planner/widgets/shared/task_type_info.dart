import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';

class TaskTypeInfo {
  final IconData icon;
  final Color color;
  final String label;

  const TaskTypeInfo({
    required this.icon,
    required this.color,
    required this.label,
  });

  static TaskTypeInfo fromType(String type) {
    return switch (type) {
      'STUDY' => const TaskTypeInfo(
          icon: Icons.menu_book_rounded,
          color: AppColors.primary,
          label: 'Study',
        ),
      'QUESTIONS' => const TaskTypeInfo(
          icon: Icons.quiz_rounded,
          color: AppColors.secondary,
          label: 'Questions',
        ),
      'REVIEW' => const TaskTypeInfo(
          icon: Icons.refresh_rounded,
          color: AppColors.warning,
          label: 'Review',
        ),
      'MOCK' => const TaskTypeInfo(
          icon: Icons.assignment_rounded,
          color: AppColors.error,
          label: 'Mock Exam',
        ),
      _ => TaskTypeInfo(
          icon: Icons.task_rounded,
          color: AppColors.primary,
          label: type,
        ),
    };
  }
}
