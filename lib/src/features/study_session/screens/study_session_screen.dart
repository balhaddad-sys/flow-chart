import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdfrx/pdfrx.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
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
    final isTablet = MediaQuery.of(context).size.width > 600;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          session.isPaused ? 'Paused' : 'Study Session',
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
    return Row(
      children: [
        Expanded(
          flex: 65,
          child: _PdfViewerPanel(sectionId: widget.sectionId),
        ),
        Container(
          width: 1,
          color: AppColors.divider,
        ),
        Expanded(
          flex: 35,
          child: ActiveLearningPanel(sectionId: widget.sectionId),
        ),
      ],
    );
  }

  Widget _phoneLayout(BuildContext context) {
    return Column(
      children: [
        Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            border: Border(
              bottom: BorderSide(color: AppColors.divider),
            ),
          ),
          child: TabBar(
            controller: _tabController,
            tabs: const [
              Tab(
                icon: Icon(Icons.picture_as_pdf_rounded),
                text: 'PDF',
              ),
              Tab(
                icon: Icon(Icons.lightbulb_outline_rounded),
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

class _PdfViewerPanel extends ConsumerWidget {
  final String sectionId;

  const _PdfViewerPanel({required this.sectionId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uid = ref.watch(uidProvider);
    if (uid == null) {
      return const Center(child: Text('Not authenticated'));
    }

    final sectionAsync = ref.watch(sectionForSessionProvider(sectionId));

    return sectionAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
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
                child: const Icon(Icons.error_outline_rounded,
                    color: AppColors.error, size: 28),
              ),
              AppSpacing.gapMd,
              Text(
                'Could not load PDF',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              AppSpacing.gapSm,
              Text(
                '$e',
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
      data: (section) {
        if (section == null) {
          return const Center(child: Text('Section not found'));
        }

        final pdfUrlAsync =
            ref.watch(pdfDownloadUrlProvider(section.fileId));

        return pdfUrlAsync.when(
          loading: () => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(),
                AppSpacing.gapMd,
                Text(
                  'Loading PDF...',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          error: (e, _) => Center(
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
                    child: const Icon(Icons.cloud_off_rounded,
                        color: AppColors.error, size: 28),
                  ),
                  AppSpacing.gapMd,
                  Text(
                    'Failed to load file',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  AppSpacing.gapSm,
                  Text(
                    '$e',
                    style: Theme.of(context).textTheme.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
          data: (url) {
            if (url == null) {
              return const Center(child: Text('PDF not available'));
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
