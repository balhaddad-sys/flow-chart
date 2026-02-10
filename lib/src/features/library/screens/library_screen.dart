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
            padding: AppSpacing.screenPadding,
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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _uploadFile(context, ref),
        icon: const Icon(Icons.upload_file),
        label: const Text('Upload'),
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
        Text(
          courseTitle,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        AppSpacing.gapSm,
        filesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Text('Error: $e'),
          data: (files) {
            if (files.isEmpty) {
              return const Padding(
                padding: EdgeInsets.all(AppSpacing.md),
                child: Text('No files uploaded yet'),
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

/// A file entry that expands to show the file's extracted sections.
class _ExpandableFileCard extends ConsumerStatefulWidget {
  final dynamic file;

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

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // File header - tappable to expand if sections exist
          ListTile(
            onTap: hasSections
                ? () => setState(() => _expanded = !_expanded)
                : null,
            leading: _fileIcon(file.mimeType),
            title: Text(
              file.originalName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
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
                        ? Icons.expand_less
                        : Icons.expand_more,
                    color: AppColors.textTertiary,
                  ),
                ],
              ],
            ),
          ),

          // Expandable sections list
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

  Widget _buildSubtitle(BuildContext context, dynamic file) {
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
        return const Icon(Icons.check_circle, color: AppColors.success);
      case 'FAILED':
        return const Icon(Icons.error, color: AppColors.error);
      default:
        return const Icon(
            Icons.hourglass_empty, color: AppColors.textTertiary);
    }
  }

  String _formatSize(int bytes) {
    if (bytes >= 1048576) {
      return '${(bytes / 1048576).toStringAsFixed(1)} MB';
    }
    return '${(bytes / 1024).toStringAsFixed(0)} KB';
  }
}
