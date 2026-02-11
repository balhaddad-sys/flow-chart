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
import '../widgets/file_card.dart';

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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final filesAsync = ref.watch(filesProvider(courseId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
              ),
              child: const Icon(Icons.folder, color: AppColors.primary, size: 18),
            ),
            AppSpacing.hGapSm,
            Expanded(
              child: Text(
                courseTitle,
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
          ],
        ),
        AppSpacing.gapSm,
        filesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Text('Error: $e'),
          data: (files) {
            if (files.isEmpty) {
              return Container(
                width: double.infinity,
                padding: AppSpacing.cardPadding,
                decoration: BoxDecoration(
                  color: isDark
                      ? AppColors.darkSurfaceVariant
                      : AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                ),
                child: Text(
                  'No files uploaded yet',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary,
                      ),
                  textAlign: TextAlign.center,
                ),
              );
            }
            return Column(
              children: files
                  .map((file) => FileCard(file: file))
                  .toList(),
            );
          },
        ),
        AppSpacing.gapLg,
      ],
    );
  }
}
