// FILE: lib/src/features/home/widgets/diagnostic_directives.dart

import 'package:flutter/material.dart';

import '../../../core/constants/app_spacing.dart';

/// Shows AI-generated diagnostic action items from the stats model.
class DiagnosticDirectives extends StatelessWidget {
  final List<String> directives;
  final bool isDark;

  const DiagnosticDirectives({
    super.key,
    required this.directives,
    required this.isDark,
  });

  // Purple scheme matching the web app's AI-driven sections
  static const Color _purple = Color(0xFF7C3AED);
  static const Color _purpleBgLight = Color(0xFFF5F3FF);
  static const Color _purpleBgDark = Color(0xFF2E1065);

  @override
  Widget build(BuildContext context) {
    if (directives.isEmpty) return const SizedBox.shrink();

    return Container(
      decoration: BoxDecoration(
        color: isDark
            ? _purpleBgDark.withValues(alpha: 0.40)
            : _purpleBgLight,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark
              ? _purple.withValues(alpha: 0.20)
              : _purple.withValues(alpha: 0.15),
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 13, 14, 11),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: _purple.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.auto_awesome_rounded,
                    size: 16,
                    color: _purple,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'AI Recommendations',
                        style:
                            Theme.of(context).textTheme.bodySmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                  color: isDark
                                      ? const Color(0xFFDDD6FE)
                                      : const Color(0xFF4C1D95),
                                ),
                      ),
                      Text(
                        'Based on your performance',
                        style:
                            Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: isDark
                                      ? _purple.withValues(alpha: 0.70)
                                      : const Color(0xFF6D28D9),
                                  fontSize: 11,
                                ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          Divider(
            height: 1,
            color: isDark
                ? _purple.withValues(alpha: 0.15)
                : _purple.withValues(alpha: 0.10),
          ),

          // Directive items
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: directives.asMap().entries.map((entry) {
                final index = entry.key;
                final directive = entry.value;
                final isLast = index == directives.length - 1;

                return Padding(
                  padding: EdgeInsets.only(bottom: isLast ? 0 : 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Bullet dot
                      Padding(
                        padding: const EdgeInsets.only(top: 5),
                        child: Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: _purple.withValues(alpha: 0.70),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      // Directive text
                      Expanded(
                        child: Text(
                          directive,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    fontSize: 13,
                                    height: 1.5,
                                    color: isDark
                                        ? const Color(0xFFDDD6FE)
                                            .withValues(alpha: 0.90)
                                        : const Color(0xFF3B0764),
                                  ),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}
