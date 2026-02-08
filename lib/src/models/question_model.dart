import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

import 'user_model.dart';

part 'question_model.freezed.dart';
part 'question_model.g.dart';

@freezed
class QuestionExplanation with _$QuestionExplanation {
  const factory QuestionExplanation({
    required String correctWhy,
    @Default([]) List<String> whyOthersWrong,
    required String keyTakeaway,
  }) = _QuestionExplanation;

  factory QuestionExplanation.fromJson(Map<String, dynamic> json) =>
      _$QuestionExplanationFromJson(json);
}

@freezed
class QuestionSourceRef with _$QuestionSourceRef {
  const factory QuestionSourceRef({
    required String fileId,
    required String sectionId,
    required String label,
  }) = _QuestionSourceRef;

  factory QuestionSourceRef.fromJson(Map<String, dynamic> json) =>
      _$QuestionSourceRefFromJson(json);
}

@freezed
class QuestionStats with _$QuestionStats {
  const factory QuestionStats({
    @Default(0) int timesAnswered,
    @Default(0) int timesCorrect,
    @Default(0.0) double avgTimeSec,
  }) = _QuestionStats;

  factory QuestionStats.fromJson(Map<String, dynamic> json) =>
      _$QuestionStatsFromJson(json);
}

@freezed
class QuestionModel with _$QuestionModel {
  const factory QuestionModel({
    required String id,
    required String courseId,
    required String sectionId,
    @Default([]) List<String> topicTags,
    @Default(3) int difficulty,
    @Default('SBA') String type,
    required String stem,
    @Default([]) List<String> options,
    required int correctIndex,
    required QuestionExplanation explanation,
    required QuestionSourceRef sourceRef,
    @Default(QuestionStats()) QuestionStats stats,
    @TimestampConverter() DateTime? createdAt,
  }) = _QuestionModel;

  factory QuestionModel.fromJson(Map<String, dynamic> json) =>
      _$QuestionModelFromJson(json);

  factory QuestionModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return QuestionModel.fromJson({...data, 'id': doc.id});
  }
}
