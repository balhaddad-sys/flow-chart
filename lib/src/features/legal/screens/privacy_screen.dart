import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bodyStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
          height: 1.6,
          color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
        );
    final headingStyle = Theme.of(context).textTheme.titleSmall?.copyWith(
          fontWeight: FontWeight.w700,
        );

    return Scaffold(
      appBar: AppBar(title: const Text('Privacy Policy')),
      body: ListView(
        padding: AppSpacing.screenPadding,
        children: [
          Text(
            'Privacy Policy',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text('Last updated: February 2026', style: bodyStyle?.copyWith(fontSize: 12)),
          const SizedBox(height: 20),

          _Section(heading: '1. Information We Collect', headingStyle: headingStyle, body: '''
We collect the following types of information:
• Account information (name, email, university/institution)
• Study materials you upload (documents, presentations, notes)
• Usage data (study sessions, quiz performance, feature usage)
• Device information (device type, operating system, app version)''', bodyStyle: bodyStyle),

          _Section(heading: '2. How We Use Your Information', headingStyle: headingStyle, body: '''
We use your information to:
• Personalise your study experience and recommendations
• Generate AI-powered questions and study materials from your uploads
• Track your progress and provide performance analytics
• Improve the Service and develop new features''', bodyStyle: bodyStyle),

          _Section(heading: '3. AI Processing', headingStyle: headingStyle, body: '''
MedQ uses AI services (Google Gemini and Anthropic Claude) to process your uploaded materials and generate educational content. Your study materials are sent to these AI providers solely for content generation purposes. We do not use your materials to train AI models.''', bodyStyle: bodyStyle),

          _Section(heading: '4. Data Storage & Security', headingStyle: headingStyle, body: '''
Your data is stored securely on Google Firebase infrastructure with encryption at rest and in transit. We implement industry-standard security measures to protect your information.''', bodyStyle: bodyStyle),

          _Section(heading: '5. Data Sharing', headingStyle: headingStyle, body: '''
We do not sell your personal data. Your information may be shared with:
• AI service providers (for content generation only)
• Study group members (only content you explicitly share)
• Service providers who help us operate the platform''', bodyStyle: bodyStyle),

          _Section(heading: '6. Your Rights', headingStyle: headingStyle, body: '''
You have the right to:
• Access your personal data
• Delete your account and all associated data
• Correct inaccurate information
• Export your study data''', bodyStyle: bodyStyle),

          _Section(heading: '7. Cookies', headingStyle: headingStyle, body: '''
MedQ uses essential cookies only for authentication and session management. We do not use third-party tracking cookies.''', bodyStyle: bodyStyle),

          _Section(heading: '8. Changes to This Policy', headingStyle: headingStyle, body: '''
We may update this Privacy Policy from time to time. We will notify you of significant changes through the Service or via email.''', bodyStyle: bodyStyle),

          _Section(heading: '9. Contact', headingStyle: headingStyle, body: '''
For privacy-related questions, contact us at privacy@medq.app.''', bodyStyle: bodyStyle),

          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

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
      padding: const EdgeInsets.only(bottom: 20),
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
