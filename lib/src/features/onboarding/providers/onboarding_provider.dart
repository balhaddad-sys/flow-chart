import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/services/storage_service.dart';
import '../../../core/utils/error_handler.dart';

/// Sentinel to distinguish "set to null" from "not provided" in copyWith.
class _Absent {
  const _Absent();
}

const _absent = _Absent();
const _uuid = Uuid();

class OnboardingData {
  final int currentStep;
  final String courseTitle;
  final DateTime? examDate;
  final String? examType;
  final int dailyMinutes;
  final String revisionPolicy;
  final String pomodoroStyle;
  final bool isSubmitting;
  final String? errorMessage;
  final String? createdCourseId;
  final List<PlatformFile> selectedFiles;

  const OnboardingData({
    this.currentStep = 0,
    this.courseTitle = '',
    this.examDate,
    this.examType,
    this.dailyMinutes = 120,
    this.revisionPolicy = 'standard',
    this.pomodoroStyle = '25/5',
    this.isSubmitting = false,
    this.errorMessage,
    this.createdCourseId,
    this.selectedFiles = const [],
  });

  OnboardingData copyWith({
    int? currentStep,
    String? courseTitle,
    Object? examDate = _absent,
    Object? examType = _absent,
    int? dailyMinutes,
    String? revisionPolicy,
    String? pomodoroStyle,
    bool? isSubmitting,
    Object? errorMessage = _absent,
    Object? createdCourseId = _absent,
    List<PlatformFile>? selectedFiles,
  }) {
    return OnboardingData(
      currentStep: currentStep ?? this.currentStep,
      courseTitle: courseTitle ?? this.courseTitle,
      examDate: examDate is _Absent ? this.examDate : examDate as DateTime?,
      examType: examType is _Absent ? this.examType : examType as String?,
      dailyMinutes: dailyMinutes ?? this.dailyMinutes,
      revisionPolicy: revisionPolicy ?? this.revisionPolicy,
      pomodoroStyle: pomodoroStyle ?? this.pomodoroStyle,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage:
          errorMessage is _Absent ? this.errorMessage : errorMessage as String?,
      createdCourseId: createdCourseId is _Absent
          ? this.createdCourseId
          : createdCourseId as String?,
      selectedFiles: selectedFiles ?? this.selectedFiles,
    );
  }
}

class OnboardingNotifier extends StateNotifier<OnboardingData> {
  final Ref _ref;

  OnboardingNotifier(this._ref) : super(const OnboardingData());

  void reset() {
    state = const OnboardingData();
  }

  void setCourseTitle(String title) {
    state = state.copyWith(courseTitle: title);
  }

  void setExamDate(DateTime date) {
    state = state.copyWith(examDate: date);
  }

  void clearExamDate() {
    state = state.copyWith(examDate: null);
  }

  void setExamType(String type) {
    state = state.copyWith(examType: type);
  }

  void setDailyMinutes(int minutes) {
    state = state.copyWith(dailyMinutes: minutes);
  }

  void setRevisionPolicy(String policy) {
    state = state.copyWith(revisionPolicy: policy);
  }

  void setPomodoroStyle(String style) {
    state = state.copyWith(pomodoroStyle: style);
  }

  void addFile(PlatformFile file) {
    state = state.copyWith(
      selectedFiles: [...state.selectedFiles, file],
    );
  }

  void removeFile(String fileName) {
    state = state.copyWith(
      selectedFiles:
          state.selectedFiles.where((f) => f.name != fileName).toList(),
    );
  }

  void nextStep() {
    state = state.copyWith(currentStep: state.currentStep + 1);
  }

  void previousStep() {
    if (state.currentStep > 0) {
      state = state.copyWith(currentStep: state.currentStep - 1);
    }
  }

  /// Create the course, upload files, and generate the study schedule.
  Future<bool> finishOnboarding() async {
    if (state.courseTitle.trim().isEmpty) {
      state = state.copyWith(errorMessage: 'Course title is required');
      return false;
    }

    state = state.copyWith(isSubmitting: true, errorMessage: null);

    try {
      final uid = _ref.read(uidProvider);
      if (uid == null) throw Exception('Not authenticated');

      final firestoreService = _ref.read(firestoreServiceProvider);
      final storageService = StorageService();

      // 1. Create the course
      final courseId = await firestoreService.createCourse(uid, {
        'title': state.courseTitle.trim(),
        if (state.examDate != null) 'examDate': state.examDate,
        if (state.examType != null) 'examType': state.examType,
        'status': 'ACTIVE',
        'tags': <String>[],
        'availability': {
          'defaultMinutesPerDay': state.dailyMinutes,
          'excludedDates': <String>[],
        },
      });

      // 2. Upload files and create file docs in Firestore
      for (final file in state.selectedFiles) {
        final fileId = _uuid.v4();
        final storagePath = await storageService.uploadFile(
          uid: uid,
          fileId: fileId,
          file: file,
        );

        await firestoreService.createFile(uid, {
          'courseId': courseId,
          'originalName': file.name,
          'storagePath': storagePath,
          'sizeBytes': file.size,
          'contentType':
              StorageService.mimeTypes[file.extension] ??
              'application/octet-stream',
          'status': 'UPLOADED',
        });
      }

      // 3. Update user preferences
      await firestoreService.updateUser(uid, {
        'preferences': {
          'pomodoroStyle': state.pomodoroStyle,
          'revisionPolicy': state.revisionPolicy,
          'dailyMinutesDefault': state.dailyMinutes,
        },
      });

      // 4. Generate the study schedule
      final functionsService = _ref.read(cloudFunctionsServiceProvider);
      await functionsService.generateSchedule(
        courseId: courseId,
        availability: {
          'defaultMinutesPerDay': state.dailyMinutes,
          'excludedDates': <String>[],
        },
        revisionPolicy: state.revisionPolicy,
      );

      state = state.copyWith(
        isSubmitting: false,
        createdCourseId: courseId,
      );
      return true;
    } catch (e) {
      ErrorHandler.logError(e);
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: ErrorHandler.userMessage(e),
      );
      return false;
    }
  }
}

final onboardingProvider =
    StateNotifierProvider<OnboardingNotifier, OnboardingData>((ref) {
  return OnboardingNotifier(ref);
});
