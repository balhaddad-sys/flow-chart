import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

import '../core/utils/json_converters.dart';
import 'user_model.dart';

part 'question_model.freezed.dart';
part 'question_model.g.dart';

@freezed
class QuestionExplanation with _$QuestionExplanation {
  const factory QuestionExplanation({
    @SafeStringConverter() @Default('') String correctWhy,
    @SafeStringListConverter() @Default([]) List<String> whyOthersWrong,
    @SafeStringConverter() @Default('') String keyTakeaway,
  }) = _QuestionExplanation;

  factory QuestionExplanation.fromJson(Map<String, dynamic> json) =>
      _$QuestionExplanationFromJson(json);
}

@freezed
class QuestionSourceRef with _$QuestionSourceRef {
  const factory QuestionSourceRef({
    @SafeStringConverter() @Default('') String fileId,
    @SafeStringConverter() @Default('') String sectionId,
    @SafeStringConverter() @Default('') String label,
  }) = _QuestionSourceRef;

  factory QuestionSourceRef.fromJson(Map<String, dynamic> json) =>
      _$QuestionSourceRefFromJson(json);
}

@freezed
class QuestionStats with _$QuestionStats {
  const factory QuestionStats({
    @SafeIntConverter() @Default(0) int timesAnswered,
    @SafeIntConverter() @Default(0) int timesCorrect,
    @SafeDoubleConverter() @Default(0.0) double avgTimeSec,
  }) = _QuestionStats;

  factory QuestionStats.fromJson(Map<String, dynamic> json) =>
      _$QuestionStatsFromJson(json);
}

@freezed
class QuestionModel with _$QuestionModel {
  const factory QuestionModel({
    @SafeStringConverter() required String id,
    @SafeStringConverter() required String courseId,
    @SafeStringConverter() required String sectionId,
    @SafeStringListConverter() @Default([]) List<String> topicTags,
    @SafeIntConverter() @Default(3) int difficulty,
    @SafeStringConverter() @Default('SBA') String type,
    @SafeStringConverter() required String stem,
    @SafeStringListConverter() @Default([]) List<String> options,
    @SafeIntConverter() required int correctIndex,
    @Default(QuestionExplanation()) QuestionExplanation explanation,
    @Default(QuestionSourceRef()) QuestionSourceRef sourceRef,
    @Default(QuestionStats()) QuestionStats stats,
    @TimestampConverter() DateTime? createdAt,
  }) = _QuestionModel;

  factory QuestionModel.fromJson(Map<String, dynamic> json) =>
      _$QuestionModelFromJson(json);

  factory QuestionModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return QuestionModel.fromJson({...data, 'id': doc.id});
  }
}
