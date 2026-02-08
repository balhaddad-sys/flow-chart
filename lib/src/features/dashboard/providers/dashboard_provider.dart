import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/user_provider.dart';
import '../../../core/utils/error_handler.dart';

class FixPlanState {
  final Map<String, dynamic>? fixPlan;
  final bool isLoading;
  final String? errorMessage;

  const FixPlanState({
    this.fixPlan,
    this.isLoading = false,
    this.errorMessage,
  });

  FixPlanState copyWith({
    Map<String, dynamic>? fixPlan,
    bool? isLoading,
    String? errorMessage,
  }) {
    return FixPlanState(
      fixPlan: fixPlan ?? this.fixPlan,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

class FixPlanNotifier extends StateNotifier<FixPlanState> {
  final Ref _ref;

  FixPlanNotifier(this._ref) : super(const FixPlanState());

  Future<void> generateFixPlan(String courseId) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final functionsService = _ref.read(cloudFunctionsServiceProvider);
      final result =
          await functionsService.runFixPlan(courseId: courseId);
      state = state.copyWith(fixPlan: result, isLoading: false);
    } catch (e) {
      ErrorHandler.logError(e);
      state = state.copyWith(
        isLoading: false,
        errorMessage: ErrorHandler.userMessage(e),
      );
    }
  }
}

final fixPlanProvider =
    StateNotifierProvider<FixPlanNotifier, FixPlanState>((ref) {
  return FixPlanNotifier(ref);
});
