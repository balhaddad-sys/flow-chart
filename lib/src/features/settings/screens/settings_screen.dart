import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/user_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(userModelProvider);
    final themeMode = ref.watch(themeModeProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          // ── SafeArea header instead of AppBar ────────────────────────
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

          // ── Account card (prominent) ─────────────────────────────────
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
                                      color: Colors.white.withValues(alpha: 0.7),
                                    ),
                          ),
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

          // ── Appearance section ───────────────────────────────────────
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
              child: RadioGroup<ThemeMode>(
                groupValue: themeMode,
                onChanged: (value) =>
                    ref.read(themeModeProvider.notifier).state = value!,
                child: Column(
                  children: [
                    const RadioListTile<ThemeMode>(
                      title: Text('System default'),
                      value: ThemeMode.system,
                      secondary: Icon(Icons.phone_android, size: 20),
                    ),
                    Divider(
                      height: 1,
                      color:
                          isDark ? AppColors.darkBorder : AppColors.borderLight,
                    ),
                    const RadioListTile<ThemeMode>(
                      title: Text('Light'),
                      value: ThemeMode.light,
                      secondary: Icon(Icons.light_mode, size: 20),
                    ),
                    Divider(
                      height: 1,
                      color:
                          isDark ? AppColors.darkBorder : AppColors.borderLight,
                    ),
                    const RadioListTile<ThemeMode>(
                      title: Text('Dark'),
                      value: ThemeMode.dark,
                      secondary: Icon(Icons.dark_mode, size: 20),
                    ),
                  ],
                ),
              ),
            ),
          ),

          AppSpacing.gapXl,

          // ── About section ───────────────────────────────────────────
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
                  Divider(
                    height: 1,
                    color:
                        isDark ? AppColors.darkBorder : AppColors.borderLight,
                  ),
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
                  Divider(
                    height: 1,
                    color:
                        isDark ? AppColors.darkBorder : AppColors.borderLight,
                  ),
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

          // ── Account actions ─────────────────────────────────────────
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
                  Divider(
                    height: 1,
                    color:
                        isDark ? AppColors.darkBorder : AppColors.borderLight,
                  ),
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
                  Divider(
                    height: 1,
                    color:
                        isDark ? AppColors.darkBorder : AppColors.borderLight,
                  ),
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

          // Extra bottom spacing so content clears the bottom nav bar
          const SizedBox(height: 96),
        ],
      ),
    );
  }

  void _showClearDataConfirmation(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete All Data?'),
        content: const Text(
          'This will permanently delete:\n'
          '• All courses and study plans\n'
          '• All uploaded files and materials\n'
          '• All questions and quiz history\n'
          '• All progress and statistics\n\n'
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
                  // Navigate to onboarding to start fresh
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
                      content: Text('Failed to delete account. Please try again.'),
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
