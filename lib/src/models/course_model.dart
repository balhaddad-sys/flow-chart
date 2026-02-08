import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

import 'user_model.dart';

part 'course_model.freezed.dart';
part 'course_model.g.dart';

@freezed
class CourseAvailability with _$CourseAvailability {
  const factory CourseAvailability({
    int? monday,
    int? tuesday,
    int? wednesday,
    int? thursday,
    int? friday,
    int? saturday,
    int? sunday,
    @Default([]) List<String> excludedDates,
  }) = _CourseAvailability;

  factory CourseAvailability.fromJson(Map<String, dynamic> json) =>
      _$CourseAvailabilityFromJson(json);
}

@freezed
class CourseModel with _$CourseModel {
  const factory CourseModel({
    required String id,
    required String title,
    @TimestampConverter() DateTime? examDate,
    String? examType,
    @Default([]) List<String> tags,
    @Default(CourseAvailability()) CourseAvailability availability,
    @Default('ACTIVE') String status,
    @TimestampConverter() DateTime? createdAt,
  }) = _CourseModel;

  factory CourseModel.fromJson(Map<String, dynamic> json) =>
      _$CourseModelFromJson(json);

  factory CourseModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return CourseModel.fromJson({...data, 'id': doc.id});
  }
}
