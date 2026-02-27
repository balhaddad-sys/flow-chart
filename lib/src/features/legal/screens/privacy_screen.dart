// FILE: lib/src/features/legal/screens/privacy_screen.dart

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/constants/app_links.dart';

// ── Privacy Policy Screen ──────────────────────────────────────────────────────

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  Future<void> _openEmail() async {
    final uri = Uri.parse('mailto:privacy@medq.app');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final bodyStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
          height: 1.7,
          color:
              isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
        );
    final headingStyle = Theme.of(context).textTheme.titleSmall?.copyWith(
          fontWeight: FontWeight.w700,
          color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
        );

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        title: const Text('Privacy Policy'),
        elevation: 0,
        scrolledUnderElevation: 1,
      ),
      body: ListView(
        padding: AppSpacing.screenPadding.copyWith(top: 16, bottom: 40),
        children: [
          // ── Page heading ────────────────────────────────────────────────
          Text(
            'Privacy Policy',
            style: Theme.of(context)
                .textTheme
                .headlineSmall
                ?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            'Last updated: February 2026',
            style: bodyStyle?.copyWith(fontSize: 12),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.25)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.shield_outlined,
                    size: 16, color: AppColors.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'We are committed to protecting your privacy. We do not sell your personal data.',
                    style: bodyStyle?.copyWith(
                      fontSize: 12,
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Sections ────────────────────────────────────────────────────
          _Section(
            heading: '1. Data We Collect',
            headingStyle: headingStyle,
            body: 'We collect the following categories of information:\n'
                '• Account information: name, email address, university or institution\n'
                '• Study materials you upload: documents, presentations, PDFs, and notes\n'
                '• Usage data: study sessions, quiz performance, feature usage patterns, streak data\n'
                '• Device information: device type, operating system, and app version\n'
                '• Authentication tokens managed securely by Firebase Authentication',
            bodyStyle: bodyStyle,
          ),
          _Section(
            heading: '2. How We Use Your Data',
            headingStyle: headingStyle,
            body: 'We use your information to:\n'
                '• Personalise your study experience, recommendations, and adaptive question scheduling\n'
                '• Generate AI-powered questions, explanations, and study materials from your uploads\n'
                '• Track your progress and provide performance analytics\n'
                '• Create and maintain your personalised study plan\n'
                '• Improve the Service, diagnose technical issues, and develop new features\n'
                '• Send important service notifications (not marketing without consent)',
            bodyStyle: bodyStyle,
          ),
          _Section(
            heading: '3. AI Processing',
            headingStyle: headingStyle,
            body:
                'MedQ uses AI services — including Google Gemini and Anthropic Claude — to process your uploaded materials and generate educational content. Your study materials are transmitted to these AI providers solely for the purpose of content generation on your behalf. We do not use your materials to train AI models. Data sent to AI providers is subject to their respective privacy policies.',
            bodyStyle: bodyStyle,
          ),
          _Section(
            heading: '4. Data Storage & Security',
            headingStyle: headingStyle,
            body:
                'Your data is stored securely on Google Firebase infrastructure (Firestore, Firebase Storage, Firebase Authentication). All data is encrypted at rest and in transit using industry-standard TLS/SSL. We implement access controls, audit logging, and follow Google Cloud security best practices to protect your information. Firebase infrastructure is ISO 27001 and SOC 2 Type II certified.',
            bodyStyle: bodyStyle,
          ),
          _Section(
            heading: '5. Data Sharing',
            headingStyle: headingStyle,
            body: 'We do not sell your personal data to third parties. Your information may be shared with:\n'
                '• AI service providers (Google, Anthropic) for content generation only, under strict data processing agreements\n'
                '• Study group members — only content you explicitly choose to share\n'
                '• Firebase/Google Cloud Platform, which hosts our infrastructure\n'
                '• Law enforcement or regulatory bodies if required by law\n\n'
                'We require all third-party processors to maintain adequate privacy and security standards.',
            bodyStyle: bodyStyle,
          ),
          _Section(
            heading: '6. Your Rights',
            headingStyle: headingStyle,
            body: 'You have the right to:\n'
                '• Access a copy of your personal data at any time\n'
                '• Request correction of inaccurate or incomplete information\n'
                '• Delete your account and all associated data (via Settings → Delete Account)\n'
                '• Export your study data in a portable format\n'
                '• Withdraw consent for optional data processing\n'
                '• Lodge a complaint with a data protection authority (UK ICO for UK residents)\n\n'
                'To exercise these rights, contact us at privacy@medq.app.',
            bodyStyle: bodyStyle,
          ),
          _Section(
            heading: '7. Third-Party Services',
            headingStyle: headingStyle,
            body:
                'MedQ integrates with the following third-party services:\n'
                '• Google Firebase (authentication, database, cloud functions, storage)\n'
                '• Google Gemini API (AI content generation)\n'
                '• Anthropic Claude API (AI content generation)\n\n'
                'Each provider has its own privacy policy. We encourage you to review them. Links:\n'
                '• Firebase: firebase.google.com/support/privacy\n'
                '• Google AI: ai.google.dev/terms\n'
                '• Anthropic: anthropic.com/privacy',
            bodyStyle: bodyStyle,
          ),
          _Section(
            heading: '8. Data Retention',
            headingStyle: headingStyle,
            body:
                'We retain your data for as long as your account is active. When you delete your account, all personal data — including uploaded materials, quiz history, and study plans — is permanently removed within 30 days. Anonymised, aggregated analytics data may be retained for service improvement purposes.',
            bodyStyle: bodyStyle,
          ),
          _Section(
            heading: '9. Cookies',
            headingStyle: headingStyle,
            body:
                'The MedQ mobile app does not use browser cookies. Firebase Authentication uses secure local storage tokens for session management. No third-party advertising or tracking cookies are used in the app.',
            bodyStyle: bodyStyle,
          ),
          _Section(
            heading: '10. Children\'s Privacy',
            headingStyle: headingStyle,
            body:
                'MedQ is intended for users aged 18 and over. We do not knowingly collect personal data from children under 18. If you believe a child has provided us with personal data, please contact us and we will delete it promptly.',
            bodyStyle: bodyStyle,
          ),
          _Section(
            heading: '11. Changes to This Policy',
            headingStyle: headingStyle,
            body:
                'We may update this Privacy Policy from time to time to reflect changes in our practices or legal obligations. We will notify you of significant changes through the Service or via email. Your continued use of MedQ after changes take effect constitutes acceptance of the updated policy.',
            bodyStyle: bodyStyle,
          ),
          _Section(
            heading: '12. Contact',
            headingStyle: headingStyle,
            body:
                'For privacy-related questions, data access requests, or complaints, contact our privacy team at privacy@medq.app.\n\nFor general support queries, contact ${AppLinks.supportEmail}.',
            bodyStyle: bodyStyle,
          ),

          const SizedBox(height: 8),

          // ── Email link ───────────────────────────────────────────────────
          Center(
            child: TextButton.icon(
              onPressed: _openEmail,
              icon: const Icon(Icons.mail_outline_rounded,
                  size: 16, color: AppColors.primary),
              label: const Text(
                'Contact Privacy Team',
                style: TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

// ── Section Widget ─────────────────────────────────────────────────────────────

class _Section extends StatelessWidget {
  final String heading;
  final TextStyle? headingStyle;
  final String body;
  final TextStyle? bodyStyle;

  const _Section({
    required this.heading,
    this.headingStyle,
    required this.body,
    this.bodyStyle,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(heading, style: headingStyle),
          const SizedBox(height: 6),
          Text(body.trim(), style: bodyStyle),
        ],
      ),
    );
  }
}
