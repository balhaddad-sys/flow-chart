import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../models/question_model.dart';

/// Bottom sheet drawer showing source citations for a question.
/// Matches the web app's source-citation-drawer.
class SourceCitationDrawer extends StatelessWidget {
  final QuestionModel question;

  const SourceCitationDrawer({super.key, required this.question});

  static Future<void> show(BuildContext context, {required QuestionModel question}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.55,
        maxChildSize: 0.85,
        minChildSize: 0.3,
        expand: false,
        builder: (_, controller) =>
            _DrawerBody(question: question, controller: controller),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

class _DrawerBody extends StatelessWidget {
  final QuestionModel question;
  final ScrollController controller;

  const _DrawerBody({required this.question, required this.controller});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasSources = question.sourceCitations.isNotEmpty;
    final hasCitations = question.citations.isNotEmpty;

    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      children: [
        // Drag handle
        Center(
          child: Container(
            width: 36, height: 4,
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(99)),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Container(
              width: 32, height: 32,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.source_outlined, size: 16, color: AppColors.primary),
            ),
            const SizedBox(width: 10),
            Text('Source References',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
          ],
        ),
        const SizedBox(height: 6),
        Text('Evidence from your uploaded materials that supports this question.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                fontSize: 12)),
        const SizedBox(height: 16),

        // Source file info
        if (question.sourceRef.fileId.isNotEmpty) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
            ),
            child: Row(
              children: [
                const Icon(Icons.description_outlined, size: 16, color: AppColors.textSecondary),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(question.sourceRef.fileName ?? question.sourceRef.label,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      if (question.sourceRef.label.isNotEmpty &&
                          question.sourceRef.fileName != null)
                        Text(question.sourceRef.label,
                            style: TextStyle(fontSize: 11,
                                color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],

        // Chunk-level source citations
        if (hasSources) ...[
          Text('EXTRACTED PASSAGES', style: Theme.of(context).textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w600, letterSpacing: 1.0, fontSize: 10,
              color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary)),
          const SizedBox(height: 8),
          ...question.sourceCitations.asMap().entries.map((e) {
            final idx = e.key;
            final c = e.value;
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.surface,
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text('Source ${idx + 1}',
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700,
                                color: AppColors.primary)),
                      ),
                      const SizedBox(width: 8),
                      if (c.pageNumber != null)
                        Text('Page ${c.pageNumber}',
                            style: TextStyle(fontSize: 11,
                                color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary)),
                      if (c.slideIndex != null)
                        Text('Slide ${c.slideIndex! + 1}',
                            style: TextStyle(fontSize: 11,
                                color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.darkBackground : AppColors.background,
                      borderRadius: BorderRadius.circular(6),
                      border: Border(
                        left: BorderSide(color: AppColors.primary, width: 3),
                      ),
                    ),
                    child: Text(c.quote,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            fontSize: 12, fontStyle: FontStyle.italic, height: 1.5)),
                  ),
                ],
              ),
            );
          }),
        ],

        // Legacy URL citations
        if (hasCitations) ...[
          if (hasSources) const SizedBox(height: 12),
          Text('REFERENCES', style: Theme.of(context).textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w600, letterSpacing: 1.0, fontSize: 10,
              color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary)),
          const SizedBox(height: 8),
          ...question.citations.map((c) => Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkSurface : AppColors.surface,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                  border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.border),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.link_rounded, size: 14, color: AppColors.accent),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(c.title.isNotEmpty ? c.title : c.source,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                          if (c.source.isNotEmpty && c.title.isNotEmpty)
                            Text(c.source,
                                style: TextStyle(fontSize: 11,
                                    color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary)),
                        ],
                      ),
                    ),
                  ],
                ),
              )),
        ],

        if (!hasSources && !hasCitations)
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text('No source citations available for this question.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary)),
            ),
          ),
      ],
    );
  }
}
