import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../providers/session_provider.dart';
import '../widgets/active_learning_panel.dart';
import '../widgets/pdf_viewer_panel.dart';
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
    final isWide = MediaQuery.of(context).size.width > 700;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Study Session'),
        actions: [
          SessionTimer(elapsedSeconds: session.elapsedSeconds),
        ],
        bottom: isWide
            ? null
            : TabBar(
                controller: _tabController,
                tabs: const [
                  Tab(icon: Icon(Icons.picture_as_pdf), text: 'Document'),
                  Tab(icon: Icon(Icons.auto_awesome), text: 'Key Points'),
                ],
              ),
      ),
      body: isWide
          ? _wideLayout()
          : TabBarView(
              controller: _tabController,
              children: [
                PdfViewerPanel(sectionId: widget.sectionId),
                ActiveLearningPanel(sectionId: widget.sectionId),
              ],
            ),
      bottomNavigationBar: SessionControls(
        taskId: widget.taskId,
        sectionId: widget.sectionId,
      ),
    );
  }

  Widget _wideLayout() {
    return Row(
      children: [
        // PDF viewer (65%)
        Expanded(
          flex: 65,
          child: PdfViewerPanel(sectionId: widget.sectionId),
        ),
        // Active learning panel (35%)
        Expanded(
          flex: 35,
          child: Container(
            decoration: const BoxDecoration(
              border: Border(
                left: BorderSide(color: AppColors.border),
              ),
            ),
            child: ActiveLearningPanel(sectionId: widget.sectionId),
          ),
        ),
      ],
    );
  }
}
