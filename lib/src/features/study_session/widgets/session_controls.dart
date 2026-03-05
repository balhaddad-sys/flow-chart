import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final sectionAsync = ref.watch(sectionForSessionProvider(sectionId));
    final questionsStatus =
        sectionAsync.whenData((s) => s?.questionsStatus).value ?? 'PENDING';
    final isQuizReady = questionsStatus == 'COMPLETED';
    final isQuizGenerating = questionsStatus == 'GENERATING';

    // Quiz button config
    IconData quizIcon;
    String quizLabel;
    Color quizColor;
    VoidCallback? quizOnPressed;

    if (isQuizReady) {
      quizIcon = Icons.quiz_rounded;
      quizLabel = 'Quiz';
      quizColor = AppColors.secondary;
      quizOnPressed = () {
        ref.read(sessionProvider.notifier).moveToQuiz();
        final courseId = sectionAsync.whenData((s) => s?.courseId).value;
        final query = courseId != null ? '?courseId=$courseId' : '';
        GoRouter.of(context).push('/quiz/$sectionId$query');
      };
    } else if (isQuizGenerating) {
      quizIcon = Icons.hourglass_top_rounded;
      quizLabel = 'Generating';
      quizColor = AppColors.warning;
      quizOnPressed = () {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Questions are being generated. Please wait...')),
        );
      };
    } else if (questionsStatus == 'FAILED') {
      quizIcon = Icons.refresh_rounded;
      quizLabel = 'Retry Quiz';
      quizColor = AppColors.error;
      quizOnPressed = () {
        ref.read(sessionProvider.notifier).moveToQuiz();
        final courseId = sectionAsync.whenData((s) => s?.courseId).value;
        final query = courseId != null ? '?courseId=$courseId' : '';
        GoRouter.of(context).push('/quiz/$sectionId$query');
      };
    } else {
      // PENDING
      quizIcon = Icons.lock_outline_rounded;
      quizLabel = 'Not Ready';
      quizColor = isDark ? AppColors.darkTextTertiary : AppColors.textTertiary;
      quizOnPressed = () {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Questions will be available after section analysis.'),
          ),
        );
      };
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        border: Border(
          top: BorderSide(
            color: isDark ? AppColors.darkDivider : AppColors.divider,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.06),
            blurRadius: 12,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            // Complete button (primary action)
            Expanded(
              flex: 2,
              child: _ActionButton(
                icon: Icons.check_circle_rounded,
                label: 'Complete',
                color: AppColors.success,
                isDark: isDark,
                isPrimary: true,
                onPressed: () {
                  final uid = ref.read(uidProvider);
                  if (uid != null) {
                    // Record actual minutes spent
                    final actualMinutes =
                        (session.elapsedSeconds / 60).ceil();
                    ref.read(firestoreServiceProvider).updateTask(
                      uid,
                      taskId,
                      {'actualMinutes': actualMinutes},
                    );
                    ref
                        .read(firestoreServiceProvider)
                        .completeTask(uid, taskId);
                  }
                  ref.read(sessionProvider.notifier).completeSession();
                  context.pop();
                },
              ),
            ),
            const SizedBox(width: 8),
            // Quiz
            Expanded(
              child: _ActionButton(
                icon: quizIcon,
                label: quizLabel,
                color: quizColor,
                isDark: isDark,
                onPressed: quizOnPressed,
              ),
            ),
            const SizedBox(width: 8),
            // Pause / Resume
            Expanded(
              child: _ActionButton(
                icon: session.isPaused
                    ? Icons.play_arrow_rounded
                    : Icons.pause_rounded,
                label: session.isPaused ? 'Resume' : 'Pause',
                color: AppColors.info,
                isDark: isDark,
                onPressed: () {
                  if (session.isPaused) {
                    ref.read(sessionProvider.notifier).resumeSession();
                  } else {
                    ref.read(sessionProvider.notifier).pauseSession();
                  }
                },
              ),
            ),
            const SizedBox(width: 8),
            // Reschedule
            Expanded(
              child: _ActionButton(
                icon: Icons.schedule_rounded,
                label: 'Later',
                color: AppColors.warning,
                isDark: isDark,
                onPressed: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate:
                        DateTime.now().add(const Duration(days: 1)),
                    firstDate: DateTime.now(),
                    lastDate:
                        DateTime.now().add(const Duration(days: 365)),
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
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final bool isDark;
  final bool isPrimary;
  final VoidCallback? onPressed;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.isDark,
    this.isPrimary = false,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    if (isPrimary) {
      return Material(
        color: color,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: Colors.white, size: 20),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Material(
      color: color.withValues(alpha: isDark ? 0.12 : 0.08),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: color, size: 22),
              const SizedBox(height: 3),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
