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
          Text(
            'Upload your study materials',
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          AppSpacing.gapSm,
          Text(
            'PDF, PowerPoint, Word, or ZIP files',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          AppSpacing.gapXl,
          // Upload button — using OutlinedButton for reliable web taps
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _isPickingFile ? null : _pickFile,
              icon: Icon(
                Icons.cloud_upload_outlined,
                size: 32,
                color: _isPickingFile
                    ? AppColors.textTertiary
                    : AppColors.primary,
              ),
              label: Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
                child: Column(
                  children: [
                    Text(
                      _isPickingFile
                          ? 'Opening file picker...'
                          : 'Tap to select files',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'PDF, PPTX, DOCX, ZIP (max 100MB)',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: AppColors.border, width: 2),
                shape: RoundedRectangleBorder(
                  borderRadius:
                      BorderRadius.circular(AppSpacing.radiusLg),
                ),
                padding: const EdgeInsets.all(AppSpacing.lg),
              ),
            ),
          ),
          if (_statusMessage != null) ...[
            AppSpacing.gapMd,
            Text(
              _statusMessage!,
              style: TextStyle(
                color: _isError ? AppColors.error : AppColors.success,
                fontSize: 13,
              ),
            ),
          ],
          AppSpacing.gapLg,
          // Selected files list
          if (selectedFiles.isNotEmpty) ...[
            Text(
              'Selected files',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            AppSpacing.gapSm,
            ...selectedFiles.map((file) {
              return ListTile(
                leading: const Icon(Icons.insert_drive_file_outlined),
                title: Text(file.name),
                subtitle: Text(
                  '${(file.size / 1024).toStringAsFixed(0)} KB',
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: () {
                    ref
                        .read(onboardingProvider.notifier)
                        .removeFile(file.name);
                  },
                ),
              );
            }),
          ],
          if (selectedFiles.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.lg),
              child: Text(
                'You can also upload files later from the Library',
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
            ),
        ],
      ),
    );
  }
}
