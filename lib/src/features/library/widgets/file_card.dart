import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../models/file_model.dart';
import 'section_list.dart';

class FileCard extends StatefulWidget {
  final FileModel file;

  const FileCard({super.key, required this.file});

  @override
  State<FileCard> createState() => _FileCardState();
}

class _FileCardState extends State<FileCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final file = widget.file;
    final hasContent = file.status == 'READY' && file.sectionCount > 0;

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // Main row
          InkWell(
            onTap: hasContent
                ? () => setState(() => _expanded = !_expanded)
                : null,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  // File type icon
                  _FileTypeIcon(mimeType: file.mimeType),
                  const SizedBox(width: AppSpacing.md),

                  // Name + meta
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          file.originalName,
                          style: Theme.of(context)
                              .textTheme
                              .titleSmall
                              ?.copyWith(fontWeight: FontWeight.w600),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            _MetaChip(
                              label: _formatSize(file.sizeBytes),
                              icon: Icons.storage,
                            ),
                            if (file.status == 'READY') ...[
                              const SizedBox(width: AppSpacing.sm),
                              _MetaChip(
                                label:
                                    '${file.sectionCount} ${file.sectionCount == 1 ? 'section' : 'sections'}',
                                icon: Icons.segment,
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(width: AppSpacing.sm),

                  // Status + expand
                  Column(
                    children: [
                      _StatusBadge(status: file.status),
                      if (hasContent) ...[
                        const SizedBox(height: 4),
                        AnimatedRotation(
                          turns: _expanded ? 0.5 : 0,
                          duration: const Duration(milliseconds: 200),
                          child: const Icon(
                            Icons.expand_more,
                            size: 20,
                            color: AppColors.textTertiary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Processing bar
          if (file.status == 'PROCESSING')
            const LinearProgressIndicator(
              minHeight: 3,
              color: AppColors.primary,
              backgroundColor: AppColors.surfaceVariant,
            ),

          // Error message
          if (file.status == 'FAILED' && file.errorMessage != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              color: AppColors.error.withValues(alpha: 0.05),
              child: Row(
                children: [
                  const Icon(Icons.error_outline,
                      color: AppColors.error, size: 16),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      file.errorMessage!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.error,
                          ),
                    ),
                  ),
                ],
              ),
            ),

          // Expandable sections
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: Container(
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: AppColors.divider),
                ),
              ),
              child: SectionList(fileId: file.id),
            ),
            crossFadeState: _expanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 250),
          ),
        ],
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

// ---------------------------------------------------------------------------
// File type icon with colored background
// ---------------------------------------------------------------------------

class _FileTypeIcon extends StatelessWidget {
  final String mimeType;

  const _FileTypeIcon({required this.mimeType});

  @override
  Widget build(BuildContext context) {
    final (IconData icon, Color color) = _resolve();

    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
      child: Icon(icon, color: color, size: 22),
    );
  }

  (IconData, Color) _resolve() {
    if (mimeType.contains('pdf')) {
      return (Icons.picture_as_pdf, const Color(0xFFE53935));
    }
    if (mimeType.contains('presentation')) {
      return (Icons.slideshow, const Color(0xFFF57C00));
    }
    if (mimeType.contains('wordprocessing')) {
      return (Icons.article, const Color(0xFF1E88E5));
    }
    if (mimeType.contains('zip')) {
      return (Icons.folder_zip, const Color(0xFF7B1FA2));
    }
    return (Icons.insert_drive_file, AppColors.textTertiary);
  }
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final (String label, Color color, IconData icon) = _resolve();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  (String, Color, IconData) _resolve() {
    switch (status) {
      case 'PROCESSING':
        return ('Processing', AppColors.info, Icons.sync);
      case 'READY':
        return ('Ready', AppColors.success, Icons.check_circle);
      case 'FAILED':
        return ('Failed', AppColors.error, Icons.error);
      default:
        return ('Uploaded', AppColors.textTertiary, Icons.cloud_done);
    }
  }
}

// ---------------------------------------------------------------------------
// Small metadata chip
// ---------------------------------------------------------------------------

class _MetaChip extends StatelessWidget {
  final String label;
  final IconData icon;

  const _MetaChip({required this.label, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: AppColors.textTertiary),
        const SizedBox(width: 3),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
                fontSize: 12,
              ),
        ),
      ],
    );
  }
}
