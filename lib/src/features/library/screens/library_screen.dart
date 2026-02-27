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
import '../../../core/utils/error_handler.dart';
import '../../../core/widgets/empty_state.dart';
import '../../home/providers/home_provider.dart';
import '../providers/library_provider.dart';
import '../widgets/file_card.dart';

const _uuid = Uuid();

// ─────────────────────────────────────────────────────────────────────────────
// Upload state provider — tracks active upload across rebuilds
// ─────────────────────────────────────────────────────────────────────────────

@immutable
class _UploadState {
  final bool isUploading;
  final double progress;
  final String? fileName;

  const _UploadState({
    this.isUploading = false,
    this.progress = 0,
    this.fileName,
  });

  _UploadState copyWith({
    bool? isUploading,
    double? progress,
    String? fileName,
  }) {
    return _UploadState(
      isUploading: isUploading ?? this.isUploading,
      progress: progress ?? this.progress,
      fileName: fileName ?? this.fileName,
    );
  }
}

final _uploadStateProvider =
    StateProvider<_UploadState>((ref) => const _UploadState());

// ─────────────────────────────────────────────────────────────────────────────
// Library Screen
// ─────────────────────────────────────────────────────────────────────────────

class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key});

  Future<void> _uploadFile(BuildContext context, WidgetRef ref) async {
    // Prevent double-tapping
    if (ref.read(_uploadStateProvider).isUploading) return;

    final uid = ref.read(uidProvider);
    if (uid == null) return;

    var activeCourseId = ref.read(activeCourseIdProvider);
    if (activeCourseId == null) {
      final courses = ref.read(coursesProvider).valueOrNull ?? [];
      if (courses.isNotEmpty) {
        activeCourseId = courses.first.id;
        ref.read(activeCourseIdProvider.notifier).state = activeCourseId;
      }
    }
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

      if (ext == null || !StorageService.supportedExtensions.contains(ext)) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Unsupported file type: .${ext ?? 'unknown'}. '
                'Use PDF, PPTX, or DOCX.',
              ),
            ),
          );
        }
        return;
      }

      // Client-side size check
      if (file.size > StorageService.maxFileSizeBytes) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'File too large (${(file.size / 1024 / 1024).toStringAsFixed(1)} MB). '
                'Max is ${StorageService.maxFileSizeBytes ~/ 1024 ~/ 1024} MB.',
              ),
            ),
          );
        }
        return;
      }

      // Start upload — show inline progress
      ref.read(_uploadStateProvider.notifier).state = _UploadState(
        isUploading: true,
        progress: 0,
        fileName: file.name,
      );

      final storageService = StorageService();
      final firestoreService = ref.read(firestoreServiceProvider);
      final fileId = _uuid.v4();
      final storagePath = 'users/$uid/uploads/$fileId.$ext';

      // Create metadata first so the storage trigger can resolve courseId/fileId
      // deterministically from users/{uid}/files/{fileId}.
      await firestoreService.createFile(uid, fileId, {
        'courseId': activeCourseId,
        'originalName': file.name,
        'storagePath': storagePath,
        'sizeBytes': file.size,
        'mimeType':
            StorageService.mimeTypes[ext] ?? 'application/octet-stream',
        'status': 'UPLOADED',
      });

      // Upload to storage with cleanup on failure
      try {
        await storageService.uploadFile(
          uid: uid,
          fileId: fileId,
          file: file,
          onProgress: (p) {
            ref.read(_uploadStateProvider.notifier).state =
                ref.read(_uploadStateProvider).copyWith(progress: p);
          },
        );
      } catch (uploadError) {
        // CRITICAL: Clean up orphan Firestore record if storage upload fails
        try {
          await firestoreService.deleteFile(uid, fileId);
        } catch (cleanupError) {
          // Log cleanup error but don't hide the original upload error
          debugPrint('Cleanup failed: $cleanupError');
        }
        // Re-throw the original upload error to outer catch block
        rethrow;
      }

      ref.read(_uploadStateProvider.notifier).state = const _UploadState();

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content:
                Text('${file.name} uploaded — processing will begin shortly'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      ErrorHandler.logError(e);
      ref.read(_uploadStateProvider.notifier).state = const _UploadState();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Upload failed: $e'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(coursesProvider);
    final uploadState = ref.watch(_uploadStateProvider);
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
                  fileCount: null,
                  isDark: isDark,
                ),
              ),

              // ── Upload Area / Progress ────────────────────────
              SliverPadding(
                padding: AppSpacing.screenHorizontal,
                sliver: SliverToBoxAdapter(
                  child: uploadState.isUploading
                      ? _UploadProgressCard(
                          fileName: uploadState.fileName ?? 'file',
                          progress: uploadState.progress,
                          isDark: isDark,
                        )
                      : _UploadArea(
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
              'Library',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.5,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              'Upload study materials and let AI extract structured sections for quizzing.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                    fontSize: 13,
                    height: 1.5,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload progress card — replaces the upload area while uploading
// ─────────────────────────────────────────────────────────────────────────────

class _UploadProgressCard extends StatelessWidget {
  final String fileName;
  final double progress;
  final bool isDark;

  const _UploadProgressCard({
    required this.fileName,
    required this.progress,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final pct = (progress * 100).toInt();
    final fillColor = isDark
        ? AppColors.primary.withValues(alpha: 0.08)
        : AppColors.primarySubtle;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 20),
      decoration: BoxDecoration(
        color: fillColor,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color:
              AppColors.primary.withValues(alpha: isDark ? 0.3 : 0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  value: progress > 0 ? progress : null,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  fileName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                ),
              ),
              Text(
                '$pct%',
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress > 0 ? progress : null,
              minHeight: 6,
              backgroundColor: isDark
                  ? AppColors.primary.withValues(alpha: 0.15)
                  : AppColors.primary.withValues(alpha: 0.12),
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            progress >= 1.0
                ? 'Saving to library...'
                : 'Uploading — do not close this page',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextTertiary
                      : AppColors.textTertiary,
                ),
          ),
        ],
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
                ? AppColors.primary
                    .withValues(alpha: widget.isDark ? 0.14 : 0.08)
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
                    borderRadius:
                        BorderRadius.circular(AppSpacing.radiusMd),
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
                        'PDF, PPTX, or DOCX (max 100 MB)',
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
              child: const Icon(Icons.folder, color: AppColors.primary,
                  size: 18),
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
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusMd),
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
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(
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
              children:
                  files.map((file) => FileCard(file: file)).toList(),
            );
          },
        ),
        AppSpacing.gapLg,
      ],
    );
  }
}
