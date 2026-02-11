import 'package:firebase_storage/firebase_storage.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

class StorageService {
  final FirebaseStorage _storage = FirebaseStorage.instance;

  static const List<String> supportedExtensions = [
    'pdf',
    'pptx',
    'docx',
    'zip',
  ];

  static const Map<String, String> mimeTypes = {
    'pdf': 'application/pdf',
    'pptx':
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'zip': 'application/zip',
  };

  /// Maximum file size in bytes (100 MB — matches storage.rules).
  static const int maxFileSizeBytes = 100 * 1024 * 1024;

  /// Pick a file from the device.
  Future<PlatformFile?> pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.any,
      allowMultiple: false,
      withData: true,
    );
    if (result == null || result.files.isEmpty) return null;

    final file = result.files.first;
    final ext = file.extension?.toLowerCase();

    // Validate extension client-side
    if (ext == null || !supportedExtensions.contains(ext)) {
      throw UnsupportedError(
        'Unsupported file type: .${ext ?? 'unknown'}. '
        'Please select a PDF, PPTX, DOCX, or ZIP file.',
      );
    }

    // Validate file size client-side
    if (file.size > maxFileSizeBytes) {
      throw UnsupportedError(
        'File too large (${(file.size / 1024 / 1024).toStringAsFixed(1)} MB). '
        'Maximum size is ${maxFileSizeBytes ~/ 1024 ~/ 1024} MB.',
      );
    }

    return file;
  }

  /// Upload a file to Cloud Storage under the user's uploads directory.
  /// Returns the storage path on success.
  Future<String> uploadFile({
    required String uid,
    required String fileId,
    required PlatformFile file,
    void Function(double progress)? onProgress,
  }) async {
    final ext = file.extension ?? 'bin';
    final storagePath = 'users/$uid/uploads/$fileId.$ext';
    final ref = _storage.ref(storagePath);

    final metadata = SettableMetadata(
      contentType: mimeTypes[ext] ?? 'application/octet-stream',
      customMetadata: {
        'originalName': file.name,
        'uploadedBy': uid,
      },
    );

    late final UploadTask uploadTask;
    if (file.bytes != null) {
      // Works on all platforms including web
      uploadTask = ref.putData(file.bytes!, metadata);
    } else if (!kIsWeb && file.path != null) {
      // Native-only fallback using dart:io via conditional import
      // For web-only builds, bytes should always be available
      // since we set withData: true in pickFile.
      throw Exception(
        'File bytes not available. Ensure withData is true when picking files.',
      );
    } else {
      throw Exception('File has no bytes available for upload');
    }

    if (onProgress != null) {
      double lastReported = -1;
      final subscription = uploadTask.snapshotEvents.listen((event) {
        if (event.totalBytes > 0) {
          final progress = event.bytesTransferred / event.totalBytes;
          // Throttle: only report if progress changed by >= 1%
          if ((progress - lastReported).abs() >= 0.01 || progress >= 1.0) {
            lastReported = progress;
            onProgress(progress);
          }
        }
      });
      try {
        await uploadTask;
      } finally {
        await subscription.cancel();
      }
    } else {
      await uploadTask;
    }
    return storagePath;
  }

  /// Get a download URL for a file.
  Future<String> getDownloadUrl(String storagePath) async {
    return _storage.ref(storagePath).getDownloadURL();
  }

  /// Delete a file from Cloud Storage.
  Future<void> deleteFile(String storagePath) async {
    await _storage.ref(storagePath).delete();
  }
}
