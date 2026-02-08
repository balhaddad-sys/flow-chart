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
  final _storageService = StorageService();
  bool _isPickingFile = false;

  String? _errorMessage;

  Future<void> _pickFile() async {
    setState(() {
      _isPickingFile = true;
      _errorMessage = null;
    });
    try {
      final file = await _storageService.pickFile();
      if (file != null) {
        ref.read(onboardingProvider.notifier).addFile(file);
      }
    } on UnsupportedError catch (e) {
      setState(() => _errorMessage = e.message);
    } catch (e) {
      setState(() => _errorMessage = 'Failed to pick file: $e');
    } finally {
      setState(() => _isPickingFile = false);
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
          // Upload zone
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: _isPickingFile ? null : _pickFile,
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.xxl),
                decoration: BoxDecoration(
                  border: Border.all(
                    color: AppColors.border,
                    width: 2,
                    strokeAlign: BorderSide.strokeAlignInside,
                  ),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                ),
                child: Column(
                  children: [
                    Icon(
                      Icons.cloud_upload_outlined,
                      size: 48,
                      color: _isPickingFile
                          ? AppColors.textTertiary
                          : AppColors.primary,
                    ),
                    AppSpacing.gapMd,
                    Text(
                      _isPickingFile ? 'Selecting...' : 'Tap to select files',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    AppSpacing.gapXs,
                    Text(
                      'PDF, PPTX, DOCX, ZIP (max 100MB)',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (_errorMessage != null) ...[
            AppSpacing.gapMd,
            Text(
              _errorMessage!,
              style: TextStyle(color: AppColors.error, fontSize: 13),
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
