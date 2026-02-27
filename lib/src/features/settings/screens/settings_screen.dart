// FILE: lib/src/features/settings/screens/settings_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_links.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/utils/error_handler.dart';
import '../../../core/utils/external_link.dart';
import '../../home/providers/home_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  // Course management
  String? _editingCourseId;
  String? _deletingCourseId;
  final _editController = TextEditingController();

  // Delete account state
  bool _deleteConfirmOpen = false;
  String _deleteConfirmText = '';
  bool _deleting = false;

  @override
  void dispose() {
    _editController.dispose();
    super.dispose();
  }

  Future<void> _renameCourse(String courseId) async {
    final title = _editController.text.trim();
    if (title.isEmpty) return;
    final uid = ref.read(uidProvider);
    if (uid == null) return;
    try {
      await ref
          .read(firestoreServiceProvider)
          .updateCourse(uid, courseId, {'title': title});
      if (mounted) setState(() => _editingCourseId = null);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ErrorHandler.userMessage(e))),
        );
      }
    }
  }

  Future<void> _deleteCourse(String courseId) async {
    final uid = ref.read(uidProvider);
    if (uid == null) return;
    setState(() => _deletingCourseId = courseId);
    try {
      await ref
          .read(firestoreServiceProvider)
          .deleteCourse(uid, courseId);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ErrorHandler.userMessage(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _deletingCourseId = null);
    }
  }

  Future<void> _signOut() async {
    try {
      await ref.read(authServiceProvider).signOut();
      if (mounted) context.go('/login');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ErrorHandler.userMessage(e))),
        );
      }
    }
  }

  Future<void> _deleteAccount() async {
    setState(() => _deleting = true);
    try {
      await ref
          .read(cloudFunctionsServiceProvider)
          .deleteUserData();
      await ref.read(authServiceProvider).signOut();
      if (mounted) context.go('/login');
    } catch (e) {
      if (mounted) {
        setState(() {
          _deleting = false;
          _deleteConfirmOpen = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ErrorHandler.userMessage(e))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final userAsync = ref.watch(userModelProvider);
    final coursesAsync = ref.watch(coursesProvider);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── App bar ─────────────────────────────────────────────────
            SliverAppBar(
              floating: true,
              backgroundColor:
                  isDark ? AppColors.darkBackground : AppColors.background,
              centerTitle: false,
              titleSpacing: 20,
              title: Text(
                'Profile',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.5,
                    ),
              ),
            ),

            SliverPadding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // ── User info card ─────────────────────────────────────
                  userAsync.when(
                    loading: () =>
                        const _SectionSkeleton(height: 100),
                    error: (_, __) => const SizedBox.shrink(),
                    data: (user) => user == null
                        ? const SizedBox.shrink()
                        : _UserInfoCard(
                            user: user,
                            isDark: isDark,
                          ),
                  ),
                  AppSpacing.gapLg,

                  // ── My Courses ─────────────────────────────────────────
                  _SectionHeader(
                    title: 'My Courses',
                    isDark: isDark,
                  ),
                  AppSpacing.gapSm,
                  coursesAsync.when(
                    loading: () =>
                        const _SectionSkeleton(height: 120),
                    error: (_, __) => const SizedBox.shrink(),
                    data: (courses) => Column(
                      children: [
                        ...courses.map(
                          (course) => _CourseCard(
                            course: course,
                            isDark: isDark,
                            isEditing: _editingCourseId == course.id,
                            isDeleting: _deletingCourseId == course.id,
                            editController: _editController,
                            onEdit: () {
                              setState(() {
                                _editingCourseId = course.id;
                                _editController.text = course.title;
                              });
                            },
                            onEditSave: () => _renameCourse(course.id),
                            onEditCancel: () {
                              setState(() => _editingCourseId = null);
                            },
                            onDelete: () async {
                              final confirmed =
                                  await _confirmDelete(context, course.title);
                              if (confirmed) _deleteCourse(course.id);
                            },
                          ),
                        ),
                        AppSpacing.gapSm,
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: () => context.go('/onboarding'),
                            icon: const Icon(Icons.add_rounded, size: 18),
                            label: const Text('Add Course'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.primary,
                              side: BorderSide(
                                color: AppColors.primary
                                    .withValues(alpha: 0.35),
                              ),
                              padding: const EdgeInsets.symmetric(
                                  vertical: 13),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(
                                    AppSpacing.radiusMd),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  AppSpacing.gapLg,

                  // ── Study Preferences ──────────────────────────────────
                  _SectionHeader(
                    title: 'Study Preferences',
                    isDark: isDark,
                  ),
                  AppSpacing.gapSm,
                  userAsync.when(
                    loading: () =>
                        const _SectionSkeleton(height: 60),
                    error: (_, __) => const SizedBox.shrink(),
                    data: (user) => _PreferencesCard(
                      isDark: isDark,
                      dailyMinutes:
                          user?.preferences.dailyMinutesDefault ?? 120,
                      onEditMinutes: () =>
                          _showEditMinutesDialog(context, user),
                    ),
                  ),
                  AppSpacing.gapLg,

                  // ── App ────────────────────────────────────────────────
                  _SectionHeader(title: 'App', isDark: isDark),
                  AppSpacing.gapSm,
                  _AppLinksCard(isDark: isDark),
                  AppSpacing.gapLg,

                  // ── Account ────────────────────────────────────────────
                  _SectionHeader(
                    title: 'Account',
                    isDark: isDark,
                  ),
                  AppSpacing.gapSm,
                  _AccountSection(
                    isDark: isDark,
                    deleteConfirmOpen: _deleteConfirmOpen,
                    deleteConfirmText: _deleteConfirmText,
                    deleting: _deleting,
                    onSignOut: _signOut,
                    onDeleteTap: () =>
                        setState(() => _deleteConfirmOpen = true),
                    onDeleteConfirmChange: (v) =>
                        setState(() => _deleteConfirmText = v),
                    onDeleteConfirm: _deleteAccount,
                    onDeleteCancel: () => setState(() {
                      _deleteConfirmOpen = false;
                      _deleteConfirmText = '';
                    }),
                  ),
                  AppSpacing.gapXl,
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<bool> _confirmDelete(
      BuildContext context, String courseTitle) async {
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Delete Course?'),
            content: Text(
              'Delete "$courseTitle"? All associated tasks and data will be '
              'permanently removed. This cannot be undone.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                ),
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Delete'),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _showEditMinutesDialog(
      BuildContext context, dynamic user) async {
    final current = user?.preferences.dailyMinutesDefault ?? 120;
    int value = current;

    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => AlertDialog(
          title: const Text('Daily Study Minutes'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '$value minutes per day',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
              ),
              Slider(
                value: value.toDouble(),
                min: 15,
                max: 480,
                divisions: 31,
                activeColor: AppColors.primary,
                label: '$value min',
                onChanged: (v) {
                  setModalState(() => value = v.round());
                },
              ),
              Text(
                _minutesLabel(value),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
              ),
              onPressed: () async {
                Navigator.pop(ctx);
                final uid = ref.read(uidProvider);
                if (uid != null) {
                  await ref
                      .read(firestoreServiceProvider)
                      .updateUser(uid, {
                    'preferences.dailyMinutesDefault': value,
                  });
                  ref.invalidate(userModelProvider);
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  String _minutesLabel(int minutes) {
    if (minutes < 60) return '$minutes minutes per day';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (m == 0) return '${h}h per day';
    return '${h}h ${m}min per day';
  }
}

// ── User info card ────────────────────────────────────────────────────────────

class _UserInfoCard extends StatelessWidget {
  final dynamic user;
  final bool isDark;

  const _UserInfoCard({required this.user, required this.isDark});

  String get _initials {
    final name = (user.name as String? ?? '').trim();
    if (name.isEmpty) return '?';
    final parts = name.split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name.substring(0, name.length >= 2 ? 2 : 1).toUpperCase();
  }

  bool get _isPro => (user.subscriptionTier as String?) == 'pro';

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              gradient: AppColors.primaryGradient,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                _initials,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          // Name + email
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user.name as String? ?? 'User',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  user.email as String? ?? '',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                      ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          // Subscription badge
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _isPro
                  ? AppColors.primary
                  : (isDark
                      ? AppColors.darkSurfaceVariant
                      : AppColors.surfaceVariant),
              borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
            ),
            child: Text(
              _isPro ? 'Pro' : 'Free',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: _isPro
                    ? Colors.white
                    : (isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Course card ────────────────────────────────────────────────────────────────

class _CourseCard extends StatelessWidget {
  final dynamic course;
  final bool isDark;
  final bool isEditing;
  final bool isDeleting;
  final TextEditingController editController;
  final VoidCallback onEdit;
  final VoidCallback onEditSave;
  final VoidCallback onEditCancel;
  final VoidCallback onDelete;

  const _CourseCard({
    required this.course,
    required this.isDark,
    required this.isEditing,
    required this.isDeleting,
    required this.editController,
    required this.onEdit,
    required this.onEditSave,
    required this.onEditCancel,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final examDate = course.examDate as DateTime?;
    final examType = course.examType as String?;
    final sectionCount = course.sectionCount as int? ?? 0;
    final questionCount = course.questionCount as int? ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isEditing)
            // Inline edit field
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: editController,
                    autofocus: true,
                    decoration: InputDecoration(
                      hintText: 'Course name',
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      border: OutlineInputBorder(
                        borderRadius:
                            BorderRadius.circular(AppSpacing.radiusSm),
                        borderSide: BorderSide(
                          color: isDark
                              ? AppColors.darkBorder
                              : AppColors.border,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius:
                            BorderRadius.circular(AppSpacing.radiusSm),
                        borderSide: const BorderSide(
                          color: AppColors.primary,
                          width: 1.5,
                        ),
                      ),
                    ),
                    onSubmitted: (_) => onEditSave(),
                  ),
                ),
                const SizedBox(width: 8),
                TextButton(
                  onPressed: onEditSave,
                  child: const Text('Save'),
                ),
                TextButton(
                  onPressed: onEditCancel,
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.textSecondary,
                  ),
                  child: const Text('Cancel'),
                ),
              ],
            )
          else
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        course.title as String? ?? 'Untitled',
                        style: Theme.of(context)
                            .textTheme
                            .titleSmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Wrap(
                        spacing: 8,
                        children: [
                          if (examType != null)
                            _MiniChip(
                              label: examType,
                              color: AppColors.primary,
                              isDark: isDark,
                            ),
                          if (examDate != null)
                            _MiniChip(
                              label: _formatDate(examDate),
                              color: _examDateColor(examDate),
                              isDark: isDark,
                            ),
                          _MiniChip(
                            label: '$sectionCount sections',
                            color: AppColors.textTertiary,
                            isDark: isDark,
                          ),
                          _MiniChip(
                            label: '$questionCount questions',
                            color: AppColors.textTertiary,
                            isDark: isDark,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                // Edit icon
                IconButton(
                  icon: Icon(
                    Icons.edit_rounded,
                    size: 18,
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                  ),
                  onPressed: onEdit,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(
                    minWidth: 32,
                    minHeight: 32,
                  ),
                ),
                // Delete icon
                isDeleting
                    ? const SizedBox(
                        width: 32,
                        height: 32,
                        child: Center(
                          child: SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2),
                          ),
                        ),
                      )
                    : IconButton(
                        icon: const Icon(
                          Icons.delete_outline_rounded,
                          size: 18,
                          color: AppColors.error,
                        ),
                        onPressed: onDelete,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(
                          minWidth: 32,
                          minHeight: 32,
                        ),
                      ),
              ],
            ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    final diff = date.difference(DateTime.now()).inDays;
    if (diff < 0) return 'Exam passed';
    if (diff == 0) return 'Exam today';
    if (diff == 1) return 'Tomorrow';
    return '${date.day}/${date.month}/${date.year}';
  }

  Color _examDateColor(DateTime date) {
    final diff = date.difference(DateTime.now()).inDays;
    if (diff <= 7) return AppColors.error;
    if (diff <= 30) return AppColors.warning;
    return AppColors.textTertiary;
  }
}

class _MiniChip extends StatelessWidget {
  final String label;
  final Color color;
  final bool isDark;

  const _MiniChip({
    required this.label,
    required this.color,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w500,
          color: color == AppColors.textTertiary
              ? (isDark
                  ? AppColors.darkTextTertiary
                  : AppColors.textTertiary)
              : color,
        ),
      ),
    );
  }
}

// ── Preferences card ──────────────────────────────────────────────────────────

class _PreferencesCard extends StatelessWidget {
  final bool isDark;
  final int dailyMinutes;
  final VoidCallback onEditMinutes;

  const _PreferencesCard({
    required this.isDark,
    required this.dailyMinutes,
    required this.onEditMinutes,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: ListTile(
        leading: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(
            Icons.timer_outlined,
            color: AppColors.primary,
            size: 20,
          ),
        ),
        title: const Text('Daily Study Minutes'),
        subtitle: Text(
          '$dailyMinutes min/day',
          style: TextStyle(
            color: AppColors.primary,
            fontWeight: FontWeight.w600,
          ),
        ),
        trailing: Icon(
          Icons.edit_rounded,
          size: 18,
          color: isDark
              ? AppColors.darkTextTertiary
              : AppColors.textTertiary,
        ),
        onTap: onEditMinutes,
      ),
    );
  }
}

// ── App links card ────────────────────────────────────────────────────────────

class _AppLinksCard extends StatelessWidget {
  final bool isDark;

  const _AppLinksCard({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Column(
        children: [
          _AppLinkTile(
            icon: Icons.bar_chart_rounded,
            iconColor: AppColors.primary,
            title: 'Analytics',
            onTap: () => context.go('/analytics'),
            isDark: isDark,
          ),
          _Divider(isDark: isDark),
          _AppLinkTile(
            icon: Icons.book_outlined,
            iconColor: AppColors.secondary,
            title: 'App Guide',
            onTap: () => context.go('/guide'),
            isDark: isDark,
          ),
          _Divider(isDark: isDark),
          _AppLinkTile(
            icon: Icons.privacy_tip_outlined,
            iconColor: AppColors.info,
            title: 'Privacy Policy',
            onTap: () => openExternalLink(
              context,
              AppLinks.privacyPolicyUrl,
              label: 'Privacy Policy',
            ),
            isDark: isDark,
            isExternal: true,
          ),
          _Divider(isDark: isDark),
          _AppLinkTile(
            icon: Icons.description_outlined,
            iconColor: AppColors.info,
            title: 'Terms of Service',
            onTap: () => openExternalLink(
              context,
              AppLinks.termsOfServiceUrl,
              label: 'Terms of Service',
            ),
            isDark: isDark,
            isExternal: true,
          ),
          _Divider(isDark: isDark),
          _AppLinkTile(
            icon: Icons.support_agent_rounded,
            iconColor: AppColors.success,
            title: 'Contact Support',
            onTap: () => openExternalLink(
              context,
              AppLinks.supportMailto,
              label: 'Support',
            ),
            isDark: isDark,
            isExternal: true,
          ),
        ],
      ),
    );
  }
}

class _AppLinkTile extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final VoidCallback onTap;
  final bool isDark;
  final bool isExternal;

  const _AppLinkTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.onTap,
    required this.isDark,
    this.isExternal = false,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: iconColor.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: iconColor, size: 20),
      ),
      title: Text(title),
      trailing: Icon(
        isExternal
            ? Icons.open_in_new_rounded
            : Icons.chevron_right_rounded,
        size: 18,
        color: isDark
            ? AppColors.darkTextTertiary
            : AppColors.textTertiary,
      ),
      onTap: onTap,
    );
  }
}

// ── Account section ───────────────────────────────────────────────────────────

class _AccountSection extends StatelessWidget {
  final bool isDark;
  final bool deleteConfirmOpen;
  final String deleteConfirmText;
  final bool deleting;
  final VoidCallback onSignOut;
  final VoidCallback onDeleteTap;
  final ValueChanged<String> onDeleteConfirmChange;
  final VoidCallback onDeleteConfirm;
  final VoidCallback onDeleteCancel;

  const _AccountSection({
    required this.isDark,
    required this.deleteConfirmOpen,
    required this.deleteConfirmText,
    required this.deleting,
    required this.onSignOut,
    required this.onDeleteTap,
    required this.onDeleteConfirmChange,
    required this.onDeleteConfirm,
    required this.onDeleteCancel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
        boxShadow: isDark ? null : AppSpacing.shadowSm,
      ),
      child: Column(
        children: [
          // Sign out
          ListTile(
            leading: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.logout_rounded,
                color: AppColors.error,
                size: 20,
              ),
            ),
            title: const Text(
              'Sign Out',
              style: TextStyle(
                color: AppColors.error,
                fontWeight: FontWeight.w600,
              ),
            ),
            onTap: onSignOut,
          ),
          _Divider(isDark: isDark),
          // Delete account
          if (!deleteConfirmOpen)
            ListTile(
              leading: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.delete_forever_rounded,
                  color: AppColors.error.withValues(alpha: 0.7),
                  size: 20,
                ),
              ),
              title: Text(
                'Delete Account',
                style: TextStyle(
                  color: AppColors.error.withValues(alpha: 0.8),
                ),
              ),
              subtitle: const Text('Permanently remove all your data'),
              onTap: onDeleteTap,
            )
          else
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Type "DELETE" to confirm',
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: AppColors.error,
                        ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    autofocus: true,
                    onChanged: onDeleteConfirmChange,
                    decoration: InputDecoration(
                      hintText: 'DELETE',
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius:
                            BorderRadius.circular(AppSpacing.radiusSm),
                        borderSide: const BorderSide(
                            color: AppColors.error),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius:
                            BorderRadius.circular(AppSpacing.radiusSm),
                        borderSide: const BorderSide(
                            color: AppColors.error, width: 1.5),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: deleting ? null : onDeleteCancel,
                          child: const Text('Cancel'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.error,
                            foregroundColor: Colors.white,
                          ),
                          onPressed:
                              deleteConfirmText == 'DELETE' && !deleting
                                  ? onDeleteConfirm
                                  : null,
                          child: deleting
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text('Delete Account'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  final bool isDark;

  const _SectionHeader({required this.title, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Text(
      title.toUpperCase(),
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: isDark
                ? AppColors.darkTextSecondary
                : AppColors.textSecondary,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.0,
            fontSize: 11,
          ),
    );
  }
}

class _Divider extends StatelessWidget {
  final bool isDark;
  const _Divider({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Divider(
      height: 1,
      indent: 20,
      endIndent: 20,
      color: isDark ? AppColors.darkBorder : AppColors.borderLight,
    );
  }
}

class _SectionSkeleton extends StatelessWidget {
  final double height;
  const _SectionSkeleton({required this.height});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
    );
  }
}
