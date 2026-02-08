import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

import 'user_model.dart';

part 'stats_model.freezed.dart';
part 'stats_model.g.dart';

@freezed
class WeakTopic with _$WeakTopic {
  const factory WeakTopic({
    required String tag,
    required double weaknessScore,
    required double accuracy,
  }) = _WeakTopic;

  factory WeakTopic.fromJson(Map<String, dynamic> json) =>
      _$WeakTopicFromJson(json);
}

@freezed
class StatsModel with _$StatsModel {
  const factory StatsModel({
    required String courseId,
    @Default(0) int totalStudyMinutes,
    @Default(0) int totalQuestionsAnswered,
    @Default(0.0) double overallAccuracy,
    @Default(0) int weeklyStudyMinutes,
    @Default(0.0) double completionPercent,
    @Default([]) List<WeakTopic> weakestTopics,
    @Default(0) int streakDays,
    @TimestampConverter() DateTime? lastStudiedAt,
    @TimestampConverter() DateTime? updatedAt,
  }) = _StatsModel;

  factory StatsModel.fromJson(Map<String, dynamic> json) =>
      _$StatsModelFromJson(json);

  factory StatsModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return StatsModel.fromJson({...data, 'courseId': doc.id});
  }
}
