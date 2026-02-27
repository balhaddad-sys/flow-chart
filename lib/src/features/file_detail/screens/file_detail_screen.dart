// FILE: lib/src/features/file_detail/screens/file_detail_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../models/file_model.dart';
import '../../../models/section_model.dart';
import '../../library/widgets/processing_indicator.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────────────────────

/// Streams sections belonging to a given file.
final fileSectionsProvider =
    StreamProvider.family<List<SectionModel>, String>((ref, fileId) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return const Stream.empty();
  return ref
      .watch(firestoreServiceProvider)
      .watchSections(uid, fileId: fileId);
});

/// Fetches a single file by ID.
final singleFileProvider =
    FutureProvider.family<FileModel?, String>((ref, fileId) async {
  final uid = ref.watch(uidProvider);
  if (uid == null) return null;
  return ref.watch(firestoreServiceProvider).getFile(uid, fileId);
});

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class FileDetailScreen extends ConsumerWidget {
  final String fileId;

  const FileDetailScreen({super.key, required this.fileId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fileAsync = ref.watch(singleFileProvider(fileId));
    final sectionsAsync = ref.watch(fileSectionsProvider(fileId));

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        title: fileAsync.when(
          data: (f) => Text(
            f?.originalName ?? 'File',
            overflow: TextOverflow.ellipsis,
          ),
          loading: () => const Text('Loading...'),
          error: (_, __) => const Text('File'),
        ),
        actions: [
          // Delete action
          fileAsync.when(
            data: (f) => f != null
                ? IconButton(
                    icon: const Icon(Icons.delete_outline_rounded),
                    tooltip: 'Delete file',
                    onPressed: () => _confirmDelete(context, ref, f),
                  )
                : const SizedBox.shrink(),
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
        ],
      ),
      body: fileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: AppSpacing.screenPadding,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline_rounded,
                    size: 48, color: AppColors.error),
                AppSpacing.gapMd,
                const Text('Unable to load file. Please try again.'),
              ],
            ),
          ),
        ),
        data: (file) {
          if (file == null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.search_off_rounded,
                    size: 48,
                    color: isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary,
                  ),
                  AppSpacing.gapMd,
                  const Text('File not found'),
                ],
              ),
            );
          }

          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
            children: [
              // ── File info card ─────────────────────────────────────────
              _FileInfoCard(file: file, isDark: isDark),
              AppSpacing.gapLg,

              // ── Sections label ─────────────────────────────────────────
              Text(
                'SECTIONS',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.0,
                      fontSize: 11,
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textSecondary,
                    ),
              ),
              AppSpacing.gapSm,

              // ── Section list ────────────────────────────────────────────
              sectionsAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (e, _) => Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(
                    'Error loading sections: $e',
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.error),
                  ),
                ),
                data: (sections) {
                  if (sections.isEmpty) {
                    return Container(
                      padding: const EdgeInsets.all(24),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: isDark
                            ? AppColors.darkSurfaceVariant
                            : AppColors.surfaceVariant,
                        borderRadius:
                            BorderRadius.circular(AppSpacing.radiusMd),
                        border: Border.all(
                          color: isDark
                              ? AppColors.darkBorder
                              : AppColors.border,
                        ),
                      ),
                      child: Column(
                        children: [
                          Icon(
                            Icons.hourglass_empty_rounded,
                            size: 32,
                            color: isDark
                                ? AppColors.darkTextTertiary
                                : AppColors.textTertiary,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'No sections extracted yet.',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                  color: isDark
                                      ? AppColors.darkTextTertiary
                                      : AppColors.textTertiary,
                                ),
                          ),
                        ],
                      ),
                    );
                  }
                  return Column(
                    children: sections
                        .asMap()
                        .entries
                        .map((entry) => _SectionTile(
                              index: entry.key + 1,
                              section: entry.value,
                              isDark: isDark,
                            ))
                        .toList(),
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _confirmDelete(
      BuildContext context, WidgetRef ref, FileModel file) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? AppColors.darkSurface : AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        ),
        title: const Text('Delete File?'),
        content: Text(
          'This will permanently delete "${file.originalName}" '
          'and all its sections and questions.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;

    try {
      final cloudFunctions = ref.read(cloudFunctionsServiceProvider);
      await cloudFunctions.deleteFile(fileId: file.id);
      if (context.mounted) Navigator.of(context).pop();
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to delete: $e'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// File info card
// ─────────────────────────────────────────────────────────────────────────────

class _FileInfoCard extends StatelessWidget {
  final FileModel file;
  final bool isDark;

  const _FileInfoCard({required this.file, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // File icon + name + size
          Row(
            children: [
              _FileIcon(mimeType: file.mimeType),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      file.originalName,
                      style:
                          Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      _formatBytes(file.sizeBytes),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: isDark
                                ? AppColors.darkTextSecondary
                                : AppColors.textSecondary,
                          ),
                    ),
                  ],
                ),
              ),
              _StatusBadge(status: file.status, isDark: isDark),
            ],
          ),

          // Processing indicator
          if (file.status == 'PROCESSING' || file.status == 'UPLOADED') ...[
            AppSpacing.gapMd,
            ProcessingIndicator(
              phase: file.processingPhase,
              showLabel: true,
            ),
          ],

          // Error message
          if (file.status == 'FAILED' && file.errorMessage != null) ...[
            AppSpacing.gapMd,
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.error_outline_rounded,
                      size: 14, color: AppColors.error),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      file.errorMessage!,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.error),
                    ),
                  ),
                ],
              ),
            ),
          ],

          AppSpacing.gapSm,

          // Meta badges
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (file.meta.pageCount != null)
                _Badge(
                    '${file.meta.pageCount} pages',
                    Icons.description_outlined,
                    isDark),
              if (file.meta.slideCount != null)
                _Badge(
                    '${file.meta.slideCount} slides',
                    Icons.slideshow_outlined,
                    isDark),
              if (file.meta.wordCount != null)
                _Badge(
                    '${file.meta.wordCount} words',
                    Icons.notes_rounded,
                    isDark),
              _Badge(
                  '${file.sectionCount} sections',
                  Icons.layers_outlined,
                  isDark),
            ],
          ),
        ],
      ),
    );
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)} KB';
    }
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section tile
// ─────────────────────────────────────────────────────────────────────────────

class _SectionTile extends StatelessWidget {
  final int index;
  final SectionModel section;
  final bool isDark;

  const _SectionTile({
    required this.index,
    required this.section,
    required this.isDark,
  });

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
        border: Border.all(
            color: isDark ? AppColors.darkBorder : AppColors.border),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: isDark
                      ? AppColors.darkSurfaceVariant
                      : AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Center(
                  child: Text(
                    '$index',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  section.title,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                ),
              ),

              // Status chip
              _SectionStatusChip(section: section, isDark: isDark),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 10,
            runSpacing: 4,
            children: [
              _IconLabel(
                icon: Icons.timer_outlined,
                label: '${section.estMinutes} min',
                isDark: isDark,
              ),
              _IconLabel(
                icon: Icons.signal_cellular_alt_rounded,
                label: 'Diff ${section.difficulty}/5',
                color: diffColor,
                isDark: isDark,
              ),
              _IconLabel(
                icon: Icons.quiz_outlined,
                label: '${section.questionsCount} Qs',
                isDark: isDark,
              ),
            ],
          ),
          if (section.topicTags.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: section.topicTags.take(3).map((t) {
                return Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    t,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                      color: AppColors.primary,
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper widgets
// ─────────────────────────────────────────────────────────────────────────────

class _FileIcon extends StatelessWidget {
  final String mimeType;
  const _FileIcon({required this.mimeType});

  @override
  Widget build(BuildContext context) {
    IconData icon;
    Color color;
    if (mimeType.contains('pdf')) {
      icon = Icons.picture_as_pdf_rounded;
      color = AppColors.error;
    } else if (mimeType.contains('presentation') ||
        mimeType.contains('pptx')) {
      icon = Icons.slideshow_rounded;
      color = AppColors.warning;
    } else {
      icon = Icons.description_rounded;
      color = AppColors.accent;
    }
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, size: 22, color: color),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  final bool isDark;

  const _StatusBadge({required this.status, required this.isDark});

  @override
  Widget build(BuildContext context) {
    Color color;
    String label;
    IconData icon;

    switch (status) {
      case 'PROCESSING':
        color = AppColors.primary;
        label = 'Processing';
        icon = Icons.hourglass_top_rounded;
        break;
      case 'READY':
      case 'COMPLETE':
        color = AppColors.success;
        label = 'Ready';
        icon = Icons.check_circle_outline_rounded;
        break;
      case 'FAILED':
        color = AppColors.error;
        label = 'Failed';
        icon = Icons.error_outline_rounded;
        break;
      default:
        color =
            isDark ? AppColors.darkTextTertiary : AppColors.textTertiary;
        label = 'Uploaded';
        icon = Icons.cloud_done_outlined;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (status == 'PROCESSING')
            SizedBox(
              width: 10,
              height: 10,
              child: CircularProgressIndicator(
                strokeWidth: 1.5,
                color: color,
              ),
            )
          else
            Icon(icon, size: 10, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final String text;
  final IconData icon;
  final bool isDark;

  const _Badge(this.text, this.icon, this.isDark);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color:
            isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
        border: Border.all(
            color: isDark ? AppColors.darkBorder : AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 11,
            color: isDark
                ? AppColors.darkTextSecondary
                : AppColors.textSecondary,
          ),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: isDark
                  ? AppColors.darkTextSecondary
                  : AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _IconLabel extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;
  final bool isDark;

  const _IconLabel({
    required this.icon,
    required this.label,
    this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ??
        (isDark ? AppColors.darkTextTertiary : AppColors.textTertiary);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: c),
        const SizedBox(width: 3),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: c,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

class _SectionStatusChip extends StatelessWidget {
  final SectionModel section;
  final bool isDark;

  const _SectionStatusChip({required this.section, required this.isDark});

  @override
  Widget build(BuildContext context) {
    if (section.aiStatus == 'ANALYZED') {
      if (section.questionsCount > 0) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
          decoration: BoxDecoration(
            color: AppColors.success.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.check_circle_outline_rounded,
                  size: 10, color: AppColors.success),
              SizedBox(width: 4),
              Text(
                'Ready',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: AppColors.success,
                ),
              ),
            ],
          ),
        );
      }
      return Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.warning.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.pending_outlined,
                size: 10, color: AppColors.warning),
            SizedBox(width: 4),
            Text(
              'No questions',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.warning,
              ),
            ),
          ],
        ),
      );
    }

    if (section.aiStatus == 'PROCESSING') {
      return Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 10,
              height: 10,
              child: CircularProgressIndicator(
                strokeWidth: 1.5,
                color: AppColors.primary,
              ),
            ),
            SizedBox(width: 4),
            Text(
              'Analyzing',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
            ),
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }
}
