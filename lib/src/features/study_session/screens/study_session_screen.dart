import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../providers/session_provider.dart';
import '../widgets/session_timer.dart';
import '../widgets/session_controls.dart';

class StudySessionScreen extends ConsumerWidget {
  final String taskId;
  final String sectionId;

  const StudySessionScreen({
    super.key,
    required this.taskId,
    required this.sectionId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final isTablet = MediaQuery.of(context).size.width > 600;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Study Session'),
        actions: [
          SessionTimer(elapsedSeconds: session.elapsedSeconds),
        ],
      ),
      body: isTablet ? _tabletLayout(context) : _phoneLayout(context),
      bottomNavigationBar: SessionControls(
        taskId: taskId,
        sectionId: sectionId,
      ),
    );
  }

  Widget _tabletLayout(BuildContext context) {
    return Row(
      children: [
        // PDF viewer panel (65%)
        Expanded(
          flex: 65,
          child: Container(
            color: AppColors.surfaceVariant,
            child: const Center(
              child: Text('PDF Viewer Panel'),
            ),
          ),
        ),
        // Active learning panel (35%)
        Expanded(
          flex: 35,
          child: Container(
            padding: AppSpacing.cardPadding,
            decoration: const BoxDecoration(
              border: Border(
                left: BorderSide(color: AppColors.border),
              ),
            ),
            child: const Center(
              child: Text('Active Learning Panel'),
            ),
          ),
        ),
      ],
    );
  }

  Widget _phoneLayout(BuildContext context) {
    return Container(
      color: AppColors.surfaceVariant,
      child: const Center(
        child: Text('PDF Viewer (Full Screen)'),
      ),
    );
  }
}
