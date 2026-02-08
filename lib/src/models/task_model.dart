import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

import 'user_model.dart';

part 'task_model.freezed.dart';
part 'task_model.g.dart';

@freezed
class TimeWindow with _$TimeWindow {
  const factory TimeWindow({
    @TimestampConverter() DateTime? earliest,
    @TimestampConverter() DateTime? latest,
  }) = _TimeWindow;

  factory TimeWindow.fromJson(Map<String, dynamic> json) =>
      _$TimeWindowFromJson(json);
}

@freezed
class TaskModel with _$TaskModel {
  const factory TaskModel({
    required String id,
    required String courseId,
    required String type,
    required String title,
    @Default([]) List<String> sectionIds,
    @Default([]) List<String> topicTags,
    @Default(15) int estMinutes,
    int? actualMinutes,
    @Default(3) int difficulty,
    @TimestampConverter() required DateTime dueDate,
    TimeWindow? timeWindow,
    @Default('TODO') String status,
    @TimestampConverter() DateTime? completedAt,
    @Default(false) bool isPinned,
    @Default(0) int priority,
    @Default(0) int orderIndex,
    String? parentTaskId,
    String? linkedQuestionSetId,
    @TimestampConverter() DateTime? createdAt,
  }) = _TaskModel;

  factory TaskModel.fromJson(Map<String, dynamic> json) =>
      _$TaskModelFromJson(json);

  factory TaskModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return TaskModel.fromJson({...data, 'id': doc.id});
  }
}
