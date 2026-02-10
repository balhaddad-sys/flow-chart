import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/services/storage_service.dart';
import '../providers/onboarding_provider.dart';

class UploadStep extends ConsumerStatefulWidget {
  const UploadStep({super.key});

  @override
  ConsumerState<UploadStep> createState() => _UploadStepState();
}

class _UploadStepState extends ConsumerState<UploadStep> {
  bool _isPickingFile = false;
  String? _statusMessage;
  bool _isError = false;

  Future<void> _pickFile() async {
    setState(() {
      _isPickingFile = true;
      _statusMessage = 'Opening file picker...';
      _isError = false;
    });
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.any,
        allowMultiple: false,
        withData: true,
      );

      if (result == null || result.files.isEmpty) {
        setState(() {
          _statusMessage = null;
          _isPickingFile = false;
        });
        return;
      }

      final file = result.files.first;
      final ext = file.extension?.toLowerCase();

      if (ext == null ||
          !StorageService.supportedExtensions.contains(ext)) {
        setState(() {
          _statusMessage =
              'Unsupported file type: .${ext ?? 'unknown'}. '
              'Please select a PDF, PPTX, DOCX, or ZIP file.';
          _isError = true;
          _isPickingFile = false;
        });
        return;
      }

      ref.read(onboardingProvider.notifier).addFile(file);
      setState(() {
        _statusMessage = '${file.name} added';
        _isError = false;
        _isPickingFile = false;
      });
    } catch (e) {
      setState(() {
        _statusMessage = 'Error: $e';
        _isError = true;
        _isPickingFile = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedFiles = ref.watch(onboardingProvider).selectedFiles;

    return Padding(
      padding: AppSpacing.screenPadding,
      child: ListView(
        children: [
          AppSpacing.gapLg,
          Container(
            width: 56,
            height: 56,
            decoration: const BoxDecoration(
              color: AppColors.successSurface,
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            ),
            child: const Icon(Icons.cloud_upload_rounded,
                color: AppColors.success, size: 28),
          ),
          AppSpacing.gapMd,
          Text(
            'Upload your study materials',
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          AppSpacing.gapXs,
          Text(
            'PDF, PowerPoint, Word, or ZIP files',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
          AppSpacing.gapXl,

          // Upload area
          InkWell(
            onTap: _isPickingFile ? null : _pickFile,
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(
                  vertical: AppSpacing.xxl, horizontal: AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppColors.primarySurface.withValues(alpha: 0.5),
                borderRadius:
                    BorderRadius.circular(AppSpacing.radiusLg),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.3),
                  width: 2,
                  strokeAlign: BorderSide.strokeAlignInside,
                ),
              ),
              child: Column(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: const BoxDecoration(
                      color: AppColors.primarySurface,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      _isPickingFile
                          ? Icons.hourglass_top_rounded
                          : Icons.cloud_upload_outlined,
                      color: AppColors.primary,
                      size: 24,
                    ),
                  ),
                  AppSpacing.gapMd,
                  Text(
                    _isPickingFile
                        ? 'Opening file picker...'
                        : 'Tap to select files',
                    style:
                        Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                  ),
                  AppSpacing.gapXs,
                  Text(
                    'PDF, PPTX, DOCX, ZIP (max 100MB)',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textTertiary,
                        ),
                  ),
                ],
              ),
            ),
          ),

          if (_statusMessage != null) ...[
            AppSpacing.gapMd,
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: _isError
                    ? AppColors.errorSurface
                    : AppColors.successSurface,
                borderRadius:
                    BorderRadius.circular(AppSpacing.radiusSm),
              ),
              child: Row(
                children: [
                  Icon(
                    _isError
                        ? Icons.error_outline_rounded
                        : Icons.check_circle_outline_rounded,
                    color: _isError ? AppColors.error : AppColors.success,
                    size: 18,
                  ),
                  AppSpacing.hGapSm,
                  Expanded(
                    child: Text(
                      _statusMessage!,
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(
                            color: _isError
                                ? AppColors.error
                                : AppColors.success,
                          ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          AppSpacing.gapLg,

          // Selected files list
          if (selectedFiles.isNotEmpty) ...[
            Text(
              'Selected files',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
            AppSpacing.gapSm,
            ...selectedFiles.map((file) {
              return Container(
                margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusMd),
                  border: Border.all(
                      color: AppColors.border.withValues(alpha: 0.7)),
                  boxShadow: AppSpacing.shadowSm,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: const BoxDecoration(
                        color: AppColors.primarySurface,
                        borderRadius: BorderRadius.circular(
                            AppSpacing.radiusSm),
                      ),
                      child: const Icon(Icons.insert_drive_file_rounded,
                          color: AppColors.primary, size: 18),
                    ),
                    AppSpacing.hGapSm,
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            file.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .titleSmall,
                          ),
                          Text(
                            '${(file.size / 1024).toStringAsFixed(0)} KB',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                  color: AppColors.textTertiary,
                                ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded,
                          size: 18, color: AppColors.textTertiary),
                      onPressed: () {
                        ref
                            .read(onboardingProvider.notifier)
                            .removeFile(file.name);
                      },
                    ),
                  ],
                ),
              );
            }),
          ],

          if (selectedFiles.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.lg),
              child: Text(
                'You can also upload files later from the Library',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textTertiary,
                    ),
                textAlign: TextAlign.center,
              ),
            ),
        ],
      ),
    );
  }
}
