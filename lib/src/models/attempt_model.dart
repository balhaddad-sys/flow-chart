import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

import '../core/utils/json_converters.dart';
import 'user_model.dart';

part 'attempt_model.freezed.dart';
part 'attempt_model.g.dart';

@freezed
class AttemptModel with _$AttemptModel {
  const factory AttemptModel({
    @SafeStringConverter() required String id,
    @SafeStringConverter() required String questionId,
    @SafeStringConverter() required String courseId,
    @SafeNullableStringConverter() String? taskId,
    @SafeIntConverter() required int answeredIndex,
    @SafeBoolConverter() required bool correct,
    @SafeIntConverter() required int timeSpentSec,
    @SafeNullableIntConverter() int? confidence,
    Map<String, dynamic>? tutorResponseCached,
    @TimestampConverter() DateTime? createdAt,
  }) = _AttemptModel;

  factory AttemptModel.fromJson(Map<String, dynamic> json) =>
      _$AttemptModelFromJson(json);

  factory AttemptModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return AttemptModel.fromJson({...data, 'id': doc.id});
  }
}
