import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../models/file_model.dart';
import '../../../models/section_model.dart';

final filesProvider =
    StreamProvider.family<List<FileModel>, String>((ref, courseId) {
  ref.keepAlive();
  final uid = ref.watch(uidProvider);
  if (uid == null) return const Stream.empty();
  return ref.watch(firestoreServiceProvider).watchFiles(uid, courseId: courseId);
});

final sectionsProvider =
    StreamProvider.family<List<SectionModel>, String>((ref, fileId) {
  ref.keepAlive();
  final uid = ref.watch(uidProvider);
  if (uid == null) return const Stream.empty();
  return ref
      .watch(firestoreServiceProvider)
      .watchSections(uid, fileId: fileId);
});
