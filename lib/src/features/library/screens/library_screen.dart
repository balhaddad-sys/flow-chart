import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/services/storage_service.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../models/file_model.dart';
import '../../home/providers/home_provider.dart';
import '../providers/library_provider.dart';
import '../widgets/section_list.dart';

const _uuid = Uuid();

class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key});

  Future<void> _uploadFile(BuildContext context, WidgetRef ref) async {
    final uid = ref.read(uidProvider);
    if (uid == null) return;

    final activeCourseId = ref.read(activeCourseIdProvider);
    if (activeCourseId == null) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No active course selected')),
        );
      }
      return;
    }

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.any,
        allowMultiple: false,
        withData: true,
      );
      if (result == null || result.files.isEmpty) return;

      final file = result.files.first;
      final ext = file.extension?.toLowerCase();

      if (ext == null ||
          !StorageService.supportedExtensions.contains(ext)) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Unsupported file type: .${ext ?? 'unknown'}. '
                'Use PDF, PPTX, DOCX, or ZIP.',
              ),
            ),
          );
        }
        return;
      }

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Uploading ${file.name}...')),
        );
      }

      final storageService = StorageService();
      final fileId = _uuid.v4();
      final storagePath = await storageService.uploadFile(
        uid: uid,
        fileId: fileId,
        file: file,
      );

      final firestoreService = ref.read(firestoreServiceProvider);
      await firestoreService.createFile(uid, {
        'courseId': activeCourseId,
        'originalName': file.name,
        'storagePath': storagePath,
        'sizeBytes': file.size,
        'contentType':
            StorageService.mimeTypes[ext] ?? 'application/octet-stream',
        'status': 'UPLOADED',
      });

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${file.name} uploaded')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(coursesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Library'),
      ),
      body: coursesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (courses) {
          if (courses.isEmpty) {
            return const EmptyState(
              icon: Icons.folder_outlined,
              title: 'No courses yet',
              subtitle: 'Create a course first, then upload materials',
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
            itemCount: courses.length,
            itemBuilder: (context, i) {
              final course = courses[i];
              return _CourseSection(
                courseId: course.id,
                courseTitle: course.title,
              );
            },
          );
        },
      ),
      floatingActionButton: Container(
        decoration: BoxDecoration(
          gradient: AppColors.primaryGradient,
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.3),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: FloatingActionButton.extended(
          onPressed: () => _uploadFile(context, ref),
          backgroundColor: Colors.transparent,
          elevation: 0,
          icon: const Icon(Icons.upload_file_rounded, color: Colors.white),
          label: const Text('Upload',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w600,
              )),
        ),
      ),
    );
  }
}

class _CourseSection extends ConsumerWidget {
  final String courseId;
  final String courseTitle;

  const _CourseSection({
    required this.courseId,
    required this.courseTitle,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filesAsync = ref.watch(filesProvider(courseId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(
            courseTitle,
            style: Theme.of(context).textTheme.headlineMedium,
          ),
        ),
        filesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Text('Error: $e'),
          data: (files) {
            if (files.isEmpty) {
              return Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.lg),
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.surfaceVariant.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  border: Border.all(
                    color: AppColors.border,
                    style: BorderStyle.solid,
                  ),
                ),
                child: Text(
                  'No files uploaded yet',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.textTertiary,
                      ),
                ),
              );
            }
            return Column(
              children: files
                  .map((file) => _ExpandableFileCard(file: file))
                  .toList(),
            );
          },
        ),
        AppSpacing.gapLg,
      ],
    );
  }
}

class _ExpandableFileCard extends ConsumerStatefulWidget {
  final FileModel file;

  const _ExpandableFileCard({required this.file});

  @override
  ConsumerState<_ExpandableFileCard> createState() =>
      _ExpandableFileCardState();
}

class _ExpandableFileCardState extends ConsumerState<_ExpandableFileCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final file = widget.file;
    final isReady = file.status == 'READY';
    final hasSections = isReady && file.sectionCount > 0;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.7)),
        boxShadow: AppSpacing.shadowSm,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ListTile(
            onTap: hasSections
                ? () => setState(() => _expanded = !_expanded)
                : null,
            leading: _fileIcon(file.mimeType),
            title: Text(
              file.originalName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            subtitle: _buildSubtitle(context, file),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _statusIndicator(file.status),
                if (hasSections) ...[
                  const SizedBox(width: 4),
                  Icon(
                    _expanded
                        ? Icons.expand_less_rounded
                        : Icons.expand_more_rounded,
                    color: AppColors.textTertiary,
                  ),
                ],
              ],
            ),
          ),
          if (hasSections)
            AnimatedCrossFade(
              firstChild: const SizedBox.shrink(),
              secondChild: Container(
                decoration: const BoxDecoration(
                  border: Border(
                    top: BorderSide(color: AppColors.divider),
                  ),
                ),
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: SectionList(fileId: file.id),
              ),
              crossFadeState: _expanded
                  ? CrossFadeState.showSecond
                  : CrossFadeState.showFirst,
              duration: const Duration(milliseconds: 200),
            ),
        ],
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

  Widget _buildSubtitle(BuildContext context, FileModel file) {
    final sizeStr = _formatSize(file.sizeBytes);
    final sectionStr = file.status == 'READY'
        ? ' | ${file.sectionCount} sections'
        : '';
    return Text(
      '$sizeStr$sectionStr',
      style: Theme.of(context).textTheme.bodySmall,
    );
  }

  Widget _statusIndicator(String status) {
    switch (status) {
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
