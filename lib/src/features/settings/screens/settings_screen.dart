import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../app.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/widgets/course_selector_sheet.dart';
import '../../home/providers/home_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
          // ── SafeArea header ───────────────────────────────────────
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: 4,
              ),
              child: Text(
                'Settings',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: isDark
                          ? AppColors.darkTextPrimary
                          : AppColors.textPrimary,
                    ),
              ),
            ),
          ),

          AppSpacing.gapLg,

          // ── Profile card (prominent) ──────────────────────────────
          Padding(
            padding: AppSpacing.screenHorizontal,
            child: Container(
              decoration: BoxDecoration(
                gradient: isDark
                    ? AppColors.darkHeroGradient
                    : AppColors.primaryGradient,
                borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                boxShadow: isDark ? [] : AppSpacing.shadowMd,
              ),
              padding: AppSpacing.cardPaddingLg,
              child: userAsync.when(
                data: (user) => Row(
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius:
                            BorderRadius.circular(AppSpacing.radiusMd),
                      ),
                      child: Center(
                        child: Text(
                          (user?.name ?? 'U')[0].toUpperCase(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    AppSpacing.hGapMd,
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user?.name ?? 'User',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            user?.email ?? '',
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color:
                                          Colors.white.withValues(alpha: 0.7),
                                    ),
                          ),
                          if (user?.subscriptionTier != null) ...[
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(
                                    AppSpacing.radiusFull),
                              ),
                              child: Text(
                                user!.subscriptionTier.toUpperCase(),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                loading: () => const SizedBox(
                  height: 64,
                  child: Center(
                    child: CircularProgressIndicator(color: Colors.white),
                  ),
                ),
                error: (_, __) => const Text(
                  'Failed to load profile',
                  style: TextStyle(color: Colors.white70),
                ),
              ),
            ),
          ),

          AppSpacing.gapXl,

          // ── Login Information section ─────────────────────────────
          const Padding(
            padding: AppSpacing.screenHorizontal,
            child: _SectionHeader(
                label: 'Account Information', icon: Icons.person_outline),
          ),
          AppSpacing.gapSm,
          Padding(
            padding: AppSpacing.screenHorizontal,
            child: Container(
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.surface,
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                border: Border.all(
                  color: isDark ? AppColors.darkBorder : AppColors.border,
                ),
              ),
              child: Column(
                children: [
                  // Email
                  _InfoRow(
                    icon: Icons.email_outlined,
                    label: 'Email',
                    value: firebaseUser?.email ?? 'Not set',
                    isDark: isDark,
                  ),
                  _divider(isDark),

                  // Sign-in method
                  _InfoRow(
                    icon: Icons.login_rounded,
                    label: 'Sign-in Method',
                    value: _getSignInMethod(firebaseUser),
                    isDark: isDark,
                  ),
                  _divider(isDark),

                  // Email verified
                  _InfoRow(
                    icon: Icons.verified_user_outlined,
                    label: 'Email Verified',
                    value: firebaseUser?.emailVerified == true ? 'Yes' : 'No',
                    valueColor: firebaseUser?.emailVerified == true
                        ? AppColors.success
                        : AppColors.warning,
                    isDark: isDark,
                  ),
                  _divider(isDark),

                  // Account created
                  _InfoRow(
                    icon: Icons.calendar_today_outlined,
                    label: 'Account Created',
                    value: _formatDate(firebaseUser?.metadata.creationTime),
                    isDark: isDark,
                  ),
                  _divider(isDark),

                  // Last sign-in
                  _InfoRow(
                    icon: Icons.access_time_rounded,
                    label: 'Last Sign-in',
                    value:
                        _formatDate(firebaseUser?.metadata.lastSignInTime),
                    isDark: isDark,
                  ),
                  _divider(isDark),

                  // User ID (copyable)
                  ListTile(
                    leading: Icon(Icons.fingerprint_rounded,
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                        size: 20),
                    title: const Text('User ID'),
                    subtitle: Text(
                      firebaseUser?.uid ?? 'N/A',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: isDark
                                ? AppColors.darkTextTertiary
                                : AppColors.textTertiary,
                            fontFamily: 'monospace',
                            fontSize: 11,
                          ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: IconButton(
                      icon: Icon(
                        Icons.copy_rounded,
                        size: 18,
                        color: isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary,
                      ),
                      onPressed: () {
                        if (firebaseUser?.uid != null) {
                          Clipboard.setData(
                              ClipboardData(text: firebaseUser!.uid));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('User ID copied to clipboard'),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        }
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),

          AppSpacing.gapXl,

          // ── Active Course section ─────────────────────────────────
          const Padding(
            padding: AppSpacing.screenHorizontal,
            child: _SectionHeader(
                label: 'Active Course', icon: Icons.school_outlined),
          ),
          AppSpacing.gapSm,
          Padding(
            padding: AppSpacing.screenHorizontal,
            child: coursesAsync.when(
              data: (courses) {
                CourseModel? activeCourse;
                if (activeCourseId != null) {
                  try {
                    activeCourse = courses.firstWhere((c) => c.id == activeCourseId);
                  } catch (_) {
                    activeCourse = null;
                  }
                } else if (courses.isNotEmpty) {
                  activeCourse = courses.first;
                }

                return Material(
                  color: isDark ? AppColors.darkSurface : AppColors.surface,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                    onTap: () => CourseSelectorSheet.show(context),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        borderRadius:
                            BorderRadius.circular(AppSpacing.radiusMd),
                        border: Border.all(
                          color: isDark
                              ? AppColors.darkBorder
                              : AppColors.border,
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              gradient: AppColors.primaryGradient,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Center(
                              child: Text(
                                (activeCourse != null && activeCourse.title.isNotEmpty)
                                    ? activeCourse.title[0].toUpperCase()
                                    : '?',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
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
                                  activeCourse?.title ??
                                      'No course selected',
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleSmall
                                      ?.copyWith(
                                          fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${courses.length} course${courses.length == 1 ? '' : 's'} \u00b7 Tap to switch',
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodySmall
                                      ?.copyWith(
                                        color: isDark
                                            ? AppColors.darkTextTertiary
                                            : AppColors.textTertiary,
                                      ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.swap_horiz_rounded,
                            color: AppColors.primary,
                            size: 22,
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
              loading: () => const SizedBox(
                height: 76,
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (_, __) => const SizedBox.shrink(),
            ),
          ),

          AppSpacing.gapXl,

          // ── Appearance section ─────────────────────────────────────
          const Padding(
            padding: AppSpacing.screenHorizontal,
            child: _SectionHeader(
                label: 'Appearance', icon: Icons.palette_outlined),
          ),
          AppSpacing.gapSm,
          Padding(
            padding: AppSpacing.screenHorizontal,
            child: Container(
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.surface,
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                border: Border.all(
                  color: isDark ? AppColors.darkBorder : AppColors.border,
                ),
              ),
              child: Column(
                children: [
                  RadioListTile<ThemeMode>(
                    title: const Text('System default'),
                    value: ThemeMode.system,
                    groupValue: themeMode,
                    secondary: const Icon(Icons.phone_android, size: 20),
                    onChanged: (value) =>
                        ref.read(themeModeProvider.notifier).state = value!,
                  ),
                  _divider(isDark),
                  RadioListTile<ThemeMode>(
                    title: const Text('Light'),
                    value: ThemeMode.light,
                    groupValue: themeMode,
                    secondary: const Icon(Icons.light_mode, size: 20),
                    onChanged: (value) =>
                        ref.read(themeModeProvider.notifier).state = value!,
                  ),
                  _divider(isDark),
                  RadioListTile<ThemeMode>(
                    title: const Text('Dark'),
                    value: ThemeMode.dark,
                    groupValue: themeMode,
                    secondary: const Icon(Icons.dark_mode, size: 20),
                    onChanged: (value) =>
                        ref.read(themeModeProvider.notifier).state = value!,
                  ),
                ],
              ),
            ),
          ),

          AppSpacing.gapXl,

          // ── About section ─────────────────────────────────────────
          const Padding(
            padding: AppSpacing.screenHorizontal,
            child: _SectionHeader(label: 'About', icon: Icons.info_outline),
          ),
          AppSpacing.gapSm,
          Padding(
            padding: AppSpacing.screenHorizontal,
            child: Container(
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.surface,
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                border: Border.all(
                  color: isDark ? AppColors.darkBorder : AppColors.border,
                ),
              ),
              child: Column(
                children: [
                  ListTile(
                    leading: Icon(Icons.info_outline,
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                        size: 20),
                    title: const Text('Version'),
                    trailing: Text(
                      '1.0.0',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: isDark
                                ? AppColors.darkTextTertiary
                                : AppColors.textTertiary,
                          ),
                    ),
                  ),
                  _divider(isDark),
                  ListTile(
                    leading: Icon(Icons.privacy_tip_outlined,
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                        size: 20),
                    title: const Text('Privacy Policy'),
                    trailing: Icon(Icons.chevron_right,
                        color: isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary,
                        size: 20),
                    onTap: () {},
                  ),
                  _divider(isDark),
                  ListTile(
                    leading: Icon(Icons.description_outlined,
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                        size: 20),
                    title: const Text('Terms of Service'),
                    trailing: Icon(Icons.chevron_right,
                        color: isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary,
                        size: 20),
                    onTap: () {},
                  ),
                ],
              ),
            ),
          ),

          AppSpacing.gapXl,

          // ── Account actions ───────────────────────────────────────
          const Padding(
            padding: AppSpacing.screenHorizontal,
            child: _SectionHeader(
                label: 'Account Actions', icon: Icons.manage_accounts),
          ),
          AppSpacing.gapSm,
          Padding(
            padding: AppSpacing.screenHorizontal,
            child: Container(
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.surface,
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                border: Border.all(
                  color: isDark ? AppColors.darkBorder : AppColors.border,
                ),
              ),
              child: Column(
                children: [
                  ListTile(
                    leading: Icon(Icons.logout,
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                        size: 20),
                    title: const Text('Sign Out'),
                    onTap: () async {
                      await ref.read(authServiceProvider).signOut();
                      if (context.mounted) {
                        context.go('/login');
                      }
                    },
                  ),
                  _divider(isDark),
                  ListTile(
                    leading: const Icon(
                      Icons.cleaning_services_outlined,
                      color: AppColors.warning,
                      size: 20,
                    ),
                    title: const Text(
                      'Delete All Data',
                      style: TextStyle(color: AppColors.warning),
                    ),
                    subtitle: Text(
                      'Remove all courses, files, and progress',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: isDark
                                ? AppColors.darkTextTertiary
                                : AppColors.textTertiary,
                          ),
                    ),
                    onTap: () => _showClearDataConfirmation(context, ref),
                  ),
                  _divider(isDark),
                  ListTile(
                    leading: const Icon(
                      Icons.delete_forever,
                      color: AppColors.error,
                      size: 20,
                    ),
                    title: const Text(
                      'Delete Account',
                      style: TextStyle(color: AppColors.error),
                    ),
                    subtitle: Text(
                      'Permanently delete all data',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: isDark
                                ? AppColors.darkTextTertiary
                                : AppColors.textTertiary,
                          ),
                    ),
                    onTap: () => _showDeleteConfirmation(context, ref),
                  ),
                ],
              ),
            ),
          ),

          // Extra bottom spacing
          const SizedBox(height: 96),
        ],
      ),
    );
  }

  static Widget _divider(bool isDark) {
    return Divider(
      height: 1,
      color: isDark ? AppColors.darkBorder : AppColors.borderLight,
    );
  }

  String _getSignInMethod(User? user) {
    if (user == null) return 'Unknown';
    final providers = user.providerData;
    if (providers.isEmpty) return 'Email';

    final methods = <String>[];
    for (final info in providers) {
      switch (info.providerId) {
        case 'google.com':
          methods.add('Google');
          break;
        case 'password':
          methods.add('Email/Password');
          break;
        case 'apple.com':
          methods.add('Apple');
          break;
        default:
          methods.add(info.providerId);
      }
    }
    return methods.join(', ');
  }

  String _formatDate(DateTime? date) {
    if (date == null) return 'Unknown';
    return DateFormat('MMM d, yyyy \u00b7 h:mm a').format(date);
  }

  void _showClearDataConfirmation(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete All Data?'),
        content: const Text(
          'This will permanently delete:\n'
          '\u2022 All courses and study plans\n'
          '\u2022 All uploaded files and materials\n'
          '\u2022 All questions and quiz history\n'
          '\u2022 All progress and statistics\n\n'
          'Your account will remain active. You can start fresh after deletion.\n\n'
          'This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Deleting all data...')),
                  );
                }

                await ref.read(cloudFunctionsServiceProvider).call(
                  'deleteUserData',
                  {},
                );

                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('All data deleted successfully'),
                      backgroundColor: AppColors.success,
                    ),
                  );
                  context.go('/onboarding');
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Failed to delete data: $e'),
                      backgroundColor: AppColors.error,
                    ),
                  );
                }
              }
            },
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.warning,
            ),
            child: const Text('Delete All Data'),
          ),
        ],
      ),
    );
  }

  void _showDeleteConfirmation(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Account'),
        content: const Text(
          'This will permanently delete your account and all associated data. '
          'This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ref.read(cloudFunctionsServiceProvider).call(
                  'deleteUserData',
                  {},
                );
                await ref.read(authServiceProvider).signOut();
                if (context.mounted) {
                  context.go('/login');
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content:
                          Text('Failed to delete account. Please try again.'),
                    ),
                  );
                }
              }
            },
            style: TextButton.styleFrom(
              foregroundColor: AppColors.error,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String label;
  final IconData icon;

  const _SectionHeader({required this.label, required this.icon});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Row(
        children: [
          Icon(
            icon,
            size: 14,
            color: isDark ? AppColors.darkTextTertiary : AppColors.textTertiary,
          ),
          const SizedBox(width: 6),
          Text(
            label.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextTertiary
                      : AppColors.textTertiary,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.2,
                  fontSize: 11,
                ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;
  final bool isDark;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon,
          color: isDark
              ? AppColors.darkTextSecondary
              : AppColors.textSecondary,
          size: 20),
      title: Text(label),
      trailing: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 180),
        child: Text(
          value,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: valueColor ??
                    (isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary),
                fontWeight:
                    valueColor != null ? FontWeight.w600 : FontWeight.w400,
              ),
          textAlign: TextAlign.end,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }
}
