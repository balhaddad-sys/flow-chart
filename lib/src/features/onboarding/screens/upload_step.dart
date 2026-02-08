import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/services/storage_service.dart';

class UploadStep extends ConsumerStatefulWidget {
  const UploadStep({super.key});

  @override
  ConsumerState<UploadStep> createState() => _UploadStepState();
}

class _UploadStepState extends ConsumerState<UploadStep> {
  final _storageService = StorageService();
  final List<String> _selectedFiles = [];
  bool _isPickingFile = false;

  Future<void> _pickFile() async {
    setState(() => _isPickingFile = true);
    try {
      final file = await _storageService.pickFile();
      if (file != null) {
        setState(() => _selectedFiles.add(file.name));
      }
    } finally {
      setState(() => _isPickingFile = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
          InkWell(
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
          AppSpacing.gapLg,
          // Selected files list
          if (_selectedFiles.isNotEmpty) ...[
            Text(
              'Selected files',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            AppSpacing.gapSm,
            ..._selectedFiles.map((name) {
              return ListTile(
                leading: const Icon(Icons.insert_drive_file_outlined),
                title: Text(name),
                trailing: IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: () {
                    setState(() => _selectedFiles.remove(name));
                  },
                ),
              );
            }),
          ],
          if (_selectedFiles.isEmpty)
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
