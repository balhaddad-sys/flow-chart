import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pdfrx/pdfrx.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/error_banner.dart';
import '../../../core/widgets/error_state_view.dart';
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
    final sectionAsync = ref.watch(sectionForSessionProvider(widget.sectionId));
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isTablet = MediaQuery.of(context).size.width > 600;

    final sectionTitle = sectionAsync.whenData((s) => s?.title).value;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: isDark ? AppColors.darkSurface : AppColors.surface,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              session.isPaused ? 'Paused' : 'Study Session',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            if (sectionTitle != null && sectionTitle.isNotEmpty)
              Text(
                sectionTitle,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: isDark
                          ? AppColors.darkTextTertiary
                          : AppColors.textTertiary,
                    ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
        actions: [
          SessionTimer(elapsedSeconds: session.elapsedSeconds),
          const SizedBox(width: 4),
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
            labelColor: AppColors.primary,
            unselectedLabelColor:
                isDark ? AppColors.darkTextTertiary : AppColors.textTertiary,
            indicatorColor: AppColors.primary,
            indicatorWeight: 3,
            indicatorSize: TabBarIndicatorSize.label,
            labelStyle: const TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
            tabs: const [
              Tab(
                icon: Icon(Icons.auto_awesome_rounded, size: 20),
                text: 'Study Guide',
              ),
              Tab(
                icon: Icon(Icons.picture_as_pdf_rounded, size: 20),
                text: 'PDF',
              ),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              ActiveLearningPanel(sectionId: widget.sectionId),
              _PdfViewerPanel(sectionId: widget.sectionId),
            ],
          ),
        ),
      ],
    );
  }
}

class _PdfViewerPanel extends ConsumerStatefulWidget {
  final String sectionId;

  const _PdfViewerPanel({required this.sectionId});

  @override
  ConsumerState<_PdfViewerPanel> createState() => _PdfViewerPanelState();
}

class _PdfViewerPanelState extends ConsumerState<_PdfViewerPanel> {
  final _controller = PdfViewerController();
  final _currentPage = ValueNotifier<int>(0);
  bool _clamping = false;

  @override
  void dispose() {
    _currentPage.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(uidProvider);
    if (uid == null) {
      return const Center(child: Text('Not authenticated'));
    }

    final sectionAsync =
        ref.watch(sectionForSessionProvider(widget.sectionId));
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return sectionAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorStateView(
        error: e,
        customMessage: ErrorHandler.userMessage(e),
      ),
      data: (section) {
        if (section == null) {
          return const Center(child: Text('Section not found'));
        }

        final pdfUrlAsync =
            ref.watch(pdfDownloadUrlProvider(section.fileId));

        final startPage = section.contentRef.startIndex;
        final endPage = section.contentRef.endIndex;

        return pdfUrlAsync.when(
          loading: () => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(),
                AppSpacing.gapMd,
                Text('Loading PDF...',
                    style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
          error: (e, _) => Center(
            child: ErrorBanner(message: ErrorHandler.userMessage(e)),
          ),
          data: (url) {
            if (url == null) {
              return const Center(child: Text('PDF not available'));
            }
            return Stack(
              children: [
                PdfViewer.uri(
                  Uri.parse(url),
                  controller: _controller,
                  params: PdfViewerParams(
                    enableTextSelection: true,
                    maxScale: 5.0,
                    onViewerReady: (document, controller) async {
                      if (startPage > 0 &&
                          startPage <= document.pages.length) {
                        await Future.delayed(
                            const Duration(milliseconds: 300));
                        controller.goToPage(pageNumber: startPage);
                        _currentPage.value = startPage;
                      }
                    },
                    onPageChanged: (pageNumber) {
                      if (pageNumber == null || _clamping) return;
                      _currentPage.value = pageNumber;
                      // Clamp to section's page range
                      if (startPage > 0 && endPage > 0 &&
                          (pageNumber < startPage || pageNumber > endPage)) {
                        _clamping = true;
                        final target = pageNumber < startPage
                            ? startPage
                            : endPage;
                        _controller.goToPage(pageNumber: target).then((_) {
                          _clamping = false;
                        });
                      }
                    },
                  ),
                ),
                // Page indicator — only this rebuilds on page change
                if (startPage > 0 || endPage > 0)
                  Positioned(
                    bottom: 12,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: ValueListenableBuilder<int>(
                        valueListenable: _currentPage,
                        builder: (context, page, _) => Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 7),
                          decoration: BoxDecoration(
                            color: (isDark
                                    ? AppColors.darkSurface
                                    : AppColors.surface)
                                .withValues(alpha: 0.92),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isDark
                                  ? AppColors.darkBorder
                                  : AppColors.border,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color:
                                    Colors.black.withValues(alpha: 0.1),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.auto_stories_rounded,
                                size: 14,
                                color: AppColors.primary,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                startPage == endPage
                                    ? 'Page $startPage'
                                    : 'Page $page of $startPage–$endPage',
                                style: TextStyle(
                                  color: isDark
                                      ? AppColors.darkTextPrimary
                                      : AppColors.textPrimary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            );
          },
        );
      },
    );
  }
}
