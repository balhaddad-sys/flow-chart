import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_spacing.dart';
import '../../../core/widgets/empty_state.dart';
import '../../home/providers/home_provider.dart';
import '../providers/library_provider.dart';
import '../widgets/file_card.dart';

class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key});

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
        onPressed: () {
          // TODO(medq): Implement file upload from library
        },
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
