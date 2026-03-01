import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../models/file_model.dart';
import 'processing_indicator.dart';

class FileCard extends StatelessWidget {
  final FileModel file;

  const FileCard({super.key, required this.file});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isProcessing = file.status != 'READY' &&
        file.status != 'COMPLETE' &&
        file.status != 'FAILED' &&
        file.status != 'UPLOADED';

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isProcessing
              ? AppColors.primary.withValues(alpha: 0.25)
              : (isDark ? AppColors.darkBorder : AppColors.border),
        ),
        boxShadow: isProcessing && !isDark ? AppSpacing.shadowSm : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ListTile(
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.xs,
            ),
            leading: _fileIcon(file.mimeType, isDark),
            title: Text(
              file.originalName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: _buildSubtitle(context, isDark),
            trailing: isProcessing ? null : _statusIndicator(isDark),
          ),
          // Show expanded processing indicator when processing
          if (isProcessing)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md, 0, AppSpacing.md, AppSpacing.md),
              child: ProcessingIndicator(
                phase: file.processingPhase,
                showLabel: true,
              ),
            ),
        ],
      ),
    );
  }

  Widget _fileIcon(String mimeType, bool isDark) {
    IconData icon;
    Color color;
    if (mimeType.contains('pdf')) {
      icon = Icons.picture_as_pdf;
      color = AppColors.error;
    } else if (mimeType.contains('presentation')) {
      icon = Icons.slideshow;
      color = AppColors.warning;
    } else if (mimeType.contains('wordprocessing')) {
      icon = Icons.article;
      color = AppColors.primary;
    } else {
      icon = Icons.insert_drive_file;
      color = isDark ? AppColors.darkTextTertiary : AppColors.textTertiary;
    }

    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.1),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Icon(icon, color: color, size: 22),
    );
  }

  Widget _buildSubtitle(BuildContext context, bool isDark) {
    final sizeStr = _formatSize(file.sizeBytes);
    final statusStr = isProcessing
        ? ' \u00b7 Processing'
        : file.status == 'READY' || file.status == 'COMPLETE'
            ? ' \u00b7 ${file.sectionCount} sections'
            : file.status == 'FAILED'
                ? ' \u00b7 Failed'
                : '';
    return Text(
      '$sizeStr$statusStr',
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: file.status == 'FAILED'
                ? AppColors.error
                : (isDark
                    ? AppColors.darkTextTertiary
                    : AppColors.textTertiary),
          ),
    );
  }

  Widget _statusIndicator(bool isDark) {
    switch (file.status) {
      case 'READY':
      case 'COMPLETE':
        return Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: AppColors.success.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check, color: AppColors.success, size: 16),
        );
      case 'FAILED':
        return Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: AppColors.error.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.close, color: AppColors.error, size: 16),
        );
      default:
        return Icon(Icons.hourglass_empty,
            color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary,
            size: 20);
    }
  }

  String _formatSize(int bytes) {
    if (bytes >= 1048576) {
      return '${(bytes / 1048576).toStringAsFixed(1)} MB';
    }
    return '${(bytes / 1024).toStringAsFixed(0)} KB';
  }
}
