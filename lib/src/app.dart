import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/constants/app_colors.dart';
import 'core/constants/app_typography.dart';
import 'core/providers/auth_provider.dart';
import 'core/widgets/app_shell.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/auth/screens/signup_screen.dart';
import 'features/dashboard/screens/weakness_dashboard.dart';
import 'features/home/screens/home_screen.dart';
import 'features/library/screens/library_screen.dart';
import 'features/onboarding/screens/onboarding_flow.dart';
import 'features/planner/screens/planner_screen.dart';
import 'features/profile/screens/profile_screen.dart';
import 'features/quiz/screens/quiz_screen.dart';
import 'features/study_session/screens/study_session_screen.dart';

// ---------------------------------------------------------------------------
// Auth notifier for GoRouter
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tab paths for the bottom nav shell
// ---------------------------------------------------------------------------

const _tabPaths = ['/home', '/library', '/planner', '/dashboard', '/profile'];

int _indexForPath(String path) {
  final idx = _tabPaths.indexWhere((p) => path.startsWith(p));
  return idx >= 0 ? idx : 0;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

final _routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = ref.watch(_authNotifierProvider);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: authNotifier,
    redirect: (context, state) {
      final isLoggedIn = ref.read(authStateProvider).valueOrNull != null;
      final isAuthRoute = state.matchedLocation == '/login' ||
          state.matchedLocation == '/signup';

      if (!isLoggedIn && !isAuthRoute) return '/login';
      if (isLoggedIn && isAuthRoute) return '/home';
      return null;
    },
    routes: [
      // Auth routes (no bottom nav)
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/signup',
        builder: (context, state) => const SignupScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingFlow(),
      ),

      // Full-screen routes (no bottom nav)
      GoRoute(
        path: '/study/:taskId/:sectionId',
        builder: (context, state) => StudySessionScreen(
          taskId: state.pathParameters['taskId']!,
          sectionId: state.pathParameters['sectionId']!,
        ),
      ),
      GoRoute(
        path: '/quiz/:sectionId',
        builder: (context, state) => QuizScreen(
          sectionId: state.pathParameters['sectionId'],
        ),
      ),

      // Shell with bottom navigation
      ShellRoute(
        builder: (context, state, child) {
          final index = _indexForPath(state.matchedLocation);
          return AppShell(
            currentIndex: index,
            onTabChanged: (i) => context.go(_tabPaths[i]),
            child: child,
          );
        },
        routes: [
          GoRoute(
            path: '/home',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: HomeScreen(),
            ),
          ),
          GoRoute(
            path: '/library',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: LibraryScreen(),
            ),
          ),
          GoRoute(
            path: '/planner',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: PlannerScreen(),
            ),
          ),
          GoRoute(
            path: '/dashboard',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: WeaknessDashboard(),
            ),
          ),
          GoRoute(
            path: '/profile',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ProfileScreen(),
            ),
          ),
        ],
      ),
    ],
  );
});

// ---------------------------------------------------------------------------
// App widget
// ---------------------------------------------------------------------------

class MedQApp extends ConsumerWidget {
  const MedQApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(_routerProvider);

    return MaterialApp.router(
      title: 'MedQ',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: AppColors.primary,
        brightness: Brightness.light,
        textTheme: AppTypography.textTheme,
        scaffoldBackgroundColor: AppColors.background,
        pageTransitionsTheme: const PageTransitionsTheme(
          builders: {
            TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
            TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
            TargetPlatform.linux: FadeUpwardsPageTransitionsBuilder(),
            TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
            TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
          },
        ),
        cardTheme: CardThemeData(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: AppColors.border),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
        ),
        appBarTheme: const AppBarTheme(
          centerTitle: false,
          elevation: 0,
          scrolledUnderElevation: 0.5,
          backgroundColor: AppColors.surface,
          foregroundColor: AppColors.textPrimary,
        ),
        navigationBarTheme: NavigationBarThemeData(
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.primary,
              );
            }
            return const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: AppColors.textTertiary,
            );
          }),
        ),
      ),
      routerConfig: router,
    );
  }
}
