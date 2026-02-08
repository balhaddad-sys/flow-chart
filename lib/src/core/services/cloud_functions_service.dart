import 'package:cloud_functions/cloud_functions.dart';

/// Wrapper around Firebase Cloud Functions callable endpoints.
/// All functions follow the response contract:
///   Success: { "success": true, "data": { ... } }
///   Error:   { "success": false, "error": { "code": "...", "message": "..." } }
class CloudFunctionsService {
  final FirebaseFunctions _functions = FirebaseFunctions.instance;

  Future<Map<String, dynamic>> _call(
    String name,
    Map<String, dynamic> data,
  ) async {
    final callable = _functions.httpsCallable(name);
    final result = await callable.call<Map<String, dynamic>>(data);
    final response = Map<String, dynamic>.from(result.data);
    if (response['success'] != true) {
      final error = response['error'] as Map<String, dynamic>?;
      throw CloudFunctionException(
        code: error?['code'] as String? ?? 'UNKNOWN',
        message: error?['message'] as String? ?? 'Unknown error',
      );
    }
    return Map<String, dynamic>.from(response['data'] as Map);
  }

  // --- Course ---

  Future<Map<String, dynamic>> createCourse({
    required String title,
    String? examDate,
    String? examType,
  }) {
    return _call('createCourse', {
      'title': title,
      if (examDate != null) 'examDate': examDate,
      if (examType != null) 'examType': examType,
    });
  }

  // --- Schedule ---

  Future<Map<String, dynamic>> generatePlan({
    required String courseId,
    required Map<String, dynamic> availability,
    required String revisionPolicy,
  }) {
    return _call('generatePlan', {
      'courseId': courseId,
      'availability': availability,
      'revisionPolicy': revisionPolicy,
    });
  }

  Future<Map<String, dynamic>> regenSchedule({
    required String courseId,
    bool keepCompleted = true,
  }) {
    return _call('regenSchedule', {
      'courseId': courseId,
      'keepCompleted': keepCompleted,
    });
  }

  // --- Quiz ---

  Future<Map<String, dynamic>> getQuiz({
    required String courseId,
    String? sectionId,
    String? topicTag,
    required String mode,
    int count = 10,
  }) {
    return _call('getQuiz', {
      'courseId': courseId,
      if (sectionId != null) 'sectionId': sectionId,
      if (topicTag != null) 'topicTag': topicTag,
      'mode': mode,
      'count': count,
    });
  }

  Future<Map<String, dynamic>> submitAttempt({
    required String questionId,
    required int answerIndex,
    required int timeSpentSec,
    int? confidence,
  }) {
    return _call('submitAttempt', {
      'questionId': questionId,
      'answerIndex': answerIndex,
      'timeSpentSec': timeSpentSec,
      if (confidence != null) 'confidence': confidence,
    });
  }

  // --- Tutor ---

  Future<Map<String, dynamic>> getTutorHelp({
    required String questionId,
    required String attemptId,
  }) {
    return _call('getTutorHelp', {
      'questionId': questionId,
      'attemptId': attemptId,
    });
  }

  // --- Fix Plan ---

  Future<Map<String, dynamic>> runFixPlan({required String courseId}) {
    return _call('runFixPlan', {'courseId': courseId});
  }
}

class CloudFunctionException implements Exception {
  final String code;
  final String message;

  const CloudFunctionException({
    required this.code,
    required this.message,
  });

  @override
  String toString() => 'CloudFunctionException($code): $message';
}
