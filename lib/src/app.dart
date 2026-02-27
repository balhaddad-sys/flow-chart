import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/constants/app_colors.dart';
import 'core/constants/app_links.dart';
import 'core/constants/app_spacing.dart';
import 'core/constants/app_typography.dart';
import 'core/widgets/medq_nav_bar.dart';
import 'core/providers/auth_provider.dart';
import 'core/utils/external_link.dart';
import 'features/ai/screens/ai_screen.dart';
import 'features/ai/screens/explore_screen.dart';
import 'features/auth/screens/forgot_password_screen.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/auth/screens/signup_screen.dart';
import 'features/dashboard/screens/weakness_dashboard.dart';
import 'features/home/providers/home_provider.dart';
import 'features/home/screens/home_screen.dart';
import 'features/library/providers/library_provider.dart';
import 'features/library/screens/library_screen.dart';
import 'features/onboarding/screens/onboarding_flow.dart';
import 'features/planner/screens/planner_screen.dart';
import 'features/practice/screens/practice_screen.dart';
import 'features/quiz/screens/quiz_screen.dart';
import 'features/settings/screens/settings_screen.dart';
import 'features/analytics/screens/analytics_screen.dart';
import 'features/exam_bank/screens/exam_bank_screen.dart';
import 'features/file_detail/screens/file_detail_screen.dart';
import 'features/assessment/screens/assessment_screen.dart';
import 'features/guide/screens/guide_screen.dart';
import 'features/legal/screens/privacy_screen.dart';
import 'features/legal/screens/terms_screen.dart';
import 'features/study_session/screens/study_session_screen.dart';
import 'models/file_model.dart';

// ── Auth notifier for GoRouter ──────────────────────────────────────────────

class _AuthNotifier extends ChangeNotifier {
  _AuthNotifier(Ref ref) {
    ref.listen<AsyncValue<User?>>(authStateProvider, (_, __) {
      notifyListeners();
    });
  }
}

final _authNotifierProvider = Provider<_AuthNotifier>((ref) {
  return _AuthNotifier(ref);
});

/// Theme mode state provider
final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.system);

// ── Shell Navigation ────────────────────────────────────────────────────────

final _shellNavIndexProvider = StateProvider<int>((ref) => 0);

class _AppShell extends ConsumerStatefulWidget {
  final Widget child;
  const _AppShell({required this.child});

  @override
  ConsumerState<_AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<_AppShell> {
  static const _disclaimerDismissKey = 'medq_disclaimer_dismissed_v1';

  static const _navItems = [
    _NavItem(
      icon: Icons.home_outlined,
      activeIcon: Icons.home_rounded,
      label: 'Home',
      path: '/today',
    ),
    _NavItem(
      icon: Icons.library_books_outlined,
      activeIcon: Icons.library_books_rounded,
      label: 'Library',
      path: '/library',
    ),
    _NavItem(
      icon: Icons.quiz_outlined,
      activeIcon: Icons.quiz_rounded,
      label: 'Practice',
      path: '/practice',
    ),
    _NavItem(
      icon: Icons.auto_awesome_outlined,
      activeIcon: Icons.auto_awesome_rounded,
      label: 'AI',
      path: '/ai',
    ),
    _NavItem(
      icon: Icons.person_outline_rounded,
      activeIcon: Icons.person_rounded,
      label: 'Profile',
      path: '/profile',
    ),
  ];

  bool _showDisclaimer = false;
  String? _statusCourseId;
  bool _statusInitialized = false;
  Map<String, String> _previousStatuses = {};

  @override
  void initState() {
    super.initState();
    _loadDisclaimerVisibility();
  }

  Future<void> _loadDisclaimerVisibility() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final dismissed = prefs.getString(_disclaimerDismissKey) == '1';
      if (!mounted) return;
      setState(() {
        _showDisclaimer = !dismissed;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _showDisclaimer = true;
      });
    }
  }

  Future<void> _dismissDisclaimer() async {
    setState(() {
      _showDisclaimer = false;
    });
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_disclaimerDismissKey, '1');
    } catch (_) {
      // Ignore preference write failures.
    }
  }

  void _resetFileNotifier({String? courseId}) {
    _statusCourseId = courseId;
    _statusInitialized = false;
    _previousStatuses = {};
  }

  void _showStatusSnackBar(String message, {Color? backgroundColor}) {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
          backgroundColor: backgroundColor,
        ),
      );
    });
  }

  void _handleFileStatusChange(
    List<FileModel> files, {
    required String courseId,
  }) {
    if (_statusCourseId != courseId) {
      _resetFileNotifier(courseId: courseId);
    }

    final currentStatuses = {for (final file in files) file.id: file.status};

    if (!_statusInitialized) {
      _previousStatuses = currentStatuses;
      _statusInitialized = true;
      return;
    }

    var newlyReadyCount = 0;
    FileModel? latestReadyFile;

    for (final file in files) {
      final previous = _previousStatuses[file.id];
      if (previous == null || previous == file.status) continue;

      if (file.status == 'PROCESSING' && previous == 'UPLOADED') {
        _showStatusSnackBar(
          'Analysing ${file.originalName} - running in background (usually 1-3 minutes).',
        );
      } else if (file.status == 'READY') {
        newlyReadyCount++;
        latestReadyFile = file;
      } else if (file.status == 'FAILED') {
        _showStatusSnackBar(
          '${file.originalName} failed to process. Open Library to retry.',
          backgroundColor: AppColors.error,
        );
      }
    }

    if (newlyReadyCount > 0) {
      final allDone =
          files.isNotEmpty &&
          files.every(
            (file) => file.status == 'READY' || file.status == 'FAILED',
          );
      final anyReady = files.any((file) => file.status == 'READY');

      if (allDone && anyReady) {
        _showStatusSnackBar(
          'All files analysed. Study plan generation has started automatically.',
          backgroundColor: AppColors.success,
        );
      } else if (newlyReadyCount == 1 && latestReadyFile != null) {
        _showStatusSnackBar(
          '${latestReadyFile.originalName} is fully analysed. Sections and questions are ready.',
          backgroundColor: AppColors.success,
        );
      } else {
        _showStatusSnackBar(
          '$newlyReadyCount files fully analysed. Sections and questions are ready.',
          backgroundColor: AppColors.success,
        );
      }
    }

    _previousStatuses = currentStatuses;
  }

  int _indexFromLocation(String location) {
    if (location.startsWith('/today') || location.startsWith('/home')) return 0;
    if (location.startsWith('/library')) return 1;
    if (location.startsWith('/practice')) return 2;
    if (location.startsWith('/ai')) return 3;
    if (location.startsWith('/profile') || location.startsWith('/settings'))
      return 4;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final currentIndex = _indexFromLocation(location);
    final activeCourseId = ref.watch(activeCourseIdProvider);

    if (activeCourseId == null || activeCourseId.trim().isEmpty) {
      _resetFileNotifier();
    } else {
      ref.listen<AsyncValue<List<FileModel>>>(filesProvider(activeCourseId), (
        previous,
        next,
      ) {
        next.whenData(
          (files) => _handleFileStatusChange(files, courseId: activeCourseId),
        );
      });
    }

    return Scaffold(
      body: Column(
        children: [
          if (_showDisclaimer)
            _MedicalDisclaimerBanner(
              onDismiss: _dismissDisclaimer,
              onLearnMore:
                  () => openExternalLink(
                    context,
                    AppLinks.termsOfServiceUrl,
                    label: 'Terms',
                  ),
            ),
          Expanded(child: widget.child),
        ],
      ),
      bottomNavigationBar: MedQNavBar(
        currentIndex: currentIndex,
        onTap: (i) {
          if (i != currentIndex) {
            ref.read(_shellNavIndexProvider.notifier).state = i;
            context.go(_navItems[i].path);
          }
        },
      ),
    );
  }
}

class _MedicalDisclaimerBanner extends StatelessWidget {
  final VoidCallback onDismiss;
  final VoidCallback onLearnMore;

  const _MedicalDisclaimerBanner({
    required this.onDismiss,
    required this.onLearnMore,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color:
            isDark
                ? AppColors.warning.withValues(alpha: 0.14)
                : AppColors.warningLight,
        border: Border(
          bottom: BorderSide(color: AppColors.warning.withValues(alpha: 0.25)),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 1),
                child: Icon(
                  Icons.warning_amber_rounded,
                  size: 14,
                  color: AppColors.warning,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  runSpacing: 2,
                  spacing: 4,
                  children: [
                    Text(
                      'MedQ is for education only. It does not provide clinical advice.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontSize: 12,
                        height: 1.35,
                        color:
                            isDark
                                ? AppColors.darkTextPrimary
                                : AppColors.textPrimary,
                      ),
                    ),
                    GestureDetector(
                      onTap: onLearnMore,
                      child: Text(
                        'Learn more',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontSize: 12,
                          color: AppColors.warning,
                          fontWeight: FontWeight.w600,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: Icon(
                  Icons.close_rounded,
                  size: 16,
                  color:
                      isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textSecondary,
                ),
                splashRadius: 16,
                onPressed: onDismiss,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final String path;
  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.path,
  });
}

// ── Router ──────────────────────────────────────────────────────────────────

final _routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = ref.watch(_authNotifierProvider);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: authNotifier,
    redirect: (context, state) {
      final isLoggedIn = ref.read(authStateProvider).valueOrNull != null;
      final isAuthRoute =
          state.matchedLocation == '/login' ||
          state.matchedLocation == '/signup' ||
          state.matchedLocation == '/forgot-password';

      if (!isLoggedIn && !isAuthRoute) return '/login';
      if (isLoggedIn && isAuthRoute) return '/today';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/signup',
        builder: (context, state) => const SignupScreen(),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingFlow(),
      ),
      ShellRoute(
        builder: (context, state, child) => _AppShell(child: child),
        routes: [
          GoRoute(
            path: '/today',
            pageBuilder:
                (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const HomeScreen(),
                  transitionsBuilder: _fadeTransition,
                ),
          ),
          GoRoute(
            path: '/home',
            pageBuilder:
                (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const HomeScreen(),
                  transitionsBuilder: _fadeTransition,
                ),
          ),
          GoRoute(
            path: '/library',
            pageBuilder:
                (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const LibraryScreen(),
                  transitionsBuilder: _fadeTransition,
                ),
          ),
          GoRoute(
            path: '/planner',
            pageBuilder:
                (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const PlannerScreen(),
                  transitionsBuilder: _fadeTransition,
                ),
          ),
          GoRoute(
            path: '/dashboard',
            pageBuilder:
                (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const WeaknessDashboard(),
                  transitionsBuilder: _fadeTransition,
                ),
          ),
          GoRoute(
            path: '/practice',
            pageBuilder:
                (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const PracticeScreen(),
                  transitionsBuilder: _fadeTransition,
                ),
          ),
          GoRoute(
            path: '/ai',
            pageBuilder:
                (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const AiScreen(),
                  transitionsBuilder: _fadeTransition,
                ),
          ),
          GoRoute(
            path: '/profile',
            pageBuilder:
                (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const SettingsScreen(),
                  transitionsBuilder: _fadeTransition,
                ),
          ),
          GoRoute(
            path: '/settings',
            pageBuilder:
                (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const SettingsScreen(),
                  transitionsBuilder: _fadeTransition,
                ),
          ),
          GoRoute(
            path: '/analytics',
            pageBuilder:
                (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const AnalyticsScreen(),
                  transitionsBuilder: _fadeTransition,
                ),
          ),
          GoRoute(
            path: '/ai/explore',
            pageBuilder:
                (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const ExploreScreen(),
                  transitionsBuilder: _fadeTransition,
                ),
          ),
          GoRoute(
            path: '/exam-bank',
            pageBuilder:
                (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: ExamBankScreen(
                    examType: state.uri.queryParameters['exam'],
                  ),
                  transitionsBuilder: _fadeTransition,
                ),
          ),
          GoRoute(
            path: '/file/:fileId',
            builder:
                (context, state) =>
                    FileDetailScreen(fileId: state.pathParameters['fileId']!),
          ),
          GoRoute(
            path: '/guide',
            pageBuilder:
                (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const GuideScreen(),
                  transitionsBuilder: _fadeTransition,
                ),
          ),
          GoRoute(
            path: '/assessment',
            pageBuilder:
                (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const AssessmentScreen(),
                  transitionsBuilder: _fadeTransition,
                ),
          ),
          GoRoute(
            path: '/terms',
            pageBuilder:
                (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const TermsScreen(),
                  transitionsBuilder: _fadeTransition,
                ),
          ),
          GoRoute(
            path: '/privacy',
            pageBuilder:
                (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const PrivacyScreen(),
                  transitionsBuilder: _fadeTransition,
                ),
          ),
        ],
      ),
      GoRoute(
        path: '/study/:taskId/:sectionId',
        builder:
            (context, state) => StudySessionScreen(
              taskId: state.pathParameters['taskId']!,
              sectionId: state.pathParameters['sectionId']!,
            ),
      ),
      GoRoute(
        path: '/quiz/:sectionId',
        builder:
            (context, state) => QuizScreen(
              sectionId: state.pathParameters['sectionId'],
              mode: state.uri.queryParameters['mode'] ?? 'section',
            ),
      ),
    ],
  );
});

Widget _fadeTransition(
  BuildContext context,
  Animation<double> animation,
  Animation<double> secondaryAnimation,
  Widget child,
) {
  return FadeTransition(opacity: animation, child: child);
}

// ── App ─────────────────────────────────────────────────────────────────────

class MedQApp extends ConsumerWidget {
  const MedQApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(_routerProvider);
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      title: 'MedQ',
      debugShowCheckedModeBanner: false,
      themeMode: themeMode,
      theme: _buildLightTheme(),
      darkTheme: _buildDarkTheme(),
      routerConfig: router,
    );
  }

  ThemeData _buildLightTheme() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.light,
    ).copyWith(
      primary: AppColors.primary,
      secondary: AppColors.secondary,
      tertiary: AppColors.accent,
      surface: AppColors.surface,
      onSurface: AppColors.textPrimary,
      error: AppColors.error,
      outline: AppColors.border,
      outlineVariant: AppColors.borderLight,
      surfaceTint: Colors.transparent,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      brightness: Brightness.light,
      textTheme: AppTypography.textTheme.apply(
        bodyColor: AppColors.textPrimary,
        displayColor: AppColors.textPrimary,
      ),
      scaffoldBackgroundColor: AppColors.background,
      canvasColor: AppColors.background,
      splashFactory: InkRipple.splashFactory,
      cardTheme: CardThemeData(
        elevation: 0,
        margin: EdgeInsets.zero,
        color: AppColors.surface,
        shadowColor: Colors.black.withValues(alpha: 0.04),
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          side: BorderSide(color: AppColors.border.withValues(alpha: 0.9)),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.divider,
        thickness: 1,
        space: 1,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: BorderSide(
            color: AppColors.border.withValues(alpha: 0.95),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.8),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: const BorderSide(color: AppColors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: const BorderSide(color: AppColors.error, width: 1.8),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 16,
        ),
        hintStyle: AppTypography.textTheme.bodyMedium?.copyWith(
          color: AppColors.textTertiary,
          fontWeight: FontWeight.w600,
        ),
        labelStyle: AppTypography.textTheme.bodyMedium?.copyWith(
          color: AppColors.textSecondary,
        ),
      ),
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.textPrimary,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: AppTypography.textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
        ),
        systemOverlayStyle: SystemUiOverlayStyle.dark,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.45),
          disabledForegroundColor: Colors.white70,
          elevation: 0,
          shadowColor: Colors.transparent,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          ),
          textStyle: AppTypography.textTheme.labelLarge,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          ),
          textStyle: AppTypography.textTheme.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          side: BorderSide(color: AppColors.border),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          ),
          textStyle: AppTypography.textTheme.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: AppTypography.textTheme.labelLarge,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surfaceVariant,
        selectedColor: AppColors.primarySubtle,
        labelStyle: AppTypography.textTheme.labelMedium,
        side: BorderSide(color: AppColors.border.withValues(alpha: 0.9)),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        highlightElevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: const Color(0xFF102233),
        contentTextStyle: AppTypography.textTheme.bodyMedium?.copyWith(
          color: Colors.white,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        ),
        behavior: SnackBarBehavior.floating,
        elevation: 0,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
        ),
        elevation: 0,
        titleTextStyle: AppTypography.textTheme.titleLarge?.copyWith(
          color: AppColors.textPrimary,
        ),
        contentTextStyle: AppTypography.textTheme.bodyMedium?.copyWith(
          color: AppColors.textSecondary,
        ),
      ),
      checkboxTheme: CheckboxThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: AppColors.primary,
        unselectedLabelColor: AppColors.textTertiary,
        indicatorColor: AppColors.primary,
        indicatorSize: TabBarIndicatorSize.label,
        labelStyle: AppTypography.textTheme.labelLarge,
        unselectedLabelStyle: AppTypography.textTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w600,
        ),
      ),
      listTileTheme: ListTileThemeData(
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
        iconColor: AppColors.textSecondary,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.primary,
        linearTrackColor: AppColors.surfaceVariant,
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.linux: FadeUpwardsPageTransitionsBuilder(),
        },
      ),
    );
  }

  ThemeData _buildDarkTheme() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.dark,
    ).copyWith(
      primary: AppColors.primaryLight,
      secondary: AppColors.secondaryLight,
      tertiary: AppColors.accentLight,
      surface: AppColors.darkSurface,
      onSurface: AppColors.darkTextPrimary,
      error: AppColors.error,
      outline: AppColors.darkBorder,
      outlineVariant: AppColors.darkDivider,
      surfaceTint: Colors.transparent,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      brightness: Brightness.dark,
      textTheme: AppTypography.textTheme.apply(
        bodyColor: AppColors.darkTextPrimary,
        displayColor: AppColors.darkTextPrimary,
      ),
      scaffoldBackgroundColor: AppColors.darkBackground,
      canvasColor: AppColors.darkBackground,
      splashFactory: InkRipple.splashFactory,
      cardTheme: CardThemeData(
        elevation: 0,
        margin: EdgeInsets.zero,
        color: AppColors.darkSurface,
        shadowColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          side: BorderSide(color: AppColors.darkBorder.withValues(alpha: 0.95)),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.darkDivider,
        thickness: 1,
        space: 1,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.darkSurfaceVariant.withValues(alpha: 0.78),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: BorderSide(color: AppColors.darkBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: BorderSide(
            color: AppColors.darkBorder.withValues(alpha: 0.95),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: const BorderSide(
            color: AppColors.primaryLight,
            width: 1.7,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: const BorderSide(color: AppColors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: const BorderSide(color: AppColors.error, width: 1.8),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 16,
        ),
        hintStyle: AppTypography.textTheme.bodyMedium?.copyWith(
          color: AppColors.darkTextTertiary,
          fontWeight: FontWeight.w600,
        ),
        labelStyle: AppTypography.textTheme.bodyMedium?.copyWith(
          color: AppColors.darkTextSecondary,
        ),
      ),
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: AppColors.darkBackground,
        foregroundColor: AppColors.darkTextPrimary,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: AppTypography.textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w700,
          color: AppColors.darkTextPrimary,
        ),
        systemOverlayStyle: SystemUiOverlayStyle.light,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primaryLight,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.primaryLight.withValues(
            alpha: 0.4,
          ),
          disabledForegroundColor: Colors.white70,
          elevation: 0,
          shadowColor: Colors.transparent,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          ),
          textStyle: AppTypography.textTheme.labelLarge,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primaryLight,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          ),
          textStyle: AppTypography.textTheme.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.darkTextPrimary,
          side: BorderSide(color: AppColors.darkBorder),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          ),
          textStyle: AppTypography.textTheme.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primaryLight,
          textStyle: AppTypography.textTheme.labelLarge,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.darkSurfaceVariant,
        selectedColor: AppColors.primary.withValues(alpha: 0.2),
        labelStyle: AppTypography.textTheme.labelMedium?.copyWith(
          color: AppColors.darkTextPrimary,
        ),
        side: BorderSide(color: AppColors.darkBorder),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.darkSurfaceElevated,
        contentTextStyle: AppTypography.textTheme.bodyMedium?.copyWith(
          color: AppColors.darkTextPrimary,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        ),
        behavior: SnackBarBehavior.floating,
        elevation: 0,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: AppColors.darkSurface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.darkSurface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
        ),
        elevation: 0,
      ),
      checkboxTheme: CheckboxThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: AppColors.primaryLight,
        foregroundColor: Colors.white,
        elevation: 0,
        highlightElevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        ),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: AppColors.primaryLight,
        unselectedLabelColor: AppColors.darkTextTertiary,
        indicatorColor: AppColors.primaryLight,
        indicatorSize: TabBarIndicatorSize.label,
        labelStyle: AppTypography.textTheme.labelLarge,
        unselectedLabelStyle: AppTypography.textTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w600,
        ),
      ),
      listTileTheme: ListTileThemeData(
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
        iconColor: AppColors.darkTextSecondary,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.primaryLight,
        linearTrackColor: AppColors.darkSurfaceVariant,
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.linux: FadeUpwardsPageTransitionsBuilder(),
        },
      ),
    );
  }
}
