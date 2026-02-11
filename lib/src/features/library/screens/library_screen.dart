import 'dart:math' as math;

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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: coursesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (courses) {
          if (courses.isEmpty) {
            return Column(
              children: [
                _LibraryHeader(fileCount: 0, isDark: isDark),
                const Expanded(
                  child: EmptyState(
                    icon: Icons.folder_open_rounded,
                    title: 'No courses yet',
                    subtitle:
                        'Create a course first, then upload your study materials here.',
                  ),
                ),
              ],
            );
          }

          return CustomScrollView(
            slivers: [
              // ── Header ──────────────────────────────────────────
              SliverToBoxAdapter(
                child: _LibraryHeader(
                  fileCount: null, // count shown per-section
                  isDark: isDark,
                ),
              ),

              // ── Upload Area ─────────────────────────────────────
              SliverPadding(
                padding: AppSpacing.screenHorizontal,
                sliver: SliverToBoxAdapter(
                  child: _UploadArea(
                    onTap: () => _uploadFile(context, ref),
                    isDark: isDark,
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: AppSpacing.gapLg),

              // ── Course Sections ─────────────────────────────────
              SliverPadding(
                padding: AppSpacing.screenHorizontal,
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, i) {
                      final course = courses[i];
                      return _CourseSection(
                        courseId: course.id,
                        courseTitle: course.title,
                      );
                    },
                    childCount: courses.length,
                  ),
                ),
              ),

              // Bottom safe-area breathing room
              const SliverToBoxAdapter(
                child: SizedBox(height: AppSpacing.xxl),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

class _LibraryHeader extends StatelessWidget {
  final int? fileCount;
  final bool isDark;

  const _LibraryHeader({required this.fileCount, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.only(
          left: 20,
          right: 20,
          top: AppSpacing.lg,
          bottom: AppSpacing.sm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Your Library',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: isDark
                        ? AppColors.darkTextPrimary
                        : AppColors.textPrimary,
                  ),
            ),
            const SizedBox(height: 2),
            Text(
              fileCount != null
                  ? '$fileCount file${fileCount == 1 ? '' : 's'}'
                  : 'Course materials & uploads',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated upload area with dashed border
// ─────────────────────────────────────────────────────────────────────────────

class _UploadArea extends StatefulWidget {
  final VoidCallback onTap;
  final bool isDark;

  const _UploadArea({required this.onTap, required this.isDark});

  @override
  State<_UploadArea> createState() => _UploadAreaState();
}

class _UploadAreaState extends State<_UploadArea>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scaleAnim;
  bool _pressed = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: AppSpacing.animFast,
    );
    _scaleAnim = Tween<double>(begin: 1.0, end: 0.97).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onTapDown(TapDownDetails _) {
    setState(() => _pressed = true);
    _controller.forward();
  }

  void _onTapUp(TapUpDetails _) {
    setState(() => _pressed = false);
    _controller.reverse();
  }

  void _onTapCancel() {
    setState(() => _pressed = false);
    _controller.reverse();
  }

  @override
  Widget build(BuildContext context) {
    final fillColor = widget.isDark
        ? AppColors.primary.withValues(alpha: 0.08)
        : AppColors.primarySubtle;
    final borderColor = widget.isDark
        ? AppColors.primary.withValues(alpha: 0.35)
        : AppColors.primaryLight.withValues(alpha: 0.4);

    return ScaleTransition(
      scale: _scaleAnim,
      child: GestureDetector(
        onTapDown: _onTapDown,
        onTapUp: _onTapUp,
        onTapCancel: _onTapCancel,
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: AppSpacing.animFast,
          padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
          decoration: BoxDecoration(
            color: _pressed
                ? AppColors.primary.withValues(alpha: widget.isDark ? 0.14 : 0.08)
                : fillColor,
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          ),
          child: CustomPaint(
            painter: _DashedBorderPainter(
              color: borderColor,
              radius: AppSpacing.radiusLg,
              strokeWidth: 1.5,
              dashLength: 7,
              gapLength: 5,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  ),
                  child: const Icon(
                    Icons.cloud_upload_outlined,
                    color: AppColors.primary,
                    size: 24,
                  ),
                ),
                AppSpacing.hGapMd,
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Upload materials',
                        style:
                            Theme.of(context).textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.primary,
                                ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'PDF, PPTX, DOCX, or ZIP',
                        style:
                            Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: widget.isDark
                                      ? AppColors.darkTextTertiary
                                      : AppColors.textTertiary,
                                ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashed border painter
// ─────────────────────────────────────────────────────────────────────────────

class _DashedBorderPainter extends CustomPainter {
  final Color color;
  final double radius;
  final double strokeWidth;
  final double dashLength;
  final double gapLength;

  _DashedBorderPainter({
    required this.color,
    required this.radius,
    required this.strokeWidth,
    required this.dashLength,
    required this.gapLength,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(radius),
    );

    final path = Path()..addRRect(rrect);
    final metrics = path.computeMetrics();

    for (final metric in metrics) {
      double distance = 0;
      while (distance < metric.length) {
        final end = math.min(distance + dashLength, metric.length);
        final extractPath = metric.extractPath(distance, end);
        canvas.drawPath(extractPath, paint);
        distance = end + gapLength;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter old) =>
      color != old.color ||
      radius != old.radius ||
      strokeWidth != old.strokeWidth;
}

// ─────────────────────────────────────────────────────────────────────────────
// Course section (unchanged business logic)
// ─────────────────────────────────────────────────────────────────────────────

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
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.note_add_outlined,
                      size: 18,
                      color: isDark
                          ? AppColors.darkTextTertiary
                          : AppColors.textTertiary,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'No files uploaded yet',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
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
