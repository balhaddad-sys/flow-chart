import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';

/// 6-step interactive walkthrough matching the web app's /guide page.
class GuideScreen extends StatefulWidget {
  const GuideScreen({super.key});

  @override
  State<GuideScreen> createState() => _GuideScreenState();
}

class _GuideScreenState extends State<GuideScreen> {
  int _step = 0;

  static const _steps = [
    _Step(
      icon: Icons.waving_hand_rounded,
      color: AppColors.primary,
      title: 'Welcome to MedQ',
      subtitle: 'Your AI-powered medical study companion. Let\'s walk through the key features.',
    ),
    _Step(
      icon: Icons.cloud_upload_outlined,
      color: AppColors.accent,
      title: 'Upload Your Materials',
      subtitle: 'Upload PDFs, Word docs, or PowerPoint slides. Our AI will analyse them and generate study content automatically.',
    ),
    _Step(
      icon: Icons.calendar_today_outlined,
      color: AppColors.secondary,
      title: 'Generate a Study Plan',
      subtitle: 'Set your exam date and availability. MedQ will create a personalised daily study schedule that adapts to your progress.',
    ),
    _Step(
      icon: Icons.quiz_outlined,
      color: AppColors.success,
      title: 'Practise with AI Questions',
      subtitle: 'Take quizzes generated from your materials. Get instant feedback, detailed explanations, and AI tutor help.',
    ),
    _Step(
      icon: Icons.explore_outlined,
      color: AppColors.warning,
      title: 'Explore Any Topic',
      subtitle: 'Search any medical topic and get AI-generated teaching outlines, visual aids, and quick quizzes.',
    ),
    _Step(
      icon: Icons.emoji_events_rounded,
      color: AppColors.primary,
      title: 'You\'re All Set!',
      subtitle: 'Start uploading your study materials and let MedQ guide your preparation. Good luck with your exams!',
    ),
  ];

  void _next() {
    if (_step < _steps.length - 1) {
      setState(() => _step++);
    } else {
      context.go('/today');
    }
  }

  void _back() {
    if (_step > 0) setState(() => _step--);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final step = _steps[_step];
    final isLast = _step == _steps.length - 1;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
        title: const Text('Getting Started'),
        leading: _step > 0
            ? IconButton(icon: const Icon(Icons.arrow_back_rounded), onPressed: _back)
            : null,
        actions: [
          TextButton(
            onPressed: () => context.go('/today'),
            child: const Text('Skip'),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
          child: Column(
            children: [
              const Spacer(flex: 1),

              // Progress dots
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(_steps.length, (i) {
                  final active = i == _step;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: active ? 24 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: active
                          ? AppColors.primary
                          : (isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant),
                      borderRadius: BorderRadius.circular(99),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 40),

              // Icon
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                child: Container(
                  key: ValueKey(_step),
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: step.color.withValues(alpha: 0.12),
                    border: Border.all(color: step.color.withValues(alpha: 0.3), width: 2),
                  ),
                  child: Icon(step.icon, size: 44, color: step.color),
                ),
              ),
              const SizedBox(height: 28),

              // Title
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: Text(
                  step.title,
                  key: ValueKey('title-$_step'),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(height: 12),

              // Subtitle
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: Text(
                  step.subtitle,
                  key: ValueKey('sub-$_step'),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                      height: 1.55),
                ),
              ),

              const Spacer(flex: 2),

              // Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _next,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isLast ? AppColors.success : AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppSpacing.radiusMd)),
                    textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  child: Text(isLast ? 'Get Started' : 'Next'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Step {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  const _Step({required this.icon, required this.color, required this.title, required this.subtitle});
}
