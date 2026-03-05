import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/user_model.dart';
import '../services/cloud_functions_service.dart';
import '../services/firestore_service.dart';
import 'auth_provider.dart';

final firestoreServiceProvider = Provider<FirestoreService>((ref) {
  return FirestoreService();
});

final cloudFunctionsServiceProvider =
    Provider<CloudFunctionsService>((ref) {
  return CloudFunctionsService();
});

final userModelProvider = StreamProvider<UserModel?>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Stream.value(null);
  final firestoreService = ref.watch(firestoreServiceProvider);
  return firestoreService.streamUser(uid);
});
