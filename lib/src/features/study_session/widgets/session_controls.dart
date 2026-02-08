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
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _ControlButton(
              icon: Icons.check_circle,
              label: 'Complete',
              color: AppColors.success,
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
              icon: Icons.quiz,
              label: 'Questions',
              color: AppColors.secondary,
              onPressed: () {
                ref.read(sessionProvider.notifier).moveToQuiz();
                context.push('/quiz/$sectionId');
              },
            ),
            _ControlButton(
              icon: session.isPaused ? Icons.play_arrow : Icons.pause,
              label: session.isPaused ? 'Resume' : 'Pause',
              color: AppColors.info,
              onPressed: () {
                if (session.isPaused) {
                  ref.read(sessionProvider.notifier).resumeSession();
                } else {
                  ref.read(sessionProvider.notifier).pauseSession();
                }
              },
            ),
            _ControlButton(
              icon: Icons.schedule,
              label: 'Reschedule',
              color: AppColors.warning,
              onPressed: () {
                // TODO(medq): Implement reschedule
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
  final VoidCallback onPressed;

  const _ControlButton({
    required this.icon,
    required this.label,
    required this.color,
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
            Icon(icon, color: color),
            AppSpacing.gapXs,
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: color,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
