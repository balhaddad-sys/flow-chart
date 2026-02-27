// FILE: lib/src/features/library/widgets/file_card.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
import '../../../models/file_model.dart';
import 'processing_indicator.dart';
import 'section_list.dart';

class FileCard extends ConsumerStatefulWidget {
  final FileModel file;

  const FileCard({super.key, required this.file});

  @override
  ConsumerState<FileCard> createState() => _FileCardState();
}

class _FileCardState extends ConsumerState<FileCard>
    with SingleTickerProviderStateMixin {
  bool _expanded = false;
  bool _deleting = false;

  late final AnimationController _expandController;
  late final Animation<double> _expandAnim;

  @override
  void initState() {
    super.initState();
    _expandController = AnimationController(
      vsync: this,
      duration: AppSpacing.animNormal,
    );
    _expandAnim = CurvedAnimation(
      parent: _expandController,
      curve: Curves.easeInOut,
    );
  }

  @override
  void dispose() {
    _expandController.dispose();
    super.dispose();
  }

  void _toggleExpanded() {
    setState(() => _expanded = !_expanded);
    if (_expanded) {
      _expandController.forward();
    } else {
      _expandController.reverse();
    }
  }

  Future<void> _deleteFile(BuildContext context) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor:
            isDark ? AppColors.darkSurface : AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        ),
        title: const Text('Delete File?'),
        content: Text(
          'This will permanently delete "${widget.file.originalName}" and all its sections.',
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

    if (confirmed != true || !mounted) return;

    setState(() => _deleting = true);
    try {
      final cloudFunctions = ref.read(cloudFunctionsServiceProvider);
      await cloudFunctions.deleteFile(fileId: widget.file.id);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to delete file: $e'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        setState(() => _deleting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isProcessing = widget.file.status == 'PROCESSING';
    final isReady = widget.file.status == 'READY' ||
        widget.file.status == 'COMPLETE';
    final isFailed = widget.file.status == 'FAILED';

    return AnimatedOpacity(
      opacity: _deleting ? 0.4 : 1.0,
      duration: AppSpacing.animFast,
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.sm),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(
            color: isProcessing
                ? AppColors.primary.withValues(alpha: 0.3)
                : isFailed
                    ? AppColors.error.withValues(alpha: 0.3)
                    : (isDark ? AppColors.darkBorder : AppColors.border),
          ),
          boxShadow: isDark ? null : AppSpacing.shadowSm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header row ────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md, vertical: AppSpacing.sm),
              child: Row(
                children: [
                  // File type icon
                  _FileIcon(
                      mimeType: widget.file.mimeType,
                      status: widget.file.status,
                      isDark: isDark),
                  const SizedBox(width: 10),

                  // Name + meta
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.file.originalName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w600,
                                color: isDark
                                    ? AppColors.darkTextPrimary
                                    : AppColors.textPrimary,
                              ),
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Text(
                              _formatSize(widget.file.sizeBytes),
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: isDark
                                        ? AppColors.darkTextTertiary
                                        : AppColors.textTertiary,
                                    fontSize: 11,
                                  ),
                            ),
                            if (isReady && widget.file.sectionCount > 0) ...[
                              Text(
                                ' · ${widget.file.sectionCount} sections',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      color: isDark
                                          ? AppColors.darkTextTertiary
                                          : AppColors.textTertiary,
                                      fontSize: 11,
                                    ),
                              ),
                            ],
                          ],
                        ),
                        // Processing phase label
                        if (isProcessing &&
                            widget.file.processingPhase != null) ...[
                          const SizedBox(height: 4),
                          ProcessingIndicator(
                            phase: widget.file.processingPhase,
                            compact: true,
                            showLabel: true,
                          ),
                        ],
                      ],
                    ),
                  ),

                  // Status badge
                  _StatusBadge(status: widget.file.status, isDark: isDark),
                  const SizedBox(width: 4),

                  // Delete button
                  if (!_deleting)
                    IconButton(
                      icon: const Icon(Icons.delete_outline_rounded),
                      onPressed: () => _deleteFile(context),
                      iconSize: 18,
                      color: isDark
                          ? AppColors.darkTextTertiary
                          : AppColors.textTertiary,
                      tooltip: 'Delete file',
                      padding: const EdgeInsets.all(6),
                      constraints: const BoxConstraints(),
                    )
                  else
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),

                  // Expand toggle (only for ready files)
                  if (isReady && widget.file.sectionCount > 0)
                    AnimatedRotation(
                      turns: _expanded ? 0.5 : 0,
                      duration: AppSpacing.animNormal,
                      child: IconButton(
                        icon: const Icon(Icons.expand_more_rounded),
                        onPressed: _toggleExpanded,
                        iconSize: 20,
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                        padding: const EdgeInsets.all(4),
                        constraints: const BoxConstraints(),
                        tooltip: _expanded
                            ? 'Collapse sections'
                            : 'Show sections',
                      ),
                    ),
                ],
              ),
            ),

            // ── Expanded sections ─────────────────────────────────────────
            SizeTransition(
              sizeFactor: _expandAnim,
              child: Column(
                children: [
                  Divider(
                    height: 1,
                    color: isDark ? AppColors.darkBorder : AppColors.border,
                  ),
                  SectionList(
                    fileId: widget.file.id,
                    courseId: widget.file.courseId,
                  ),
                ],
              ),
            ),

            // ── Error message ─────────────────────────────────────────────
            if (isFailed && widget.file.errorMessage != null)
              Container(
                margin: const EdgeInsets.fromLTRB(
                    AppSpacing.md, 0, AppSpacing.md, AppSpacing.sm),
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.error_outline_rounded,
                        size: 14, color: AppColors.error),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        widget.file.errorMessage!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.error,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _formatSize(int bytes) {
    if (bytes >= 1048576) {
      return '${(bytes / 1048576).toStringAsFixed(1)} MB';
    }
    return '${(bytes / 1024).toStringAsFixed(0)} KB';
  }
}

// ── File type icon ─────────────────────────────────────────────────────────

class _FileIcon extends StatelessWidget {
  final String mimeType;
  final String status;
  final bool isDark;

  const _FileIcon(
      {required this.mimeType, required this.status, required this.isDark});

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
    } else if (mimeType.contains('wordprocessing') ||
        mimeType.contains('docx')) {
      icon = Icons.article_rounded;
      color = AppColors.primary;
    } else {
      icon = Icons.insert_drive_file_rounded;
      color = isDark ? AppColors.darkTextTertiary : AppColors.textTertiary;
    }

    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.1),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Icon(icon, color: color, size: 20),
    );
  }
}

// ── Status badge ───────────────────────────────────────────────────────────

class _StatusBadge extends StatelessWidget {
  final String status;
  final bool isDark;

  const _StatusBadge({required this.status, required this.isDark});

  @override
  Widget build(BuildContext context) {
    Color bgColor;
    Color textColor;
    String label;
    IconData icon;

    switch (status) {
      case 'PROCESSING':
        bgColor = AppColors.primary.withValues(alpha: 0.1);
        textColor = AppColors.primary;
        label = 'Processing';
        icon = Icons.hourglass_top_rounded;
        break;
      case 'READY':
      case 'COMPLETE':
        bgColor = AppColors.success.withValues(alpha: 0.1);
        textColor = AppColors.success;
        label = 'Ready';
        icon = Icons.check_circle_outline_rounded;
        break;
      case 'FAILED':
        bgColor = AppColors.error.withValues(alpha: 0.1);
        textColor = AppColors.error;
        label = 'Failed';
        icon = Icons.error_outline_rounded;
        break;
      default:
        bgColor = isDark
            ? AppColors.darkSurfaceVariant
            : AppColors.surfaceVariant;
        textColor =
            isDark ? AppColors.darkTextTertiary : AppColors.textTertiary;
        label = 'Uploaded';
        icon = Icons.cloud_done_outlined;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
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
                color: textColor,
              ),
            )
          else
            Icon(icon, size: 10, color: textColor),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }
}
