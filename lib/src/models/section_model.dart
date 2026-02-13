import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

import 'user_model.dart';

part 'section_model.freezed.dart';
part 'section_model.g.dart';

@freezed
class ContentRef with _$ContentRef {
  const factory ContentRef({
    required String type,
    required int startIndex,
    required int endIndex,
  }) = _ContentRef;

  factory ContentRef.fromJson(Map<String, dynamic> json) =>
      _$ContentRefFromJson(json);
}

@freezed
class SectionBlueprint with _$SectionBlueprint {
  const factory SectionBlueprint({
    @Default([]) List<String> learningObjectives,
    @Default([]) List<String> keyConcepts,
    @Default([]) List<String> highYieldPoints,
    @Default([]) List<String> commonTraps,
    @Default([]) List<String> termsToDefine,
  }) = _SectionBlueprint;

  factory SectionBlueprint.fromJson(Map<String, dynamic> json) =>
      _$SectionBlueprintFromJson(json);
}

@freezed
class SectionModel with _$SectionModel {
  const factory SectionModel({
    required String id,
    required String fileId,
    required String courseId,
    required String title,
    required ContentRef contentRef,
    required String textBlobPath,
    @Default(0) int textSizeBytes,
    @Default(15) int estMinutes,
    @Default(3) int difficulty,
    @Default([]) List<String> topicTags,
    SectionBlueprint? blueprint,
    @Default('PENDING') String aiStatus,
    @Default('PENDING') String questionsStatus,
    @Default(0) int questionsCount,
    String? questionsErrorMessage,
    @TimestampConverter() DateTime? lastErrorAt,
    @Default(0) int orderIndex,
    @TimestampConverter() DateTime? createdAt,
  }) = _SectionModel;

  factory SectionModel.fromJson(Map<String, dynamic> json) =>
      _$SectionModelFromJson(json);

  factory SectionModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    // Handle legacy data: add missing fields with defaults
    return SectionModel.fromJson({
      ...data,
      'id': doc.id,
      'questionsStatus': data['questionsStatus'] ?? 'PENDING',
      'questionsCount': data['questionsCount'] ?? 0,
      // questionsErrorMessage and lastErrorAt are nullable, no default needed
    });
  }
}
