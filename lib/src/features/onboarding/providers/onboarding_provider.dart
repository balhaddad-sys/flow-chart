import 'package:flutter_riverpod/flutter_riverpod.dart';

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
  });

  OnboardingData copyWith({
    int? currentStep,
    String? courseTitle,
    DateTime? examDate,
    String? examType,
    int? dailyMinutes,
    String? revisionPolicy,
    String? pomodoroStyle,
    bool? isSubmitting,
    String? errorMessage,
  }) {
    return OnboardingData(
      currentStep: currentStep ?? this.currentStep,
      courseTitle: courseTitle ?? this.courseTitle,
      examDate: examDate ?? this.examDate,
      examType: examType ?? this.examType,
      dailyMinutes: dailyMinutes ?? this.dailyMinutes,
      revisionPolicy: revisionPolicy ?? this.revisionPolicy,
      pomodoroStyle: pomodoroStyle ?? this.pomodoroStyle,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage: errorMessage,
    );
  }
}

class OnboardingNotifier extends StateNotifier<OnboardingData> {
  OnboardingNotifier() : super(const OnboardingData());

  void setCourseTitle(String title) {
    state = state.copyWith(courseTitle: title);
  }

  void setExamDate(DateTime date) {
    state = state.copyWith(examDate: date);
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

  void nextStep() {
    state = state.copyWith(currentStep: state.currentStep + 1);
  }

  void previousStep() {
    if (state.currentStep > 0) {
      state = state.copyWith(currentStep: state.currentStep - 1);
    }
  }

  void setSubmitting(bool value) {
    state = state.copyWith(isSubmitting: value);
  }

  void setError(String? message) {
    state = state.copyWith(errorMessage: message, isSubmitting: false);
  }
}

final onboardingProvider =
    StateNotifierProvider<OnboardingNotifier, OnboardingData>((ref) {
  return OnboardingNotifier();
});
