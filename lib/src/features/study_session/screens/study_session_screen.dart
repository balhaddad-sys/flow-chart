// FILE: lib/src/features/study_session/screens/study_session_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdfrx/pdfrx.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/utils/error_handler.dart';
import '../providers/session_provider.dart';
import '../widgets/active_learning_panel.dart';
import '../widgets/session_timer.dart';
import '../widgets/session_controls.dart';

class StudySessionScreen extends ConsumerStatefulWidget {
  final String taskId;
  final String sectionId;

  const StudySessionScreen({
    super.key,
    required this.taskId,
    required this.sectionId,
  });

  @override
  ConsumerState<StudySessionScreen> createState() =>
      _StudySessionScreenState();
}

class _StudySessionScreenState extends ConsumerState<StudySessionScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(sessionProvider.notifier).startSession(
            taskId: widget.taskId,
            sectionId: widget.sectionId,
          );
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isTablet = MediaQuery.of(context).size.width > 600;

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.background,
        title: AnimatedSwitcher(
          duration: AppSpacing.animFast,
          child: Text(
            session.isPaused ? 'Paused' : 'Study Session',
            key: ValueKey(session.isPaused),
          ),
        ),
        actions: [
          SessionTimer(elapsedSeconds: session.elapsedSeconds),
        ],
      ),
      body: isTablet ? _tabletLayout(context) : _phoneLayout(context),
      bottomNavigationBar: SessionControls(
        taskId: widget.taskId,
        sectionId: widget.sectionId,
      ),
    );
  }

  Widget _tabletLayout(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Row(
      children: [
        Expanded(
          flex: 65,
          child: _PdfViewerPanel(sectionId: widget.sectionId),
        ),
        Container(
          width: 1,
          color: isDark ? AppColors.darkDivider : AppColors.divider,
        ),
        Expanded(
          flex: 35,
          child: ActiveLearningPanel(sectionId: widget.sectionId),
        ),
      ],
    );
  }

  Widget _phoneLayout(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      children: [
        Container(
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkSurface : AppColors.surface,
            border: Border(
              bottom: BorderSide(
                color: isDark ? AppColors.darkDivider : AppColors.divider,
              ),
            ),
          ),
          child: TabBar(
            controller: _tabController,
            indicatorColor: AppColors.primary,
            labelColor: AppColors.primary,
            unselectedLabelColor: isDark
                ? AppColors.darkTextSecondary
                : AppColors.textSecondary,
            tabs: const [
              Tab(
                icon: Icon(Icons.picture_as_pdf_rounded, size: 18),
                text: 'PDF',
              ),
              Tab(
                icon: Icon(Icons.lightbulb_outline_rounded, size: 18),
                text: 'Study Guide',
              ),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _PdfViewerPanel(sectionId: widget.sectionId),
              ActiveLearningPanel(sectionId: widget.sectionId),
            ],
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF viewer panel
// ─────────────────────────────────────────────────────────────────────────────

class _PdfViewerPanel extends ConsumerWidget {
  final String sectionId;

  const _PdfViewerPanel({required this.sectionId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uid = ref.watch(uidProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (uid == null) {
      return const Center(child: Text('Not authenticated'));
    }

    final sectionAsync = ref.watch(sectionForSessionProvider(sectionId));

    return sectionAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, st) {
        ErrorHandler.logError(e, st);
        return _ErrorPanel(
          icon: Icons.error_outline_rounded,
          title: 'Could not load section',
          subtitle: 'Failed to load section data. Please try again.',
          isDark: isDark,
        );
      },
      data: (section) {
        if (section == null) {
          return _ErrorPanel(
            icon: Icons.search_off_rounded,
            title: 'Section not found',
            subtitle: 'This section may have been removed.',
            isDark: isDark,
          );
        }

        final pdfUrlAsync =
            ref.watch(pdfDownloadUrlProvider(section.fileId));

        return pdfUrlAsync.when(
          loading: () => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(color: AppColors.primary),
                AppSpacing.gapMd,
                Text(
                  'Loading PDF...',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          error: (e, st) {
            ErrorHandler.logError(e, st);
            return _ErrorPanel(
              icon: Icons.cloud_off_rounded,
              title: 'Failed to load file',
              subtitle: 'Could not retrieve the PDF. Check your connection.',
              isDark: isDark,
            );
          },
          data: (url) {
            if (url == null || url.isEmpty) {
              return _ErrorPanel(
                icon: Icons.picture_as_pdf_outlined,
                title: 'PDF not available',
                subtitle: 'The file has not finished processing yet.',
                isDark: isDark,
              );
            }
            return PdfViewer.uri(
              Uri.parse(url),
              params: const PdfViewerParams(
                enableTextSelection: true,
                maxScale: 5.0,
              ),
            );
          },
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Error panel
// ─────────────────────────────────────────────────────────────────────────────

class _ErrorPanel extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool isDark;

  const _ErrorPanel({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: AppSpacing.cardPadding,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: const BoxDecoration(
                color: AppColors.errorSurface,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: AppColors.error, size: 26),
            ),
            AppSpacing.gapMd,
            Text(
              title,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
            AppSpacing.gapSm,
            Text(
              subtitle,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
