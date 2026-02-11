import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';

/// Displays animated processing indicator with optional phase message.
///
/// Phases:
/// - EXTRACTING: Reading and parsing document
/// - ANALYZING: Generating AI blueprint
/// - GENERATING_QUESTIONS: Creating practice questions
class ProcessingIndicator extends StatelessWidget {
  final String? phase;
  final bool showLabel;

  const ProcessingIndicator({
    super.key,
    this.phase,
    this.showLabel = false,
  });

  String get _phaseLabel {
    switch (phase) {
      case 'EXTRACTING':
        return 'Extracting content...';
      case 'ANALYZING':
        return 'Analyzing content...';
      case 'GENERATING_QUESTIONS':
        return 'Generating questions...';
      default:
        return 'Processing...';
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!showLabel) {
      return const SizedBox(
        width: 20,
        height: 20,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: AppColors.primary,
        ),
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: AppColors.primary,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          _phaseLabel,
          style: const TextStyle(
            fontSize: 12,
            color: AppColors.textSecondary,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
