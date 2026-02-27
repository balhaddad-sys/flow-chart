import 'package:flutter/material.dart';

import '../../../core/icons/medq_icons.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/premium_cards.dart';
import '../../../core/animations/animations.dart';

class ResultsScreen extends StatelessWidget {
  final int correct;
  final int total;
  final VoidCallback? onDone;

  const ResultsScreen({
    super.key,
    required this.correct,
    required this.total,
    this.onDone,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final ts = isDark ? AppColors.darkTextSecondary : AppColors.textSecondary;
    final pct = total > 0 ? (correct / total * 100).round() : 0;
    final progress = total > 0 ? correct / total : 0.0;

    final String scoreLabel = pct >= 80
        ? 'Excellent!'
        : pct >= 60
            ? 'Good effort!'
            : 'Keep practicing';

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              const SizedBox(height: 24),
              // Animated ring
              AnimatedProgressRing(
                progress: progress,
                size: 140,
                strokeWidth: 10,
                color: AppColors.teal500,
                backgroundColor: isDark ? const Color(0xFF292524) : const Color(0xFFE7E5E4),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    AnimatedCounter(
                      value: pct,
                      suffix: '%',
                      style: const TextStyle(
                          fontSize: 36,
                          fontWeight: FontWeight.w800,
                          color: AppColors.teal500),
                    ),
                    Text('Accuracy',
                        style: TextStyle(
                            fontSize: 10,
                            color: ts,
                            fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              // Title
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  MedQIcon(MedQIcons.trophy, size: 22, color: AppColors.teal500),
                  const SizedBox(width: 8),
                  Text(scoreLabel,
                      style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: AppColors.teal500)),
                ],
              ),
              const SizedBox(height: 6),
              Text('$correct out of $total correct',
                  style: TextStyle(fontSize: 14, color: ts)),
              const SizedBox(height: 24),
              // Stats row
              Row(
                children: [
                  _StatBox(
                      icon: MedQIcons.sparkles,
                      value: '$total',
                      label: 'Questions',
                      color: AppColors.teal500,
                      isDark: isDark),
                  const SizedBox(width: 10),
                  _StatBox(
                      icon: MedQIcons.checkCircle,
                      value: '$correct',
                      label: 'Correct',
                      color: AppColors.success,
                      isDark: isDark),
                  const SizedBox(width: 10),
                  _StatBox(
                      icon: MedQIcons.xCircle,
                      value: '${total - correct}',
                      label: 'Incorrect',
                      color: AppColors.error,
                      isDark: isDark),
                ],
              ),
              const SizedBox(height: 32),
              // Done button
              GestureDetector(
                onTap: onDone ?? () => Navigator.of(context).pop(),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    gradient: AppColors.primaryGradient,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: AppColors.primaryGradientShadow,
                  ),
                  child: const Text(
                    'Done',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 14),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final MedQIconData icon;
  final String value;
  final String label;
  final Color color;
  final bool isDark;

  const _StatBox(
      {required this.icon,
      required this.value,
      required this.label,
      required this.color,
      required this.isDark});

  @override
  Widget build(BuildContext context) {
    final ts = isDark ? AppColors.darkTextSecondary : AppColors.textSecondary;
    return Expanded(
      child: PremiumCard(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        child: Column(
          children: [
            MedQIcon(icon, size: 18, color: color),
            const SizedBox(height: 6),
            Text(value,
                style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: color)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 10, color: ts)),
          ],
        ),
      ),
    );
  }
}
