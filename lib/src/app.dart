import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/constants/app_colors.dart';
import 'core/constants/app_typography.dart';
import 'core/providers/auth_provider.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/auth/screens/signup_screen.dart';
import 'features/dashboard/screens/weakness_dashboard.dart';
import 'features/home/screens/home_screen.dart';
import 'features/library/screens/library_screen.dart';
import 'features/onboarding/screens/onboarding_flow.dart';
import 'features/planner/screens/planner_screen.dart';
import 'features/quiz/screens/quiz_screen.dart';
import 'features/study_session/screens/study_session_screen.dart';

/// Listenable that notifies GoRouter when auth state changes,
/// without recreating the entire router.
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

final _routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = ref.watch(_authNotifierProvider);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: authNotifier,
    redirect: (context, state) {
      final isLoggedIn = ref.read(authStateProvider).valueOrNull != null;
      final isAuthRoute =
          state.matchedLocation == '/login' ||
          state.matchedLocation == '/signup';

      if (!isLoggedIn && !isAuthRoute) return '/login';
      if (isLoggedIn && isAuthRoute) return '/home';
      return null;
    },
    routes: [
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
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/library',
        builder: (context, state) => const LibraryScreen(),
      ),
      GoRoute(
        path: '/planner',
        builder: (context, state) => const PlannerScreen(),
      ),
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
      GoRoute(
        path: '/dashboard',
        builder: (context, state) => const WeaknessDashboard(),
      ),
    ],
  );
});

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
          backgroundColor: AppColors.surface,
          foregroundColor: AppColors.textPrimary,
        ),
      ),
      routerConfig: router,
    );
  }
}
