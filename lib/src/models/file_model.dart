import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

import 'user_model.dart';

part 'file_model.freezed.dart';
part 'file_model.g.dart';

@freezed
class FileMeta with _$FileMeta {
  const factory FileMeta({
    int? pageCount,
    int? slideCount,
    int? wordCount,
  }) = _FileMeta;

  factory FileMeta.fromJson(Map<String, dynamic> json) =>
      _$FileMetaFromJson(json);
}

@freezed
class FileModel with _$FileModel {
  const factory FileModel({
    required String id,
    required String courseId,
    String? moduleId,
    String? topicId,
    required String originalName,
    required String storagePath,
    required String mimeType,
    required int sizeBytes,
    @Default(FileMeta()) FileMeta meta,
    @Default('UPLOADED') String status,
    String? errorMessage,
    String? processingPhase, // EXTRACTING, ANALYZING, GENERATING_QUESTIONS
    @TimestampConverter() DateTime? processingStartedAt,
    @TimestampConverter() DateTime? processedAt,
    @Default(0) int sectionCount,
    @TimestampConverter() DateTime? uploadedAt,
  }) = _FileModel;

  factory FileModel.fromJson(Map<String, dynamic> json) =>
      _$FileModelFromJson(json);

  factory FileModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return FileModel.fromJson({...data, 'id': doc.id});
  }
}
