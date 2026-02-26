import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_links.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/utils/external_link.dart';
import '../../home/providers/home_provider.dart';
import '../../../models/course_model.dart';

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
      if (mounted) {
        setState(() => _editingCourseId = null);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Course renamed'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to rename course'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _deleteCourse(String courseId) async {
    final uid = ref.read(uidProvider);
    if (uid == null) return;
    try {
      await ref.read(firestoreServiceProvider).deleteCourse(uid, courseId);
      final activeCourseId = ref.read(activeCourseIdProvider);
      if (activeCourseId == courseId) {
        final courses = ref.read(coursesProvider).valueOrNull ?? [];
        final remaining = courses.where((c) => c.id != courseId).toList();
        ref.read(activeCourseIdProvider.notifier).state =
            remaining.isNotEmpty ? remaining.first.id : null;
      }
      if (mounted) {
        setState(() => _deletingCourseId = null);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Course deleted'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to delete course'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _deleteAccount() async {
    if (_deleteConfirmText != 'DELETE') return;
    setState(() => _deleting = true);
    try {
      await ref.read(cloudFunctionsServiceProvider).call('deleteUserData', {});
      await ref.read(authServiceProvider).signOut();
      if (mounted) context.go('/login');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to delete account. Please try again.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _deleting = false;
          _deleteConfirmOpen = false;
          _deleteConfirmText = '';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final userAsync = ref.watch(userModelProvider);
    final firebaseUser = ref.watch(currentUserProvider);
    final themeMode = ref.watch(themeModeProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final coursesAsync = ref.watch(coursesProvider);
    final activeCourseId = ref.watch(activeCourseIdProvider);

    return Scaffold(
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          // ── Safe-area header ─────────────────────────────────────
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.only(
                  left: 20, right: 20, top: 20, bottom: 4),
              child: Text(
                'Profile',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.5,
                    ),
              ),
            ),
          ),

          AppSpacing.gapLg,

          // ── Profile header ────────────────────────────────────────
          Padding(
            padding: AppSpacing.screenHorizontal,
            child: userAsync.when(
              data: (user) {
                final name = user?.name ?? firebaseUser?.email ?? 'Student';
                final email = user?.email ?? firebaseUser?.email ?? '';
                final initials = name
                    .split(' ')
                    .map((w) => w.isNotEmpty ? w[0].toUpperCase() : '')
                    .take(2)
                    .join();

                return Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            AppColors.primary.withValues(alpha: 0.2),
                            AppColors.primary.withValues(alpha: 0.05),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Center(
                        child: Text(
                          initials.isNotEmpty ? initials : '?',
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontWeight: FontWeight.w700),
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            email,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                  color: isDark
                                      ? AppColors.darkTextSecondary
                                      : AppColors.textSecondary,
                                  fontSize: 13,
                                ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
              loading: () => const SizedBox(
                height: 56,
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (_, __) => const SizedBox.shrink(),
            ),
          ),

          AppSpacing.gapXl,

          // ── Appearance ────────────────────────────────────────────
          Padding(
            padding: AppSpacing.screenHorizontal,
            child: _Card(
              isDark: isDark,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Appearance',
                    style:
                        Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Customize how MedQ looks',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.textSecondary,
                          fontSize: 11,
                        ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      _ThemeButton(
                        label: 'Light',
                        icon: Icons.light_mode_rounded,
                        selected: themeMode == ThemeMode.light,
                        isDark: isDark,
                        onTap: () => ref
                            .read(themeModeProvider.notifier)
                            .state = ThemeMode.light,
                      ),
                      const SizedBox(width: 8),
                      _ThemeButton(
                        label: 'Dark',
                        icon: Icons.dark_mode_rounded,
                        selected: themeMode == ThemeMode.dark,
                        isDark: isDark,
                        onTap: () => ref
                            .read(themeModeProvider.notifier)
                            .state = ThemeMode.dark,
                      ),
                      const SizedBox(width: 8),
                      _ThemeButton(
                        label: 'System',
                        icon: Icons.phone_android_rounded,
                        selected: themeMode == ThemeMode.system,
                        isDark: isDark,
                        onTap: () => ref
                            .read(themeModeProvider.notifier)
                            .state = ThemeMode.system,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          AppSpacing.gapMd,

          // ── Courses ───────────────────────────────────────────────
          Padding(
            padding: AppSpacing.screenHorizontal,
            child: _Card(
              isDark: isDark,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Courses',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Tap to switch, or add a new course',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: isDark
                                        ? AppColors.darkTextSecondary
                                        : AppColors.textSecondary,
                                    fontSize: 11,
                                  ),
                            ),
                          ],
                        ),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => context.go('/onboarding'),
                        icon: const Icon(Icons.add_rounded, size: 14),
                        label: const Text('New'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.primary,
                          side:
                              const BorderSide(color: AppColors.primary),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          minimumSize: Size.zero,
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppSpacing.radiusMd),
                          ),
                          textStyle: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  coursesAsync.when(
                    loading: () => const Center(
                        child: Padding(
                      padding: EdgeInsets.all(12),
                      child: CircularProgressIndicator(),
                    )),
                    error: (_, __) => const SizedBox.shrink(),
                    data: (courses) {
                      if (courses.isEmpty) {
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Center(
                            child: Text(
                              'No courses yet. Create one to get started.',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: isDark
                                        ? AppColors.darkTextTertiary
                                        : AppColors.textTertiary,
                                  ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        );
                      }
                      return Column(
                        children: courses.map((course) {
                          final isActive = course.id == activeCourseId;
                          final isEditing = _editingCourseId == course.id;
                          final isDeleting = _deletingCourseId == course.id;
                          return _CourseRow(
                            course: course,
                            isActive: isActive,
                            isEditing: isEditing,
                            isDeleting: isDeleting,
                            isDark: isDark,
                            editController:
                                isEditing ? _editController : null,
                            onTap: () {
                              if (!isEditing && !isDeleting) {
                                ref
                                    .read(activeCourseIdProvider.notifier)
                                    .state = course.id;
                              }
                            },
                            onEdit: () {
                              setState(() {
                                _editingCourseId = course.id;
                                _deletingCourseId = null;
                                _editController.text = course.title;
                              });
                            },
                            onEditSubmit: () => _renameCourse(course.id),
                            onEditCancel: () =>
                                setState(() => _editingCourseId = null),
                            onDelete: () => setState(() {
                              _deletingCourseId = course.id;
                              _editingCourseId = null;
                            }),
                            onDeleteConfirm: () =>
                                _deleteCourse(course.id),
                            onDeleteCancel: () =>
                                setState(() => _deletingCourseId = null),
                          );
                        }).toList(),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),

          AppSpacing.gapMd,

          // ── Account ───────────────────────────────────────────────
          Padding(
            padding: AppSpacing.screenHorizontal,
            child: _Card(
              isDark: isDark,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Account',
                    style: Theme.of(context)
                        .textTheme
                        .titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () async {
                      await ref.read(authServiceProvider).signOut();
                      if (context.mounted) context.go('/login');
                    },
                    icon: const Icon(Icons.logout_rounded, size: 14),
                    label: const Text('Sign Out'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                      minimumSize: Size.zero,
                      shape: RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(AppSpacing.radiusMd),
                      ),
                      textStyle: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          AppSpacing.gapMd,

          // ── Legal & Safety ────────────────────────────────────────
          Padding(
            padding: AppSpacing.screenHorizontal,
            child: _Card(
              isDark: isDark,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Legal & Safety',
                    style: Theme.of(context)
                        .textTheme
                        .titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'MedQ is an educational study platform and is not a clinical decision tool.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.textSecondary,
                          fontSize: 11,
                        ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () => openExternalLink(
                          context,
                          AppLinks.termsOfServiceUrl,
                          label: 'Terms',
                        ),
                        icon: const Icon(Icons.description_outlined,
                            size: 14),
                        label: const Text('Terms'),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          minimumSize: Size.zero,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(
                                AppSpacing.radiusMd),
                          ),
                          textStyle: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => openExternalLink(
                          context,
                          AppLinks.privacyPolicyUrl,
                          label: 'Privacy',
                        ),
                        icon: const Icon(Icons.privacy_tip_outlined,
                            size: 14),
                        label: const Text('Privacy'),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          minimumSize: Size.zero,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(
                                AppSpacing.radiusMd),
                          ),
                          textStyle: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          AppSpacing.gapMd,

          // ── Danger Zone ───────────────────────────────────────────
          Padding(
            padding: AppSpacing.screenHorizontal,
            child: Container(
              padding: AppSpacing.cardPadding,
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.surface,
                borderRadius:
                    BorderRadius.circular(AppSpacing.radiusMd),
                border: Border.all(
                  color: isDark
                      ? AppColors.error.withValues(alpha: 0.25)
                      : AppColors.error.withValues(alpha: 0.2),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Danger Zone',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.error,
                        ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Permanently delete your account and all associated data.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.textSecondary,
                          fontSize: 11,
                        ),
                  ),
                  const SizedBox(height: 12),
                  if (!_deleteConfirmOpen)
                    FilledButton.icon(
                      onPressed: () =>
                          setState(() => _deleteConfirmOpen = true),
                      icon: const Icon(Icons.delete_forever, size: 14),
                      label: const Text('Delete Account'),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.error,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 8),
                        minimumSize: Size.zero,
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppSpacing.radiusMd),
                        ),
                        textStyle: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    )
                  else
                    _DeleteConfirmPanel(
                      isDark: isDark,
                      confirmText: _deleteConfirmText,
                      deleting: _deleting,
                      onTextChanged: (v) =>
                          setState(() => _deleteConfirmText = v),
                      onConfirm: _deleteAccount,
                      onCancel: () => setState(() {
                        _deleteConfirmOpen = false;
                        _deleteConfirmText = '';
                      }),
                    ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 96),
        ],
      ),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

class _Card extends StatelessWidget {
  final bool isDark;
  final Widget child;

  const _Card({required this.isDark, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: AppSpacing.cardPadding,
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
      ),
      child: child,
    );
  }
}

class _ThemeButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final bool isDark;
  final VoidCallback onTap;

  const _ThemeButton({
    required this.label,
    required this.icon,
    required this.selected,
    required this.isDark,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding:
              const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          decoration: BoxDecoration(
            color: selected
                ? AppColors.primary.withValues(alpha: 0.08)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: Border.all(
              color: selected
                  ? AppColors.primary
                  : (isDark ? AppColors.darkBorder : AppColors.border),
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                size: 16,
                color: selected
                    ? AppColors.primary
                    : (isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: selected
                      ? AppColors.primary
                      : (isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textSecondary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CourseRow extends StatelessWidget {
  final CourseModel course;
  final bool isActive;
  final bool isEditing;
  final bool isDeleting;
  final bool isDark;
  final TextEditingController? editController;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onEditSubmit;
  final VoidCallback onEditCancel;
  final VoidCallback onDelete;
  final VoidCallback onDeleteConfirm;
  final VoidCallback onDeleteCancel;

  const _CourseRow({
    required this.course,
    required this.isActive,
    required this.isEditing,
    required this.isDeleting,
    required this.isDark,
    required this.editController,
    required this.onTap,
    required this.onEdit,
    required this.onEditSubmit,
    required this.onEditCancel,
    required this.onDelete,
    required this.onDeleteConfirm,
    required this.onDeleteCancel,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        GestureDetector(
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            margin: const EdgeInsets.only(bottom: 4),
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: isActive
                  ? AppColors.primary.withValues(alpha: 0.08)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              border: Border.all(
                color: isActive
                    ? AppColors.primary.withValues(alpha: 0.25)
                    : Colors.transparent,
              ),
            ),
            child: Row(
              children: [
                // Active indicator
                AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    color: isActive
                        ? AppColors.primary
                        : (isDark
                            ? AppColors.darkSurfaceVariant
                            : AppColors.surfaceVariant),
                    shape: BoxShape.circle,
                  ),
                  child: isActive
                      ? const Icon(Icons.check_rounded,
                          size: 12, color: Colors.white)
                      : null,
                ),
                const SizedBox(width: 10),
                // Title or edit field
                Expanded(
                  child: isEditing
                      ? TextField(
                          controller: editController,
                          autofocus: true,
                          decoration: InputDecoration(
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 6),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(
                                  AppSpacing.radiusSm),
                            ),
                          ),
                          onSubmitted: (_) => onEditSubmit(),
                          style: Theme.of(context).textTheme.bodySmall,
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              course.title,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    fontWeight: isActive
                                        ? FontWeight.w600
                                        : FontWeight.w400,
                                  ),
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (course.examType != null &&
                                course.examType!.isNotEmpty)
                              Text(
                                course.examType!,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      fontSize: 11,
                                      color: isDark
                                          ? AppColors.darkTextTertiary
                                          : AppColors.textTertiary,
                                    ),
                              ),
                          ],
                        ),
                ),
                // Action buttons
                if (isEditing) ...[
                  IconButton(
                    onPressed: onEditSubmit,
                    icon: const Icon(Icons.check_rounded, size: 16),
                    color: AppColors.success,
                    padding: const EdgeInsets.all(10),
                    constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
                  ),
                  IconButton(
                    onPressed: onEditCancel,
                    icon: const Icon(Icons.close_rounded, size: 16),
                    padding: const EdgeInsets.all(10),
                    constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
                  ),
                ] else if (!isDeleting) ...[
                  IconButton(
                    onPressed: onEdit,
                    icon: Icon(
                      Icons.edit_rounded,
                      size: 15,
                      color: isDark
                          ? AppColors.darkTextTertiary
                          : AppColors.textTertiary,
                    ),
                    padding: const EdgeInsets.all(10),
                    constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
                  ),
                  IconButton(
                    onPressed: onDelete,
                    icon: Icon(
                      Icons.delete_outline_rounded,
                      size: 15,
                      color: isDark
                          ? AppColors.darkTextTertiary
                          : AppColors.textTertiary,
                    ),
                    padding: const EdgeInsets.all(10),
                    constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
                  ),
                ],
              ],
            ),
          ),
        ),
        // Delete confirmation row
        if (isDeleting)
          Container(
            margin: const EdgeInsets.only(left: 30, bottom: 6),
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.06),
              borderRadius:
                  BorderRadius.circular(AppSpacing.radiusMd),
              border: Border.all(
                color: AppColors.error.withValues(alpha: 0.2),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Delete this course?',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.error,
                          fontSize: 12,
                        ),
                  ),
                ),
                TextButton(
                  onPressed: onDeleteConfirm,
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.error,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    minimumSize: Size.zero,
                    textStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  child: const Text('Delete'),
                ),
                TextButton(
                  onPressed: onDeleteCancel,
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    minimumSize: Size.zero,
                    textStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  child: const Text('Cancel'),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _DeleteConfirmPanel extends StatefulWidget {
  final bool isDark;
  final String confirmText;
  final bool deleting;
  final ValueChanged<String> onTextChanged;
  final VoidCallback onConfirm;
  final VoidCallback onCancel;

  const _DeleteConfirmPanel({
    required this.isDark,
    required this.confirmText,
    required this.deleting,
    required this.onTextChanged,
    required this.onConfirm,
    required this.onCancel,
  });

  @override
  State<_DeleteConfirmPanel> createState() => _DeleteConfirmPanelState();
}

class _DeleteConfirmPanelState extends State<_DeleteConfirmPanel> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'This will permanently delete all your data.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.error,
                  fontSize: 13,
                ),
          ),
          const SizedBox(height: 6),
          RichText(
            text: TextSpan(
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: widget.isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary,
                    fontSize: 12,
                  ),
              children: const [
                TextSpan(text: 'Type '),
                TextSpan(
                  text: 'DELETE',
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.w700,
                    color: AppColors.error,
                  ),
                ),
                TextSpan(text: ' to confirm.'),
              ],
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _controller,
            autofocus: true,
            onChanged: widget.onTextChanged,
            decoration: InputDecoration(
              hintText: 'Type DELETE',
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12, vertical: 10),
              border: OutlineInputBorder(
                borderRadius:
                    BorderRadius.circular(AppSpacing.radiusMd),
                borderSide: BorderSide(
                    color: AppColors.error.withValues(alpha: 0.3)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius:
                    BorderRadius.circular(AppSpacing.radiusMd),
                borderSide: const BorderSide(color: AppColors.error),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              FilledButton(
                onPressed: widget.confirmText == 'DELETE' && !widget.deleting
                    ? widget.onConfirm
                    : null,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.error,
                  disabledBackgroundColor:
                      AppColors.error.withValues(alpha: 0.4),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 8),
                  minimumSize: Size.zero,
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(AppSpacing.radiusMd),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                child: widget.deleting
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 1.5,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Confirm Delete'),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: widget.onCancel,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 8),
                  minimumSize: Size.zero,
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(AppSpacing.radiusMd),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                child: const Text('Cancel'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
