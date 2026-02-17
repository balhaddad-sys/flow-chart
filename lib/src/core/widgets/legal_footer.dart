import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_links.dart';
import '../utils/external_link.dart';

/// Lightweight legal + safety footer for public/auth screens.
///
/// Keeps privacy/terms links visible before login and clearly states
/// educational-use-only medical safety language.
class LegalFooter extends StatelessWidget {
  final EdgeInsetsGeometry? padding;

  const LegalFooter({super.key, this.padding});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final secondary = isDark ? AppColors.darkTextSecondary : AppColors.textSecondary;
    final tertiary = isDark ? AppColors.darkTextTertiary : AppColors.textTertiary;

    return Padding(
      padding: padding ?? EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            'By continuing, you agree to our policies.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: secondary,
                ),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            alignment: WrapAlignment.center,
            children: [
              TextButton(
                onPressed: () => openExternalLink(
                  context,
                  AppLinks.termsOfServiceUrl,
                  label: 'Terms of Service',
                ),
                style: TextButton.styleFrom(
                  minimumSize: Size.zero,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('Terms'),
              ),
              TextButton(
                onPressed: () => openExternalLink(
                  context,
                  AppLinks.privacyPolicyUrl,
                  label: 'Privacy Policy',
                ),
                style: TextButton.styleFrom(
                  minimumSize: Size.zero,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('Privacy'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: isDark
                  ? AppColors.warning.withValues(alpha: 0.15)
                  : AppColors.warning.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: AppColors.warning.withValues(alpha: 0.35),
              ),
            ),
            child: Text(
              'MedQ is for education only and not a substitute for clinical judgment, diagnosis, or emergency care.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tertiary,
                    height: 1.35,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
