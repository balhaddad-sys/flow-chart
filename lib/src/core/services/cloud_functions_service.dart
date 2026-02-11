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
    final result = await callable.call(data);

    final dynamic raw = result.data;
    Map<String, dynamic> response;

    if (raw is Map) {
      response = Map<String, dynamic>.from(raw);
    } else if (raw is String) {
      throw CloudFunctionException(
        code: 'INVALID_RESPONSE',
        message: raw,
      );
    } else {
      throw CloudFunctionException(
        code: 'INVALID_RESPONSE',
        message: 'Unexpected response type: ${raw.runtimeType}',
      );
    }

    if (response['success'] != true) {
      final error = response['error'];
      String code = 'UNKNOWN';
      String message = 'Unknown error';
      if (error is Map) {
        code = error['code']?.toString() ?? code;
        message = error['message']?.toString() ?? message;
      } else if (error is String) {
        message = error;
      }
      throw CloudFunctionException(code: code, message: message);
    }

    final responseData = response['data'];
    if (responseData is Map) {
      return Map<String, dynamic>.from(responseData);
    }
    return response;
  }

  /// Generic public callable for one-off function invocations (e.g. deleteUserData).
  Future<Map<String, dynamic>> call(
    String name,
    Map<String, dynamic> data,
  ) {
    return _call(name, data);
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

  Future<Map<String, dynamic>> generateSchedule({
    required String courseId,
    required Map<String, dynamic> availability,
    required String revisionPolicy,
  }) {
    return _call('generateSchedule', {
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

  // --- Questions ---

  Future<Map<String, dynamic>> generateQuestions({
    required String courseId,
    required String sectionId,
    int count = 10,
  }) {
    return _call('generateQuestions', {
      'courseId': courseId,
      'sectionId': sectionId,
      'count': count,
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

  // --- Document Batch Processing ---

  /// Process multiple page images in parallel via Claude vision.
  ///
  /// [imagesBase64] - List of base64-encoded page images (JPEG).
  /// [concurrency] - Optional parallel request limit (1-12, default 8).
  ///
  /// Returns: { results: [...], pages: [...], failures: [...], meta: {...} }
  Future<Map<String, dynamic>> processDocumentBatch({
    required List<String> imagesBase64,
    int? concurrency,
  }) {
    return _call('processDocumentBatch', {
      'images': imagesBase64,
      if (concurrency != null) 'concurrency': concurrency,
    });
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
