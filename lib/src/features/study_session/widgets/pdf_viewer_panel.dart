import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdfrx/pdfrx.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/services/storage_service.dart';

/// Resolves a download URL for a section's source file.
final _pdfUrlProvider =
    FutureProvider.family<String?, String>((ref, sectionId) async {
  final uid = ref.watch(uidProvider);
  if (uid == null) return null;

  final firestoreService = ref.watch(firestoreServiceProvider);
  final sections = await firestoreService
      .getSection(uid, sectionId: sectionId);
  if (sections == null) return null;

  final storageService = StorageService();
  // Resolve the file's storage path via the file document
  final file = await firestoreService.getFile(uid, fileId: sections.fileId);
  if (file == null) return null;

  return storageService.getDownloadUrl(file.storagePath);
});

class PdfViewerPanel extends ConsumerWidget {
  final String sectionId;

  const PdfViewerPanel({super.key, required this.sectionId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final urlAsync = ref.watch(_pdfUrlProvider(sectionId));

    return urlAsync.when(
      loading: () => const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: AppSpacing.md),
            Text('Loading document...'),
          ],
        ),
      ),
      error: (e, _) => Center(
        child: Padding(
          padding: AppSpacing.cardPadding,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline,
                  color: AppColors.error, size: 48),
              const SizedBox(height: AppSpacing.md),
              Text(
                'Could not load document',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                '$e',
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
      data: (url) {
        if (url == null) {
          return const Center(
            child: Text('No document available for this section'),
          );
        }

        return PdfViewer.uri(
          Uri.parse(url),
          params: const PdfViewerParams(
            enableTextSelection: true,
            backgroundColor: AppColors.surfaceVariant,
          ),
        );
      },
    );
  }
}
