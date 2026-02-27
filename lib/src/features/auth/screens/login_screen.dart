// FILE: lib/src/features/auth/screens/login_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/error_banner.dart';
import '../../../core/widgets/google_sign_in_button.dart';
import '../../../core/widgets/primary_button.dart';
import '../providers/auth_state_provider.dart';
import '../widgets/auth_layout.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  late final AnimationController _animController;
  late final Animation<double> _fadeIn;
  late final Animation<Offset> _slideUp;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 480),
    );
    _fadeIn = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.04),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  String? _validatePassword(String? value) {
    if (value == null || value.isEmpty) return 'Password is required';
    return null;
  }

  void _handleLogin() {
    if (!_formKey.currentState!.validate()) return;
    ref
        .read(authScreenProvider.notifier)
        .signIn(_emailController.text.trim(), _passwordController.text);
  }

  void _handleGoogleSignIn() {
    ref.read(authScreenProvider.notifier).signInWithGoogle();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authScreenProvider);
    final isLoading = authState.state == AuthScreenState.loading;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    ref.listen<AuthScreenData>(authScreenProvider, (prev, next) {
      if (next.state == AuthScreenState.success) {
        context.go('/today');
      }
    });

    return Scaffold(
      body: AuthLayout(
        child: FadeTransition(
          opacity: _fadeIn,
          child: SlideTransition(
            position: _slideUp,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                // ── Heading ────────────────────────────────────────────
                Text(
                  'Welcome back',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.5,
                    color:
                        isDark
                            ? AppColors.darkTextPrimary
                            : AppColors.textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),
                AppSpacing.gapSm,
                Text(
                  'Sign in to your MedQ account',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color:
                        isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),

                // ── Google Sign-In ────────────────────────────────────
                GoogleSignInButton(
                  onPressed: isLoading ? null : _handleGoogleSignIn,
                  isLoading: isLoading,
                  label: 'Continue with Google',
                ),
                const SizedBox(height: 20),

                // ── Divider ───────────────────────────────────────────
                _OrDivider(label: 'OR CONTINUE WITH EMAIL', isDark: isDark),
                const SizedBox(height: 20),

                // ── Form ──────────────────────────────────────────────
                Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Error banner
                      if (authState.errorMessage != null) ...[
                        ErrorBanner(
                          message: authState.errorMessage!,
                          onDismiss:
                              () =>
                                  ref
                                      .read(authScreenProvider.notifier)
                                      .clearError(),
                        ),
                        const SizedBox(height: 14),
                      ],

                      // Email field
                      const _FieldLabel(text: 'Email'),
                      AppSpacing.gapXs,
                      TextFormField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          hintText: 'you@example.com',
                        ),
                        validator: Validators.email,
                      ),
                      const SizedBox(height: 14),

                      // Password label row
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          const _FieldLabel(text: 'Password'),
                          TextButton(
                            onPressed: () => context.go('/forgot-password'),
                            style: TextButton.styleFrom(
                              minimumSize: Size.zero,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 4,
                                vertical: 2,
                              ),
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              foregroundColor: AppColors.primary,
                            ),
                            child: Text(
                              'Forgot password?',
                              style: Theme.of(
                                context,
                              ).textTheme.labelSmall?.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                      AppSpacing.gapXs,
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _handleLogin(),
                        decoration: InputDecoration(
                          hintText: 'Your password',
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              size: 18,
                              color:
                                  isDark
                                      ? AppColors.darkTextSecondary
                                      : AppColors.textSecondary,
                            ),
                            onPressed:
                                () => setState(
                                  () => _obscurePassword = !_obscurePassword,
                                ),
                            splashRadius: 18,
                          ),
                        ),
                        validator: _validatePassword,
                      ),
                      const SizedBox(height: 20),

                      // Sign In button
                      PrimaryButton(
                        label: 'Sign In',
                        onPressed: isLoading ? null : _handleLogin,
                        isLoading: isLoading,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // ── Sign up link ──────────────────────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      "Don't have an account? ",
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color:
                            isDark
                                ? AppColors.darkTextSecondary
                                : AppColors.textSecondary,
                      ),
                    ),
                    GestureDetector(
                      onTap: () => context.go('/signup'),
                      child: Text(
                        'Sign up',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
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

// ─── Shared helpers ──────────────────────────────────────────────────────────

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel({required this.text});

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(
        context,
      ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
    );
  }
}

class _OrDivider extends StatelessWidget {
  final String label;
  final bool isDark;

  const _OrDivider({required this.label, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        Divider(
          color: isDark ? AppColors.darkBorder : AppColors.border,
          height: 1,
          thickness: 1,
        ),
        Container(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color:
                  isDark ? AppColors.darkTextTertiary : AppColors.textTertiary,
              letterSpacing: 0.8,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
}
