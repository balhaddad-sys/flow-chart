import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/widgets/formatted_text.dart';
import '../../home/providers/home_provider.dart';
import '../providers/ai_provider.dart';

// ── AI Screen ─────────────────────────────────────────────────────────────────

class AiScreen extends ConsumerStatefulWidget {
  const AiScreen({super.key});

  @override
  ConsumerState<AiScreen> createState() => _AiScreenState();
}

class _AiScreenState extends ConsumerState<AiScreen> {
  String? _openThreadId;
  String? _openThreadTitle;
  bool _creating = false;

  void _openThread(String threadId, String title) {
    setState(() {
      _openThreadId = threadId;
      _openThreadTitle = title;
    });
  }

  void _closeThread() {
    setState(() {
      _openThreadId = null;
      _openThreadTitle = null;
    });
  }

  Future<void> _createNewThread() async {
    final uid = ref.read(uidProvider);
    final courseId = ref.read(activeCourseIdProvider);
    if (uid == null || _creating) return;
    if (courseId == null || courseId.trim().isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Select an active course before creating a chat.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _creating = true);
    try {
      final threadId = await ref
          .read(firestoreServiceProvider)
          .createChatThread(uid, courseId: courseId, title: 'New conversation');
      _openThread(threadId, 'New conversation');
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to create conversation. Please try again.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_openThreadId != null) {
      return _ChatView(
        threadId: _openThreadId!,
        threadTitle: _openThreadTitle ?? 'AI Chat',
        onBack: _closeThread,
      );
    }
    return _HubView(
      creating: _creating,
      onNewThread: _createNewThread,
      onOpenThread: _openThread,
    );
  }
}

// ── Hub View ─────────────────────────────────────────────────────────────────

class _HubView extends ConsumerStatefulWidget {
  final bool creating;
  final Future<void> Function() onNewThread;
  final void Function(String threadId, String title) onOpenThread;

  const _HubView({
    required this.creating,
    required this.onNewThread,
    required this.onOpenThread,
  });

  @override
  ConsumerState<_HubView> createState() => _HubViewState();
}

class _HubViewState extends ConsumerState<_HubView> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final threadsAsync = ref.watch(chatThreadsProvider);
    final activeCourseId = ref.watch(activeCourseIdProvider);
    final hasActiveCourse =
        activeCourseId != null && activeCourseId.trim().isNotEmpty;

    final threads = threadsAsync.valueOrNull ?? [];
    final query = _searchQuery.trim().toLowerCase();
    final filtered =
        query.isEmpty
            ? threads
            : threads.where((t) {
              final title = (t['title'] as String? ?? '').toLowerCase();
              final last = (t['lastMessage'] as String? ?? '').toLowerCase();
              return title.contains(query) || last.contains(query);
            }).toList();
    final latestThread = threads.isNotEmpty ? threads.first : null;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          children: [
            // ── Header ──────────────────────────────────────────────────────
            Text(
              'AI Chat',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Explore medical topics, ask questions, and get guidance grounded in your study materials.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color:
                    isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                fontSize: 13,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 12),
            if (!hasActiveCourse) ...[
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color:
                      isDark
                          ? AppColors.warning.withValues(alpha: 0.18)
                          : AppColors.warningLight,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  border: Border.all(
                    color: AppColors.warning.withValues(alpha: 0.35),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.info_outline_rounded,
                      size: 16,
                      color: AppColors.warning,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Select an active course first to start AI chat.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color:
                              isDark
                                  ? AppColors.darkTextPrimary
                                  : AppColors.textPrimary,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // ── Action buttons ──────────────────────────────────────────────
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ElevatedButton.icon(
                  onPressed: () => context.go('/ai/explore'),
                  icon: const Icon(Icons.explore_rounded, size: 16),
                  label: const Text('Explore Topic'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                    textStyle: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ),
                OutlinedButton.icon(
                  onPressed:
                      widget.creating || !hasActiveCourse
                          ? null
                          : widget.onNewThread,
                  icon:
                      widget.creating
                          ? SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                              strokeWidth: 1.5,
                              color:
                                  isDark
                                      ? AppColors.darkTextPrimary
                                      : AppColors.textPrimary,
                            ),
                          )
                          : const Icon(Icons.add_rounded, size: 16),
                  label: Text(widget.creating ? 'Creating...' : 'New Chat'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor:
                        isDark
                            ? AppColors.darkTextPrimary
                            : AppColors.textPrimary,
                    side: BorderSide(
                      color: isDark ? AppColors.darkBorder : AppColors.border,
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                    textStyle: const TextStyle(
                      fontWeight: FontWeight.w500,
                      fontSize: 13,
                    ),
                  ),
                ),
                if (latestThread != null)
                  TextButton.icon(
                    onPressed:
                        () => widget.onOpenThread(
                          latestThread['id'] as String,
                          latestThread['title'] as String? ?? 'Chat',
                        ),
                    icon: const Icon(Icons.arrow_forward_rounded, size: 14),
                    label: const Text('Resume latest'),
                    style: TextButton.styleFrom(
                      foregroundColor:
                          isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.textSecondary,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      textStyle: const TextStyle(
                        fontWeight: FontWeight.w500,
                        fontSize: 13,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),

            // ── Search bar ──────────────────────────────────────────────────
            Container(
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.surface,
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                border: Border.all(
                  color: isDark ? AppColors.darkBorder : AppColors.border,
                ),
              ),
              child: Row(
                children: [
                  const SizedBox(width: 12),
                  Icon(
                    Icons.search_rounded,
                    size: 18,
                    color:
                        isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary,
                  ),
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      onChanged: (v) => setState(() => _searchQuery = v),
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Search threads...',
                        hintStyle: TextStyle(
                          color:
                              isDark
                                  ? AppColors.darkTextTertiary
                                  : AppColors.textTertiary,
                          fontSize: 13,
                        ),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 12,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Thread list ─────────────────────────────────────────────────
            threadsAsync.when(
              loading:
                  () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: CircularProgressIndicator()),
                  ),
              error: (_, __) => const SizedBox.shrink(),
              data: (_) {
                if (filtered.isEmpty) {
                  return _EmptyThreads(
                    isDark: isDark,
                    hasSearch: query.isNotEmpty,
                    hasActiveCourse: hasActiveCourse,
                    onNewThread: widget.onNewThread,
                  );
                }
                return _ThreadList(
                  isDark: isDark,
                  threads: filtered,
                  onOpenThread: widget.onOpenThread,
                );
              },
            ),
            const SizedBox(height: 24),

            // ── Feature cards at bottom ──────────────────────────────────────
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _FeatureCard(
                    isDark: isDark,
                    iconColor: AppColors.primary,
                    iconBg: AppColors.primary.withValues(alpha: 0.10),
                    icon: Icons.explore_rounded,
                    title: 'Explore AI Tutor',
                    description:
                        'Generate adaptive quizzes and teaching outlines for any medical topic.',
                    buttonLabel: 'Open Explore',
                    enabled: true,
                    onTap: () async { context.go('/ai/explore'); },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _FeatureCard(
                    isDark: isDark,
                    iconColor: const Color(0xFF7C3AED),
                    iconBg: const Color(0xFF7C3AED).withValues(alpha: 0.10),
                    icon: Icons.chat_bubble_outline_rounded,
                    title: 'Course Chat',
                    description:
                        'Keep persistent conversations tied to your active course.',
                    buttonLabel: 'Create Thread',
                    buttonIcon: Icons.auto_awesome_rounded,
                    enabled: hasActiveCourse,
                    onTap: widget.onNewThread,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Empty threads ─────────────────────────────────────────────────────────────

class _EmptyThreads extends StatelessWidget {
  final bool isDark;
  final bool hasSearch;
  final bool hasActiveCourse;
  final Future<void> Function() onNewThread;

  const _EmptyThreads({
    required this.isDark,
    required this.hasSearch,
    required this.hasActiveCourse,
    required this.onNewThread,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
      ),
      child: Column(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color:
                  isDark
                      ? AppColors.darkSurfaceVariant
                      : AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              Icons.chat_bubble_outline_rounded,
              size: 22,
              color:
                  isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            hasSearch ? 'No threads match your search' : 'No conversations yet',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(
            'Start a new chat to ask AI about your course content.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color:
                  isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
              fontSize: 13,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 14),
          ElevatedButton(
            onPressed: hasActiveCourse ? onNewThread : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              ),
              textStyle: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
            child: const Text('New Chat'),
          ),
        ],
      ),
    );
  }
}

// ── Thread list ───────────────────────────────────────────────────────────────

class _ThreadList extends StatelessWidget {
  final bool isDark;
  final List<Map<String, dynamic>> threads;
  final void Function(String, String) onOpenThread;

  const _ThreadList({
    required this.isDark,
    required this.threads,
    required this.onOpenThread,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children:
          threads
              .map(
                (thread) => _ThreadCard(
                  isDark: isDark,
                  thread: thread,
                  onTap:
                      () => onOpenThread(
                        thread['id'] as String,
                        thread['title'] as String? ?? 'Chat',
                      ),
                ),
              )
              .toList(),
    );
  }
}

class _ThreadCard extends StatelessWidget {
  final bool isDark;
  final Map<String, dynamic> thread;
  final VoidCallback onTap;

  const _ThreadCard({
    required this.isDark,
    required this.thread,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final title = thread['title'] as String? ?? 'Chat';
    final lastMsg = thread['lastMessage'] as String? ?? '';
    final msgCount = thread['messageCount'] as int? ?? 0;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(
            color: isDark ? AppColors.darkBorder : AppColors.border,
          ),
          boxShadow:
              isDark
                  ? null
                  : [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 3,
                      offset: const Offset(0, 1),
                    ),
                  ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 32,
              height: 32,
              margin: const EdgeInsets.only(top: 1),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.chat_bubble_outline_rounded,
                size: 15,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (lastMsg.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      lastMsg,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color:
                            isDark
                                ? AppColors.darkTextTertiary
                                : AppColors.textTertiary,
                        fontSize: 11,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ] else ...[
                    const SizedBox(height: 2),
                    Text(
                      'No messages yet',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color:
                            isDark
                                ? AppColors.darkTextTertiary
                                : AppColors.textTertiary,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.access_time_rounded,
                  size: 10,
                  color:
                      isDark
                          ? AppColors.darkTextTertiary
                          : AppColors.textTertiary,
                ),
                const SizedBox(width: 3),
                Text(
                  '$msgCount',
                  style: TextStyle(
                    fontSize: 10,
                    color:
                        isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Chat View ─────────────────────────────────────────────────────────────────

class _ChatView extends ConsumerStatefulWidget {
  final String threadId;
  final String threadTitle;
  final VoidCallback onBack;

  const _ChatView({
    required this.threadId,
    required this.threadTitle,
    required this.onBack,
  });

  @override
  ConsumerState<_ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends ConsumerState<_ChatView> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  bool _isSending = false;
  String? _errorText;
  String? _pendingUserMessage;

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _sendMessage(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || _isSending) return;
    _controller.clear();

    final uid = ref.read(uidProvider);
    final courseId = ref.read(activeCourseIdProvider);
    if (uid == null) return;
    if (courseId == null || courseId.trim().isEmpty) {
      setState(() {
        _errorText = 'Select an active course before sending messages.';
      });
      return;
    }

    setState(() {
      _isSending = true;
      _pendingUserMessage = trimmed;
      _errorText = null;
    });
    _scrollToBottom();

    try {
      await ref
          .read(cloudFunctionsServiceProvider)
          .sendChatMessage(
            threadId: widget.threadId,
            message: trimmed,
            courseId: courseId,
          );
      if (mounted) {
        setState(() {
          _isSending = false;
          _pendingUserMessage = null;
        });
        _scrollToBottom();
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isSending = false;
          _pendingUserMessage = null;
          _errorText = 'Failed to send. Please try again.';
        });
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final messagesAsync = ref.watch(chatMessagesProvider(widget.threadId));

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.darkSurface : AppColors.surface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: widget.onBack,
        ),
        title: Text(
          widget.threadTitle,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Divider(
            height: 1,
            color: isDark ? AppColors.darkBorder : AppColors.border,
          ),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: messagesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => const SizedBox.shrink(),
              data: (messages) {
                return ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  itemCount:
                      messages.length +
                      (_pendingUserMessage != null ? 1 : 0) +
                      (_isSending ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (_pendingUserMessage != null &&
                        index == messages.length) {
                      return _buildBubble(
                        _pendingUserMessage!,
                        isUser: true,
                        isDark: isDark,
                      );
                    }
                    if (_isSending &&
                        index ==
                            messages.length +
                                (_pendingUserMessage != null ? 1 : 0)) {
                      return _buildTypingIndicator(isDark);
                    }
                    final msg = messages[index];
                    final role = msg['role'] as String? ?? 'user';
                    final content = msg['content'] as String? ?? '';
                    return _buildBubble(
                      content,
                      isUser: role == 'user',
                      isDark: isDark,
                    );
                  },
                );
              },
            ),
          ),
          if (_errorText != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
              child: Text(
                _errorText!,
                style: TextStyle(color: Colors.red[400], fontSize: 12),
              ),
            ),
          _buildInputBar(isDark),
        ],
      ),
    );
  }

  Widget _buildBubble(
    String text, {
    required bool isUser,
    required bool isDark,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment:
            isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isUser) ...[
            Container(
              width: 30,
              height: 30,
              margin: const EdgeInsets.only(right: 8, top: 2),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.auto_awesome_rounded,
                size: 16,
                color: AppColors.primary,
              ),
            ),
          ],
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color:
                    isUser
                        ? AppColors.primary
                        : (isDark ? AppColors.darkSurface : AppColors.surface),
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                border:
                    isUser
                        ? null
                        : Border.all(
                          color:
                              isDark ? AppColors.darkBorder : AppColors.border,
                        ),
              ),
              child: isUser
                  ? Text(
                      text,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white,
                        fontSize: 14,
                        height: 1.5,
                      ),
                    )
                  : FormattedText(
                      text: text,
                      selectable: true,
                      baseStyle: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? AppColors.darkTextPrimary
                            : AppColors.textPrimary,
                        fontSize: 14,
                        height: 1.5,
                      ),
                    ),
            ),
          ),
          if (isUser) ...[
            Container(
              width: 30,
              height: 30,
              margin: const EdgeInsets.only(left: 8, top: 2),
              decoration: BoxDecoration(
                color:
                    isDark
                        ? AppColors.darkSurfaceVariant
                        : AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                Icons.person_rounded,
                size: 16,
                color:
                    isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTypingIndicator(bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            margin: const EdgeInsets.only(right: 8, top: 2),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.auto_awesome_rounded,
              size: 16,
              color: AppColors.primary,
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkSurface : AppColors.surface,
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              border: Border.all(
                color: isDark ? AppColors.darkBorder : AppColors.border,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _Dot(delay: 0),
                const SizedBox(width: 4),
                _Dot(delay: 150),
                const SizedBox(width: 4),
                _Dot(delay: 300),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputBar(bool isDark) {
    final activeCourseId = ref.watch(activeCourseIdProvider);
    final hasActiveCourse =
        activeCourseId != null && activeCourseId.trim().isNotEmpty;

    return Container(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 12,
        bottom: MediaQuery.of(context).viewInsets.bottom + 12,
      ),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        border: Border(
          top: BorderSide(
            color: isDark ? AppColors.darkBorder : AppColors.border,
          ),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _controller,
              enabled: hasActiveCourse && !_isSending,
              maxLines: null,
              keyboardType: TextInputType.multiline,
              textInputAction: TextInputAction.newline,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color:
                    isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
              ),
              decoration: InputDecoration(
                hintText:
                    hasActiveCourse
                        ? 'Ask anything...'
                        : 'Select an active course first...',
                hintStyle: TextStyle(
                  color:
                      isDark
                          ? AppColors.darkTextTertiary
                          : AppColors.textTertiary,
                  fontSize: 14,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  borderSide: BorderSide(
                    color: isDark ? AppColors.darkBorder : AppColors.border,
                  ),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  borderSide: BorderSide(
                    color: isDark ? AppColors.darkBorder : AppColors.border,
                  ),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  borderSide: const BorderSide(
                    color: AppColors.primary,
                    width: 1.5,
                  ),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                filled: true,
                fillColor:
                    isDark ? AppColors.darkBackground : AppColors.background,
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap:
                _isSending || !hasActiveCourse
                    ? null
                    : () => _sendMessage(_controller.text),
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color:
                    _isSending || !hasActiveCourse
                        ? AppColors.primary.withValues(alpha: 0.4)
                        : AppColors.primary,
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              ),
              child:
                  _isSending
                      ? const Padding(
                        padding: EdgeInsets.all(10),
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                      : const Icon(
                        Icons.arrow_upward_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Feature card ──────────────────────────────────────────────────────────────

class _FeatureCard extends StatelessWidget {
  final bool isDark;
  final Color iconColor;
  final Color iconBg;
  final IconData icon;
  final String title;
  final String description;
  final String buttonLabel;
  final IconData? buttonIcon;
  final bool enabled;
  final Future<void> Function() onTap;

  const _FeatureCard({
    required this.isDark,
    required this.iconColor,
    required this.iconBg,
    required this.icon,
    required this.title,
    required this.description,
    required this.buttonLabel,
    this.buttonIcon,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? () => onTap() : null,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(
            color: isDark ? AppColors.darkBorder : AppColors.border,
          ),
          boxShadow:
              isDark
                  ? null
                  : [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.03),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 18, color: iconColor),
            ),
            const SizedBox(height: 10),
            Text(
              title,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              description,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color:
                    isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                fontSize: 11,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: enabled ? () => onTap() : null,
              style: OutlinedButton.styleFrom(
                foregroundColor:
                    isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                side: BorderSide(
                  color: isDark ? AppColors.darkBorder : AppColors.border,
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                minimumSize: Size.zero,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                ),
                textStyle: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (buttonIcon != null) ...[
                    Icon(buttonIcon, size: 12),
                    const SizedBox(width: 4),
                  ],
                  Text(buttonLabel),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Typing dots ───────────────────────────────────────────────────────────────

class _Dot extends StatefulWidget {
  final int delay;
  const _Dot({required this.delay});

  @override
  State<_Dot> createState() => _DotState();
}

class _DotState extends State<_Dot> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) _ctrl.repeat(reverse: true);
    });
    _anim = Tween<double>(begin: 0.3, end: 1.0).animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _anim,
      child: Container(
        width: 6,
        height: 6,
        decoration: const BoxDecoration(
          color: AppColors.textTertiary,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}
