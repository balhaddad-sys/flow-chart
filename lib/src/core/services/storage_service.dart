import 'dart:io';

import 'package:firebase_storage/firebase_storage.dart';
import 'package:file_picker/file_picker.dart';

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

  /// Pick a file from the device.
  Future<PlatformFile?> pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: supportedExtensions,
      allowMultiple: false,
    );
    return result?.files.firstOrNull;
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
    if (file.path != null) {
      uploadTask = ref.putFile(File(file.path!), metadata);
    } else if (file.bytes != null) {
      uploadTask = ref.putData(file.bytes!, metadata);
    } else {
      throw Exception('File has no path or bytes');
    }

    if (onProgress != null) {
      uploadTask.snapshotEvents.listen((event) {
        final progress = event.bytesTransferred / event.totalBytes;
        onProgress(progress);
      });
    }

    await uploadTask;
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
