import 'dart:async';

import 'package:cloud_functions/cloud_functions.dart';

/// Wrapper around Firebase Cloud Functions callable endpoints.
/// All functions follow the response contract:
///   Success: { "success": true, "data": { ... } }
///   Error:   { "success": false, "error": { "code": "...", "message": "..." } }
class CloudFunctionsService {
  final FirebaseFunctions _functions = FirebaseFunctions.instance;
  static const Duration _defaultCallTimeout = Duration(seconds: 45);
  static const Duration _longRunningCallTimeout = Duration(seconds: 180);
  static const Set<String> _longRunningFunctionNames = {
    'generateQuestions',
    'generateSchedule',
    'getTutorHelp',
    'sendChatMessage',
    'exploreQuiz',
    'exploreTopicInsight',
    'generateExamBankQuestions',
    'processDocumentBatch',
  };
  static const int _maxRetries = 2;
  static const int _baseRetryDelayMs = 800;
  static const Set<String> _transientCodes = {
    'unavailable',
    'deadline-exceeded',
    'resource-exhausted',
    'internal',
    'network-request-failed',
  };

  String _normaliseCode(String code) {
    return code.trim().toLowerCase().replaceAll('_', '-');
  }

  bool _isTransientCode(String code) {
    final normalized = _normaliseCode(code);
    return _transientCodes.contains(normalized);
  }

  String _uiCode(String code) {
    return _normaliseCode(code).toUpperCase().replaceAll('-', '_');
  }

  Duration _timeoutFor(String functionName) {
    if (_longRunningFunctionNames.contains(functionName)) {
      return _longRunningCallTimeout;
    }
    return _defaultCallTimeout;
  }

  Future<Map<String, dynamic>> _call(
    String name,
    Map<String, dynamic> data,
  ) async {
    for (var attempt = 0; attempt <= _maxRetries; attempt++) {
      try {
        final callable = _functions.httpsCallable(
          name,
          options: HttpsCallableOptions(timeout: _timeoutFor(name)),
        );
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
          throw CloudFunctionException(code: _uiCode(code), message: message);
        }

        final responseData = response['data'];
        if (responseData is Map) {
          return Map<String, dynamic>.from(responseData);
        }
        return response;
      } on CloudFunctionException catch (error) {
        if (attempt < _maxRetries && _isTransientCode(error.code)) {
          await Future.delayed(
            Duration(milliseconds: _baseRetryDelayMs * (1 << attempt)),
          );
          continue;
        }
        rethrow;
      } on FirebaseFunctionsException catch (error) {
        final code = _normaliseCode(error.code);
        final message = error.message ?? 'Request failed. Please try again.';
        if (attempt < _maxRetries && _isTransientCode(code)) {
          await Future.delayed(
            Duration(milliseconds: _baseRetryDelayMs * (1 << attempt)),
          );
          continue;
        }
        throw CloudFunctionException(
          code: _uiCode(code),
          message: message,
        );
      } on TimeoutException {
        if (attempt < _maxRetries) {
          await Future.delayed(
            Duration(milliseconds: _baseRetryDelayMs * (1 << attempt)),
          );
          continue;
        }
        throw const CloudFunctionException(
          code: 'DEADLINE_EXCEEDED',
          message: 'Request timed out. Please try again.',
        );
      } catch (error) {
        if (attempt < _maxRetries) {
          await Future.delayed(
            Duration(milliseconds: _baseRetryDelayMs * (1 << attempt)),
          );
          continue;
        }
        throw CloudFunctionException(
          code: 'INTERNAL',
          message: 'Unexpected error while calling "$name".',
        );
      }
    }
    throw const CloudFunctionException(
      code: 'INTERNAL',
      message: 'Request failed after retries.',
    );
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
    List<String>? tags,
    Map<String, dynamic>? availability,
  }) {
    return _call('createCourse', {
      'title': title,
      if (examDate != null) 'examDate': examDate,
      if (examType != null) 'examType': examType,
      if (tags != null) 'tags': tags,
      if (availability != null) 'availability': availability,
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

  // --- Catch Up ---

  Future<Map<String, dynamic>> catchUp({required String courseId}) {
    return _call('catchUp', {'courseId': courseId});
  }

  // --- Chat ---

  Future<Map<String, dynamic>> sendChatMessage({
    required String threadId,
    required String message,
    required String courseId,
  }) {
    return _call('sendChatMessage', {
      'threadId': threadId,
      'message': message,
      'courseId': courseId,
    });
  }

  // --- Explore ---

  Future<Map<String, dynamic>> exploreQuiz({
    required String topic,
    required String level,
    int count = 5,
  }) {
    return _call('exploreQuiz', {
      'topic': topic,
      'level': level,
      'count': count,
    });
  }

  Future<Map<String, dynamic>> exploreTopicInsight({
    required String topic,
    required String level,
    String? examType,
  }) {
    return _call('exploreTopicInsight', {
      'topic': topic,
      'level': level,
      if (examType != null) 'examType': examType,
    });
  }

  // --- Exam Bank ---

  Future<Map<String, dynamic>> generateExamBankQuestions({
    required String examType,
    int count = 10,
  }) {
    return _call('generateExamBankQuestions', {
      'examType': examType,
      'count': count,
    });
  }

  // --- Assessment ---

  Future<Map<String, dynamic>> getAssessmentCatalog() {
    return _call('getAssessmentCatalog', {});
  }

  Future<Map<String, dynamic>> startAssessmentSession({
    required String assessmentId,
    required String courseId,
  }) {
    return _call('startAssessmentSession', {
      'assessmentId': assessmentId,
      'courseId': courseId,
    });
  }

  Future<Map<String, dynamic>> submitAssessmentAnswer({
    required String sessionId,
    required String questionId,
    required int answerIndex,
  }) {
    return _call('submitAssessmentAnswer', {
      'sessionId': sessionId,
      'questionId': questionId,
      'answerIndex': answerIndex,
    });
  }

  Future<Map<String, dynamic>> finishAssessmentSession({
    required String sessionId,
  }) {
    return _call('finishAssessmentSession', {'sessionId': sessionId});
  }

  // --- Flag / Moderation ---

  Future<Map<String, dynamic>> flagQuestion({
    required String questionId,
    String? reason,
  }) {
    return _call('flagQuestion', {
      'questionId': questionId,
      if (reason != null) 'reason': reason,
    });
  }

  // --- File / Deck ---

  Future<Map<String, dynamic>> deleteFile({required String fileId}) {
    return _call('deleteFile', {'fileId': fileId});
  }

  Future<Map<String, dynamic>> seedSampleDeck() {
    return _call('seedSampleDeck', {});
  }

  // --- Account ---

  Future<Map<String, dynamic>> deleteUserData() {
    return _call('deleteUserData', {});
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
