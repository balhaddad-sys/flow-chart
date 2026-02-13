import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

import '../core/utils/json_converters.dart';
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
    @SafeStringConverter() required String id,
    @SafeStringConverter() required String courseId,
    @SafeStringConverter() required String type,
    @SafeStringConverter() required String title,
    @SafeStringListConverter() @Default([]) List<String> sectionIds,
    @SafeStringListConverter() @Default([]) List<String> topicTags,
    @SafeIntConverter() @Default(15) int estMinutes,
    @SafeNullableIntConverter() int? actualMinutes,
    @SafeIntConverter() @Default(3) int difficulty,
    @TimestampConverter() required DateTime dueDate,
    TimeWindow? timeWindow,
    @SafeStringConverter() @Default('TODO') String status,
    @TimestampConverter() DateTime? completedAt,
    @SafeBoolConverter() @Default(false) bool isPinned,
    @SafeIntConverter() @Default(0) int priority,
    @SafeIntConverter() @Default(0) int orderIndex,
    @SafeNullableStringConverter() String? parentTaskId,
    @SafeNullableStringConverter() String? linkedQuestionSetId,
    @TimestampConverter() DateTime? createdAt,
  }) = _TaskModel;

  factory TaskModel.fromJson(Map<String, dynamic> json) =>
      _$TaskModelFromJson(json);

  factory TaskModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return TaskModel.fromJson({...data, 'id': doc.id});
  }
}
