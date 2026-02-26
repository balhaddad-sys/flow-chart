import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../models/section_model.dart';

final courseSectionsProvider =
    StreamProvider.family<List<SectionModel>, String>((ref, courseId) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return const Stream.empty();
  return ref
      .watch(firestoreServiceProvider)
      .watchSectionsByCourse(uid, courseId);
});
