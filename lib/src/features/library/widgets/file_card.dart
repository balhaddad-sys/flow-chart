import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../models/file_model.dart';

class FileCard extends StatelessWidget {
  final FileModel file;

  const FileCard({super.key, required this.file});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.7)),
        boxShadow: AppSpacing.shadowSm,
      ),
      child: ListTile(
        leading: _fileIcon(file.mimeType),
        title: Text(
          file.originalName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        subtitle: _buildSubtitle(context),
        trailing: _statusIndicator(),
      ),
    );
  }

  Widget _fileIcon(String mimeType) {
    IconData icon;
    Color color;
    Color bg;
    if (mimeType.contains('pdf')) {
      icon = Icons.picture_as_pdf_rounded;
      color = const Color(0xFFDC2626);
      bg = const Color(0xFFFEF2F2);
    } else if (mimeType.contains('presentation')) {
      icon = Icons.slideshow_rounded;
      color = const Color(0xFFD97706);
      bg = const Color(0xFFFFFBEB);
    } else if (mimeType.contains('wordprocessing')) {
      icon = Icons.article_rounded;
      color = const Color(0xFF1A56DB);
      bg = const Color(0xFFEFF6FF);
    } else {
      icon = Icons.insert_drive_file_rounded;
      color = AppColors.textTertiary;
      bg = AppColors.surfaceVariant;
    }
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Icon(icon, color: color, size: 22),
    );
  }

  Widget _buildSubtitle(BuildContext context) {
    final sizeStr = _formatSize(file.sizeBytes);
    final sectionStr = file.status == 'READY'
        ? ' | ${file.sectionCount} sections'
        : '';
    return Text(
      '$sizeStr$sectionStr',
      style: Theme.of(context).textTheme.bodySmall,
    );
  }

  Widget _statusIndicator() {
    switch (file.status) {
      case 'PROCESSING':
        return const SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: AppColors.primary,
          ),
        );
      case 'READY':
        return Container(
          width: 24,
          height: 24,
          decoration: const BoxDecoration(
            color: AppColors.successSurface,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check_rounded,
              color: AppColors.success, size: 16),
        );
      case 'FAILED':
        return const Icon(Icons.error_rounded, color: AppColors.error);
      default:
        return const Icon(
            Icons.hourglass_empty_rounded, color: AppColors.textTertiary);
    }
  }

  String _formatSize(int bytes) {
    if (bytes >= 1048576) {
      return '${(bytes / 1048576).toStringAsFixed(1)} MB';
    }
    return '${(bytes / 1024).toStringAsFixed(0)} KB';
  }
}
