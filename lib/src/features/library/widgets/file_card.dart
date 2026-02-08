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
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: ListTile(
        leading: _fileIcon(file.mimeType),
        title: Text(
          file.originalName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: _buildSubtitle(context),
        trailing: _statusIndicator(),
      ),
    );
  }

  Widget _fileIcon(String mimeType) {
    IconData icon;
    Color color;
    if (mimeType.contains('pdf')) {
      icon = Icons.picture_as_pdf;
      color = Colors.red;
    } else if (mimeType.contains('presentation')) {
      icon = Icons.slideshow;
      color = Colors.orange;
    } else if (mimeType.contains('wordprocessing')) {
      icon = Icons.article;
      color = Colors.blue;
    } else {
      icon = Icons.insert_drive_file;
      color = AppColors.textTertiary;
    }
    return Icon(icon, color: color, size: 32);
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
        return const ProcessingIndicator();
      case 'READY':
        return const Icon(Icons.check_circle, color: AppColors.success);
      case 'FAILED':
        return const Icon(Icons.error, color: AppColors.error);
      default:
        return const Icon(Icons.hourglass_empty, color: AppColors.textTertiary);
    }
  }

  String _formatSize(int bytes) {
    if (bytes >= 1048576) {
      return '${(bytes / 1048576).toStringAsFixed(1)} MB';
    }
    return '${(bytes / 1024).toStringAsFixed(0)} KB';
  }
}
