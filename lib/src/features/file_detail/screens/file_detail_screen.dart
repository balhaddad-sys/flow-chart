import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../models/file_model.dart';
import '../../../models/section_model.dart';
import '../../library/widgets/processing_indicator.dart';

/// Provider that streams sections belonging to a given file.
final fileSectionsProvider =
    StreamProvider.family<List<SectionModel>, String>((ref, fileId) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return const Stream.empty();
  return ref.watch(firestoreServiceProvider).watchSections(uid, fileId: fileId);
});

/// Provider that fetches a single file by ID.
final singleFileProvider =
    FutureProvider.family<FileModel?, String>((ref, fileId) async {
  final uid = ref.watch(uidProvider);
  if (uid == null) return null;
  return ref.watch(firestoreServiceProvider).getFile(uid, fileId);
});

class FileDetailScreen extends ConsumerWidget {
  final String fileId;
  const FileDetailScreen({super.key, required this.fileId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fileAsync = ref.watch(singleFileProvider(fileId));
    final sectionsAsync = ref.watch(fileSectionsProvider(fileId));

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
        title: fileAsync.when(
          data: (f) => Text(f?.originalName ?? 'File'),
          loading: () => const Text('Loading...'),
          error: (_, __) => const Text('File'),
        ),
      ),
      body: fileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => const Center(child: Text('Unable to load file. Please try again.')),
        data: (file) {
          if (file == null) {
            return const Center(child: Text('File not found'));
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
            children: [
              // ── File info card ──────────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkSurface : AppColors.surface,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  border: Border.all(
                    color: isDark ? AppColors.darkBorder : AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _fileIcon(file.mimeType),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(file.originalName,
                                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                      fontWeight: FontWeight.w700)),
                              const SizedBox(height: 2),
                              Text(_formatBytes(file.sizeBytes),
                                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                      color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (file.status == 'PROCESSING' || file.status == 'UPLOADED') ...[
                      AppSpacing.gapMd,
                      ProcessingIndicator(
                        phase: file.processingPhase,
                      ),
                    ],
                    if (file.status == 'FAILED' && file.errorMessage != null) ...[
                      AppSpacing.gapMd,
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.error.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded, size: 14, color: AppColors.error),
                            const SizedBox(width: 8),
                            Expanded(child: Text(file.errorMessage!,
                                style: const TextStyle(fontSize: 12, color: AppColors.error))),
                          ],
                        ),
                      ),
                    ],
                    AppSpacing.gapSm,
                    // Meta badges
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: [
                        if (file.meta.pageCount != null)
                          _Badge('${file.meta.pageCount} pages', isDark),
                        if (file.meta.slideCount != null)
                          _Badge('${file.meta.slideCount} slides', isDark),
                        if (file.meta.wordCount != null)
                          _Badge('${file.meta.wordCount} words', isDark),
                        _Badge('${file.sectionCount} sections', isDark),
                      ],
                    ),
                  ],
                ),
              ),
              AppSpacing.gapLg,

              // ── Sections header ─────────────────────────────────────────
              Text('SECTIONS',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.0,
                      fontSize: 11,
                      color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary)),
              AppSpacing.gapSm,

              // ── Section list ────────────────────────────────────────────
              sectionsAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Text('Error loading sections: $e'),
                data: (sections) {
                  if (sections.isEmpty) {
                    return Container(
                      padding: const EdgeInsets.all(24),
                      alignment: Alignment.center,
                      child: Text('No sections extracted yet.',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary)),
                    );
                  }
                  return Column(
                    children: sections.map((s) => _SectionTile(section: s, isDark: isDark)).toList(),
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _fileIcon(String mimeType) {
    IconData icon;
    Color color;
    if (mimeType.contains('pdf')) {
      icon = Icons.picture_as_pdf_rounded;
      color = AppColors.error;
    } else if (mimeType.contains('presentation') || mimeType.contains('pptx')) {
      icon = Icons.slideshow_rounded;
      color = AppColors.warning;
    } else {
      icon = Icons.description_rounded;
      color = AppColors.accent;
    }
    return Container(
      width: 40, height: 40,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, size: 20, color: color),
    );
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

class _Badge extends StatelessWidget {
  final String text;
  final bool isDark;
  const _Badge(this.text, this.isDark);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(text, style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary)),
    );
  }
}

class _SectionTile extends StatelessWidget {
  final SectionModel section;
  final bool isDark;
  const _SectionTile({required this.section, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final diffColor = section.difficulty <= 2
        ? AppColors.difficultyEasy
        : section.difficulty <= 3
            ? AppColors.difficultyMedium
            : AppColors.difficultyHard;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(section.title,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w600, fontSize: 14)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              _iconLabel(Icons.timer_outlined, '${section.estMinutes} min'),
              _iconLabel(Icons.signal_cellular_alt_rounded, 'Diff ${section.difficulty}',
                  color: diffColor),
              _iconLabel(Icons.quiz_outlined, '${section.questionsCount} Qs'),
              if (section.aiStatus == 'PROCESSING')
                _iconLabel(Icons.hourglass_top_rounded, 'Processing...', color: AppColors.warning),
              if (section.aiStatus == 'ANALYZED')
                _iconLabel(Icons.check_circle_outline_rounded, 'Ready', color: AppColors.success),
            ],
          ),
          if (section.topicTags.isNotEmpty) ...[
            const SizedBox(height: 6),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: section.topicTags.take(3).map((t) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(t, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w500,
                    color: AppColors.primary)),
              )).toList(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _iconLabel(IconData icon, String text, {Color? color}) {
    final c = color ?? (isDark ? AppColors.darkTextTertiary : AppColors.textTertiary);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: c),
        const SizedBox(width: 3),
        Text(text, style: TextStyle(fontSize: 11, color: c, fontWeight: FontWeight.w500)),
      ],
    );
  }
}
