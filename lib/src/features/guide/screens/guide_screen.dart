// FILE: lib/src/features/guide/screens/guide_screen.dart

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_links.dart';

// ── Guide Screen ───────────────────────────────────────────────────────────────

class GuideScreen extends StatelessWidget {
  const GuideScreen({super.key});

  Future<void> _openEmail() async {
    final uri = Uri.parse(AppLinks.supportMailto);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        title: const Text('How MedQ Works'),
        elevation: 0,
        scrolledUnderElevation: 1,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          // ── Intro ────────────────────────────────────────────────────────
          Text(
            'Everything you need to ace your medical exams, powered by AI.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                  height: 1.55,
                ),
          ),
          AppSpacing.gapLg,

          // ── Sections ─────────────────────────────────────────────────────
          _GuideSection(
            icon: Icons.cloud_upload_outlined,
            iconColor: AppColors.primary,
            title: 'Upload Your Materials',
            body:
                'Add your PDFs, Word documents, PowerPoint slides, and lecture notes to a course. MedQ automatically extracts the content and organises it into study-ready sections — no manual effort needed.',
            isDark: isDark,
          ),
          _GuideSection(
            icon: Icons.auto_awesome_rounded,
            iconColor: AppColors.secondary,
            title: 'AI Analyses Your Content',
            body:
                'Our AI reads through your uploaded materials, identifies key topics, creates structured sections, and generates clinically relevant practice questions. The more you upload, the richer your question bank becomes.',
            isDark: isDark,
          ),
          _GuideSection(
            icon: Icons.quiz_outlined,
            iconColor: AppColors.success,
            title: 'Adaptive Quizzing',
            body:
                'MedQ uses a spaced repetition algorithm (FSRS v5) that adapts to your performance. Questions you find difficult appear more frequently; ones you\'ve mastered are shown less often. Tap any answer to reveal a detailed AI explanation.',
            isDark: isDark,
          ),
          _GuideSection(
            icon: Icons.bar_chart_rounded,
            iconColor: AppColors.accent,
            title: 'Track Your Progress',
            body:
                'The Analytics screen shows your overall accuracy, daily streaks, and topic-level breakdowns. Weak areas are highlighted so you know exactly where to focus. The Weakness Dashboard gives you a prioritised remediation plan.',
            isDark: isDark,
          ),
          _GuideSection(
            icon: Icons.calendar_today_outlined,
            iconColor: AppColors.warning,
            title: 'Personalised Study Plan',
            body:
                'Set your exam date and tell MedQ how many hours a day you can study. The AI generates a day-by-day planner that covers all your material before the deadline, automatically rescheduling when life gets in the way.',
            isDark: isDark,
          ),
          _GuideSection(
            icon: Icons.auto_awesome_mosaic_outlined,
            iconColor: AppColors.purple,
            title: 'AI Chat Assistant',
            body:
                'Open any conversation on the AI tab to ask anything related to your course material. The assistant has full context of your active course, so it can answer questions, explain concepts, and walk through clinical scenarios tailored to your syllabus.',
            isDark: isDark,
          ),
          _GuideSection(
            icon: Icons.explore_outlined,
            iconColor: AppColors.primaryLight,
            title: 'Explore Any Topic',
            body:
                'Not sure where to start? Visit AI → Explore to type any medical topic and instantly receive a structured teaching outline or a 5-question quiz. Select your level (Medical Student → Registrar) and exam type for tailored content.',
            isDark: isDark,
          ),
          AppSpacing.gapLg,

          // ── Divider ──────────────────────────────────────────────────────
          Divider(
            color: isDark ? AppColors.darkBorder : AppColors.border,
            thickness: 1,
          ),
          AppSpacing.gapLg,

          // ── Footer ───────────────────────────────────────────────────────
          Center(
            child: Column(
              children: [
                Text(
                  'Questions? We\'re happy to help.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                AppSpacing.gapSm,
                TextButton.icon(
                  onPressed: _openEmail,
                  icon: const Icon(Icons.mail_outline_rounded,
                      size: 16, color: AppColors.primary),
                  label: const Text(
                    'Contact Support',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Guide Section Widget ───────────────────────────────────────────────────────

class _GuideSection extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String body;
  final bool isDark;

  const _GuideSection({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.body,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icon circle
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              border: Border.all(
                color: iconColor.withValues(alpha: 0.25),
              ),
            ),
            child: Icon(icon, size: 24, color: iconColor),
          ),
          const SizedBox(width: 14),

          // Text
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style:
                      Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                            height: 1.3,
                          ),
                ),
                const SizedBox(height: 5),
                Text(
                  body,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                        height: 1.6,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
