import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

import 'user_model.dart';

part 'attempt_model.freezed.dart';
part 'attempt_model.g.dart';

@freezed
class AttemptModel with _$AttemptModel {
  const factory AttemptModel({
    required String id,
    required String questionId,
    required String courseId,
    String? taskId,
    required int answeredIndex,
    required bool correct,
    required int timeSpentSec,
    int? confidence,
    Map<String, dynamic>? tutorResponseCached,
    @TimestampConverter() DateTime? createdAt,
  }) = _AttemptModel;

  factory AttemptModel.fromJson(Map<String, dynamic> json) =>
      _$AttemptModelFromJson(json);

  factory AttemptModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return AttemptModel.fromJson({...data, 'id': doc.id});
  }
}
