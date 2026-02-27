// FILE: lib/src/features/ai/screens/ai_screen.dart

import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/widgets/formatted_text.dart';
import '../../home/providers/home_provider.dart';
import '../providers/ai_provider.dart';

// ── AI Screen ──────────────────────────────────────────────────────────────────

class AiScreen extends ConsumerStatefulWidget {
  const AiScreen({super.key});

  @override
  ConsumerState<AiScreen> createState() => _AiScreenState();
}

class _AiScreenState extends ConsumerState<AiScreen> {
  String? _activeThreadId;
  String? _activeThreadTitle;
  bool _isCreatingThread = false;
  bool _isSending = false;

  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _openThread(String id, String title) {
    setState(() {
      _activeThreadId = id;
      _activeThreadTitle = title;
    });
  }

  void _closeThread() {
    setState(() {
      _activeThreadId = null;
      _activeThreadTitle = null;
    });
    _messageController.clear();
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

  Future<void> _createThread() async {
    final uid = ref.read(uidProvider);
    final courseId = ref.read(activeCourseIdProvider);

    if (uid == null) return;
    if (courseId == null || courseId.trim().isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select an active course before starting a chat.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    if (_isCreatingThread) return;

    final titleController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        ),
        title: const Text('New Conversation'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'What would you like to discuss?',
              style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: titleController,
              autofocus: true,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                hintText: 'e.g. Cardiology review, ECG interpretation...',
              ),
              onSubmitted: (_) => Navigator.of(ctx).pop(true),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              ),
            ),
            child: const Text('Start'),
          ),
        ],
      ),
    );
    titleController.dispose();

    if (confirmed != true || !mounted) return;
    final title =
        titleController.text.trim().isEmpty ? 'New Conversation' : titleController.text.trim();

    setState(() => _isCreatingThread = true);
    try {
      final threadId = await ref
          .read(firestoreServiceProvider)
          .createChatThread(uid, courseId: courseId, title: title);
      if (!mounted) return;
      _openThread(threadId, title);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to create conversation: $e'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _isCreatingThread = false);
    }
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _isSending || _activeThreadId == null) return;

    final threadId = _activeThreadId!;
    final courseId = ref.read(activeCourseIdProvider);
    if (courseId == null || courseId.trim().isEmpty) return;

    _messageController.clear();
    setState(() => _isSending = true);
    _scrollToBottom();

    try {
      await ref.read(cloudFunctionsServiceProvider).sendChatMessage(
            threadId: threadId,
            message: text,
            courseId: courseId,
          );
      ref.invalidate(chatMessagesProvider(threadId));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to send message: $e'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _isSending = false);
      _scrollToBottom();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_activeThreadId != null) {
      return _ChatView(
        threadId: _activeThreadId!,
        threadTitle: _activeThreadTitle ?? 'Chat',
        isSending: _isSending,
        messageController: _messageController,
        scrollController: _scrollController,
        onBack: _closeThread,
        onSend: _sendMessage,
        onScrollToBottom: _scrollToBottom,
        isDark: isDark,
      );
    }

    return _HubView(
      isDark: isDark,
      isCreating: _isCreatingThread,
      onNewThread: _createThread,
      onOpenThread: _openThread,
    );
  }
}

// ── Hub View ───────────────────────────────────────────────────────────────────

class _HubView extends ConsumerWidget {
  final bool isDark;
  final bool isCreating;
  final VoidCallback onNewThread;
  final void Function(String id, String title) onOpenThread;

  const _HubView({
    required this.isDark,
    required this.isCreating,
    required this.onNewThread,
    required this.onOpenThread,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final threadsAsync = ref.watch(chatThreadsProvider);
    final activeCourseId = ref.watch(activeCourseIdProvider);

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── Header ────────────────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                          ),
                          child: const Icon(
                            Icons.auto_awesome_rounded,
                            size: 20,
                            color: AppColors.primary,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'AI Assistant',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w700),
                              ),
                              Text(
                                'Your intelligent study companion',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      color: isDark
                                          ? AppColors.darkTextSecondary
                                          : AppColors.textSecondary,
                                    ),
                              ),
                            ],
                          ),
                        ),
                        // Explore shortcut
                        OutlinedButton.icon(
                          onPressed: () => context.push('/ai/explore'),
                          icon: const Icon(Icons.explore_outlined, size: 16),
                          label: const Text('Explore'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.primary,
                            side: const BorderSide(color: AppColors.primary),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 8),
                            shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(AppSpacing.radiusMd),
                            ),
                            textStyle: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // No course warning
                    if (activeCourseId == null || activeCourseId.trim().isEmpty)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.warning.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                          border: Border.all(
                              color: AppColors.warning.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline_rounded,
                                size: 16, color: AppColors.warning),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Select a course on the Home tab to start chatting.',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: isDark
                                      ? AppColors.darkTextSecondary
                                      : AppColors.textSecondary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    if (activeCourseId == null || activeCourseId.trim().isEmpty)
                      const SizedBox(height: 12),

                    // New Conversation button
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: isCreating ? null : onNewThread,
                        icon: isCreating
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 1.5,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.add_rounded, size: 18),
                        label: Text(isCreating
                            ? 'Creating...'
                            : 'New Conversation'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppSpacing.radiusMd),
                          ),
                          textStyle: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Section header
                    Text(
                      'Recent Conversations',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),

            // ── Thread List ───────────────────────────────────────────────────
            threadsAsync.when(
              loading: () => const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ),
              error: (e, _) => SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Center(
                    child: Text(
                      'Failed to load conversations.',
                      style: TextStyle(
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                      ),
                    ),
                  ),
                ),
              ),
              data: (threads) {
                if (threads.isEmpty) {
                  return SliverToBoxAdapter(
                    child: _EmptyThreadState(isDark: isDark),
                  );
                }
                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final thread = threads[index];
                      return _ThreadTile(
                        thread: thread,
                        isDark: isDark,
                        onTap: () => onOpenThread(
                          thread['id'] as String,
                          thread['title'] as String? ?? 'Chat',
                        ),
                      );
                    },
                    childCount: threads.length,
                  ),
                );
              },
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }
}

// ── Thread Tile ────────────────────────────────────────────────────────────────

class _ThreadTile extends StatelessWidget {
  final Map<String, dynamic> thread;
  final bool isDark;
  final VoidCallback onTap;

  const _ThreadTile({
    required this.thread,
    required this.isDark,
    required this.onTap,
  });

  String _formatDate(dynamic value) {
    if (value == null) return '';
    DateTime? dt;
    if (value is Timestamp) {
      dt = value.toDate();
    } else if (value is DateTime) {
      dt = value;
    }
    if (dt == null) return '';
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inDays == 0) return DateFormat('HH:mm').format(dt);
    if (diff.inDays == 1) return 'Yesterday';
    if (diff.inDays < 7) return DateFormat('EEE').format(dt);
    return DateFormat('d MMM').format(dt);
  }

  @override
  Widget build(BuildContext context) {
    final title = thread['title'] as String? ?? 'Untitled';
    final lastMessage = thread['lastMessage'] as String? ?? '';
    final updatedAt = thread['updatedAt'];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Material(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              border: Border.all(
                color: isDark ? AppColors.darkBorder : AppColors.border,
              ),
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                  ),
                  child: const Icon(
                    Icons.chat_bubble_outline_rounded,
                    size: 20,
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
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      if (lastMessage.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          lastMessage,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: isDark
                                        ? AppColors.darkTextSecondary
                                        : AppColors.textSecondary,
                                  ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      _formatDate(updatedAt),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: isDark
                                ? AppColors.darkTextSecondary
                                : AppColors.textTertiary,
                          ),
                    ),
                    const SizedBox(height: 4),
                    const Icon(
                      Icons.chevron_right_rounded,
                      size: 18,
                      color: AppColors.textTertiary,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Empty Thread State ─────────────────────────────────────────────────────────

class _EmptyThreadState extends StatelessWidget {
  final bool isDark;
  const _EmptyThreadState({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 32),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.chat_bubble_outline_rounded,
              size: 36,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Start a Conversation',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Ask your AI study companion anything about your medical studies.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                  height: 1.5,
                ),
          ),
        ],
      ),
    );
  }
}

// ── Chat View ──────────────────────────────────────────────────────────────────

class _ChatView extends ConsumerStatefulWidget {
  final String threadId;
  final String threadTitle;
  final bool isSending;
  final TextEditingController messageController;
  final ScrollController scrollController;
  final VoidCallback onBack;
  final VoidCallback onSend;
  final VoidCallback onScrollToBottom;
  final bool isDark;

  const _ChatView({
    required this.threadId,
    required this.threadTitle,
    required this.isSending,
    required this.messageController,
    required this.scrollController,
    required this.onBack,
    required this.onSend,
    required this.onScrollToBottom,
    required this.isDark,
  });

  @override
  ConsumerState<_ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends ConsumerState<_ChatView> {
  @override
  void didUpdateWidget(_ChatView oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Auto-scroll whenever thread or messages change
    widget.onScrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final messagesAsync = ref.watch(chatMessagesProvider(widget.threadId));
    final courseId = ref.watch(activeCourseIdProvider);

    return Scaffold(
      backgroundColor:
          widget.isDark ? AppColors.darkBackground : AppColors.background,
      appBar: AppBar(
        backgroundColor:
            widget.isDark ? AppColors.darkBackground : AppColors.background,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: widget.onBack,
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.threadTitle,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (courseId != null && courseId.isNotEmpty)
              Text(
                'Course context active',
                style: TextStyle(
                  fontSize: 11,
                  color: widget.isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary,
                ),
              ),
          ],
        ),
        elevation: 0,
        scrolledUnderElevation: 1,
      ),
      body: Column(
        children: [
          // ── Message List ─────────────────────────────────────────────────
          Expanded(
            child: messagesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Text(
                  'Failed to load messages.',
                  style: TextStyle(
                    color: widget.isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
                ),
              ),
              data: (messages) {
                // Auto-scroll when messages arrive
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  widget.onScrollToBottom();
                });

                if (messages.isEmpty && !widget.isSending) {
                  return _ChatEmptyState(isDark: widget.isDark);
                }

                return ListView.builder(
                  controller: widget.scrollController,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  itemCount:
                      messages.length + (widget.isSending ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (index == messages.length && widget.isSending) {
                      return const _TypingIndicator();
                    }
                    final msg = messages[index];
                    final role = msg['role'] as String? ?? 'assistant';
                    final content = msg['content'] as String? ?? '';
                    final createdAt = msg['createdAt'];
                    return _MessageBubble(
                      role: role,
                      content: content,
                      createdAt: createdAt,
                      isDark: widget.isDark,
                    );
                  },
                );
              },
            ),
          ),

          // ── Input Row ────────────────────────────────────────────────────
          _ChatInput(
            controller: widget.messageController,
            isSending: widget.isSending,
            onSend: widget.onSend,
            isDark: widget.isDark,
          ),
        ],
      ),
    );
  }
}

// ── Chat Empty State ───────────────────────────────────────────────────────────

class _ChatEmptyState extends StatelessWidget {
  final bool isDark;
  const _ChatEmptyState({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.auto_awesome_rounded,
                size: 32,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Ask Me Anything',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'I can help you understand concepts, work through clinical scenarios, and prepare for your exams.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                    height: 1.5,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  final String role;
  final String content;
  final dynamic createdAt;
  final bool isDark;

  const _MessageBubble({
    required this.role,
    required this.content,
    required this.createdAt,
    required this.isDark,
  });

  bool get _isUser => role == 'user';

  String _formatTime(dynamic value) {
    if (value == null) return '';
    DateTime? dt;
    if (value is Timestamp) dt = value.toDate();
    if (dt == null) return '';
    return DateFormat('HH:mm').format(dt);
  }

  @override
  Widget build(BuildContext context) {
    final timeStr = _formatTime(createdAt);

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment:
            _isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment:
                _isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Avatar for assistant
              if (!_isUser) ...[
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.auto_awesome_rounded,
                    size: 14,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 8),
              ],

              // Bubble
              Flexible(
                child: Container(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.75,
                  ),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: _isUser
                        ? AppColors.primary
                        : (isDark
                            ? AppColors.darkSurfaceVariant
                            : AppColors.surfaceVariant),
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: _isUser
                          ? const Radius.circular(16)
                          : const Radius.circular(4),
                      bottomRight: _isUser
                          ? const Radius.circular(4)
                          : const Radius.circular(16),
                    ),
                    border: _isUser
                        ? null
                        : Border.all(
                            color: isDark
                                ? AppColors.darkBorder
                                : AppColors.border,
                          ),
                  ),
                  child: _isUser
                      ? Text(
                          content,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            height: 1.45,
                          ),
                        )
                      : FormattedText(
                          text: content,
                          baseStyle:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    fontSize: 14,
                                    height: 1.55,
                                    color: isDark
                                        ? AppColors.darkTextPrimary
                                        : AppColors.textPrimary,
                                  ),
                        ),
                ),
              ),

              // Avatar spacer for user
              if (_isUser) const SizedBox(width: 4),
            ],
          ),

          // Timestamp
          if (timeStr.isNotEmpty)
            Padding(
              padding: EdgeInsets.only(
                top: 4,
                left: _isUser ? 0 : 36,
              ),
              child: Text(
                timeStr,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textTertiary,
                      fontSize: 10,
                    ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Typing Indicator ───────────────────────────────────────────────────────────

class _TypingIndicator extends StatefulWidget {
  const _TypingIndicator();

  @override
  State<_TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<_TypingIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.auto_awesome_rounded,
              size: 14,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: isDark
                  ? AppColors.darkSurfaceVariant
                  : AppColors.surfaceVariant,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
                bottomLeft: Radius.circular(4),
                bottomRight: Radius.circular(16),
              ),
              border: Border.all(
                color: isDark ? AppColors.darkBorder : AppColors.border,
              ),
            ),
            child: AnimatedBuilder(
              animation: _controller,
              builder: (context, _) {
                return Row(
                  mainAxisSize: MainAxisSize.min,
                  children: List.generate(3, (i) {
                    final delay = i * 0.33;
                    final phase = (_controller.value - delay).clamp(0.0, 1.0);
                    final opacity = (0.3 + 0.7 * (phase < 0.5
                            ? phase * 2
                            : (1.0 - phase) * 2))
                        .clamp(0.3, 1.0);
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: Opacity(
                        opacity: opacity,
                        child: Container(
                          width: 7,
                          height: 7,
                          decoration: const BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    );
                  }),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Chat Input ─────────────────────────────────────────────────────────────────

class _ChatInput extends StatelessWidget {
  final TextEditingController controller;
  final bool isSending;
  final VoidCallback onSend;
  final bool isDark;

  const _ChatInput({
    required this.controller,
    required this.isSending,
    required this.onSend,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: 16,
        right: 12,
        top: 10,
        bottom: MediaQuery.of(context).viewInsets.bottom > 0 ? 10 : 20,
      ),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        border: Border(
          top: BorderSide(
            color: isDark ? AppColors.darkBorder : AppColors.border,
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                maxLines: 5,
                minLines: 1,
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.newline,
                decoration: InputDecoration(
                  hintText: 'Ask anything...',
                  hintStyle: TextStyle(
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textTertiary,
                    fontSize: 14,
                  ),
                  filled: true,
                  fillColor: isDark
                      ? AppColors.darkBackground
                      : AppColors.background,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius:
                        BorderRadius.circular(AppSpacing.radiusMd),
                    borderSide: BorderSide(
                      color: isDark
                          ? AppColors.darkBorder
                          : AppColors.border,
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius:
                        BorderRadius.circular(AppSpacing.radiusMd),
                    borderSide: BorderSide(
                      color: isDark
                          ? AppColors.darkBorder
                          : AppColors.border,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius:
                        BorderRadius.circular(AppSpacing.radiusMd),
                    borderSide: const BorderSide(
                        color: AppColors.primary, width: 1.5),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              child: Material(
                color: isSending
                    ? AppColors.primary.withValues(alpha: 0.5)
                    : AppColors.primary,
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                child: InkWell(
                  onTap: isSending ? null : onSend,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  child: Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    child: isSending
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(
                            Icons.send_rounded,
                            size: 20,
                            color: Colors.white,
                          ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
