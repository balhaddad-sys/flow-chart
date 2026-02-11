import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../providers/session_provider.dart';

class SessionControls extends ConsumerWidget {
  final String taskId;
  final String sectionId;

  const SessionControls({
    super.key,
    required this.taskId,
    required this.sectionId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: const Border(top: BorderSide(color: AppColors.divider)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _ControlButton(
              icon: Icons.check_circle_rounded,
              label: 'Complete',
              color: AppColors.success,
              bgColor: AppColors.successSurface,
              onPressed: () {
                final uid = ref.read(uidProvider);
                if (uid != null) {
                  ref
                      .read(firestoreServiceProvider)
                      .completeTask(uid, taskId);
                }
                ref.read(sessionProvider.notifier).completeSession();
                context.pop();
              },
            ),
            _ControlButton(
              icon: Icons.quiz_rounded,
              label: 'Questions',
              color: AppColors.secondary,
              bgColor: AppColors.secondarySurface,
              onPressed: () {
                ref.read(sessionProvider.notifier).moveToQuiz();
                context.push('/quiz/$sectionId');
              },
            ),
            _ControlButton(
              icon: session.isPaused
                  ? Icons.play_arrow_rounded
                  : Icons.pause_rounded,
              label: session.isPaused ? 'Resume' : 'Pause',
              color: AppColors.info,
              bgColor: AppColors.infoSurface,
              onPressed: () {
                if (session.isPaused) {
                  ref.read(sessionProvider.notifier).resumeSession();
                } else {
                  ref.read(sessionProvider.notifier).pauseSession();
                }
              },
            ),
            _ControlButton(
              icon: Icons.schedule_rounded,
              label: 'Reschedule',
              color: AppColors.warning,
              bgColor: AppColors.warningSurface,
              onPressed: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: DateTime.now().add(const Duration(days: 1)),
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (picked != null) {
                  final uid = ref.read(uidProvider);
                  if (uid != null) {
                    await ref.read(firestoreServiceProvider).updateTask(
                      uid,
                      taskId,
                      {'dueDate': picked, 'status': 'TODO'},
                    );
                  }
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Task rescheduled')),
                    );
                    context.pop();
                  }
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final Color bgColor;
  final VoidCallback onPressed;

  const _ControlButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.bgColor,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            AppSpacing.gapXs,
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
