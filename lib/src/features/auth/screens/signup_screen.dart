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

class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key});

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
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
      duration: const Duration(milliseconds: 800),
    );
    _fadeIn = CurvedAnimation(parent: _animController, curve: Curves.easeOut);
    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.05),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleSignUp() {
    if (!_formKey.currentState!.validate()) return;
    ref.read(authScreenProvider.notifier).signUp(
          _nameController.text.trim(),
          _emailController.text.trim(),
          _passwordController.text,
        );
  }

  void _handleGoogleSignIn() {
    ref.read(authScreenProvider.notifier).signInWithGoogle();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authScreenProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    ref.listen<AuthScreenData>(authScreenProvider, (prev, next) {
      if (next.state == AuthScreenState.success) {
        context.go('/onboarding');
      }
    });

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: isDark ? null : AppColors.subtleGradient,
          color: isDark ? AppColors.darkBackground : null,
        ),
        child: SafeArea(
          child: Column(
            children: [
              // ── Top bar ───────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Row(
                  children: [
                    IconButton(
                      icon: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: isDark
                              ? AppColors.darkSurfaceVariant
                              : AppColors.surfaceVariant,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.arrow_back_rounded,
                          size: 18,
                          color: isDark
                              ? AppColors.darkTextPrimary
                              : AppColors.textPrimary,
                        ),
                      ),
                      onPressed: () => context.go('/login'),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: FadeTransition(
                      opacity: _fadeIn,
                      child: SlideTransition(
                        position: _slideUp,
                        child: ConstrainedBox(
                          constraints:
                              const BoxConstraints(maxWidth: AppSpacing.maxAuthWidth),
                          child: Form(
                            key: _formKey,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                // ── Header ──────────────────────────────────
                                Text(
                                  'Create Account',
                                  style: Theme.of(context)
                                      .textTheme
                                      .headlineLarge
                                      ?.copyWith(
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: -0.5,
                                      ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'Start your personalized study journey',
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodyMedium
                                      ?.copyWith(
                                        color: isDark
                                            ? AppColors.darkTextSecondary
                                            : AppColors.textSecondary,
                                      ),
                                ),
                                const SizedBox(height: 28),

                                // ── Error banner ────────────────────────────
                                if (authState.errorMessage != null) ...[
                                  ErrorBanner(
                                    message: authState.errorMessage!,
                                    onDismiss: () => ref
                                        .read(authScreenProvider.notifier)
                                        .clearError(),
                                  ),
                                  AppSpacing.gapMd,
                                ],

                                // ── Form card ───────────────────────────────
                                Container(
                                  padding: const EdgeInsets.all(24),
                                  decoration: BoxDecoration(
                                    color: isDark
                                        ? AppColors.darkSurface
                                        : AppColors.surface,
                                    borderRadius: BorderRadius.circular(
                                        AppSpacing.radiusXl),
                                    border: Border.all(
                                      color: isDark
                                          ? AppColors.darkBorder
                                              .withValues(alpha: 0.4)
                                          : AppColors.border
                                              .withValues(alpha: 0.5),
                                    ),
                                    boxShadow:
                                        isDark ? null : AppSpacing.shadowMd,
                                  ),
                                  child: Column(
                                    children: [
                                      TextFormField(
                                        controller: _nameController,
                                        decoration: const InputDecoration(
                                          labelText: 'Full Name',
                                          hintText: 'John Doe',
                                          prefixIcon: Icon(
                                              Icons.person_outline,
                                              size: 20),
                                        ),
                                        textInputAction: TextInputAction.next,
                                        validator: (v) =>
                                            Validators.required(v, 'Name'),
                                      ),
                                      AppSpacing.gapMd,
                                      TextFormField(
                                        controller: _emailController,
                                        decoration: const InputDecoration(
                                          labelText: 'Email address',
                                          hintText: 'you@example.com',
                                          prefixIcon: Icon(
                                              Icons.email_outlined,
                                              size: 20),
                                        ),
                                        keyboardType:
                                            TextInputType.emailAddress,
                                        textInputAction: TextInputAction.next,
                                        validator: Validators.email,
                                      ),
                                      AppSpacing.gapMd,
                                      TextFormField(
                                        controller: _passwordController,
                                        decoration: InputDecoration(
                                          labelText: 'Password',
                                          hintText: 'Min. 8 characters',
                                          prefixIcon: const Icon(
                                              Icons.lock_outline,
                                              size: 20),
                                          suffixIcon: IconButton(
                                            icon: Icon(
                                              _obscurePassword
                                                  ? Icons
                                                      .visibility_off_outlined
                                                  : Icons.visibility_outlined,
                                              size: 20,
                                            ),
                                            onPressed: () => setState(() =>
                                                _obscurePassword =
                                                    !_obscurePassword),
                                          ),
                                        ),
                                        obscureText: _obscurePassword,
                                        textInputAction: TextInputAction.done,
                                        onFieldSubmitted: (_) =>
                                            _handleSignUp(),
                                        validator: Validators.password,
                                      ),
                                      const SizedBox(height: 24),
                                      PrimaryButton(
                                        label: 'Create Account',
                                        onPressed: _handleSignUp,
                                        isLoading: authState.state ==
                                            AuthScreenState.loading,
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 24),

                                // ── Divider ─────────────────────────────────
                                Row(
                                  children: [
                                    Expanded(
                                      child: Divider(
                                        color: isDark
                                            ? AppColors.darkBorder
                                            : AppColors.border,
                                      ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 16),
                                      child: Text(
                                        'or continue with',
                                        style: Theme.of(context)
                                            .textTheme
                                            .labelMedium
                                            ?.copyWith(
                                              color: isDark
                                                  ? AppColors.darkTextTertiary
                                                  : AppColors.textTertiary,
                                            ),
                                      ),
                                    ),
                                    Expanded(
                                      child: Divider(
                                        color: isDark
                                            ? AppColors.darkBorder
                                            : AppColors.border,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 24),

                                GoogleSignInButton(
                                  onPressed: _handleGoogleSignIn,
                                  isLoading: authState.state ==
                                      AuthScreenState.loading,
                                  label: 'Sign up with Google',
                                ),
                                AppSpacing.gapXl,
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
