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

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogin() {
    if (!_formKey.currentState!.validate()) return;
    ref.read(authScreenProvider.notifier).signIn(
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

    ref.listen<AuthScreenData>(authScreenProvider, (prev, next) {
      if (next.state == AuthScreenState.success) {
        context.go('/home');
      }
    });

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Brand header
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        gradient: AppColors.primaryGradient,
                        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.3),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.school_rounded,
                        color: Colors.white,
                        size: 32,
                      ),
                    ),
                    AppSpacing.gapLg,
                    Text(
                      'Welcome back',
                      style: Theme.of(context).textTheme.displayMedium,
                    ),
                    AppSpacing.gapXs,
                    Text(
                      'Sign in to continue your study journey',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.textTertiary,
                          ),
                    ),
                    AppSpacing.gapXl,

                    if (authState.errorMessage != null) ...[
                      ErrorBanner(
                        message: authState.errorMessage!,
                        onDismiss: () =>
                            ref.read(authScreenProvider.notifier).clearError(),
                      ),
                      AppSpacing.gapMd,
                    ],

                    // Email field
                    TextFormField(
                      controller: _emailController,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        prefixIcon: Icon(Icons.email_outlined, size: 20),
                      ),
                      keyboardType: TextInputType.emailAddress,
                      validator: Validators.email,
                    ),
                    AppSpacing.gapMd,

                    // Password field
                    TextFormField(
                      controller: _passwordController,
                      decoration: const InputDecoration(
                        labelText: 'Password',
                        prefixIcon: Icon(Icons.lock_outline_rounded, size: 20),
                      ),
                      obscureText: true,
                      validator: Validators.password,
                    ),
                    AppSpacing.gapLg,

                    PrimaryButton(
                      label: 'Sign In',
                      onPressed: _handleLogin,
                      isLoading: authState.state == AuthScreenState.loading,
                    ),
                    AppSpacing.gapLg,

                    // Divider
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            height: 1,
                            color: AppColors.border,
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.md),
                          child: Text(
                            'or',
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: AppColors.textTertiary,
                                    ),
                          ),
                        ),
                        Expanded(
                          child: Container(
                            height: 1,
                            color: AppColors.border,
                          ),
                        ),
                      ],
                    ),
                    AppSpacing.gapLg,

                    GoogleSignInButton(
                      onPressed: _handleGoogleSignIn,
                      isLoading: authState.state == AuthScreenState.loading,
                    ),
                    AppSpacing.gapLg,

                    Center(
                      child: TextButton(
                        onPressed: () => context.go('/signup'),
                        style: TextButton.styleFrom(
                          foregroundColor: AppColors.primary,
                        ),
                        child: RichText(
                          text: TextSpan(
                            text: 'Don\'t have an account? ',
                            style: Theme.of(context).textTheme.bodyMedium,
                            children: [
                              TextSpan(
                                text: 'Sign Up',
                                style: TextStyle(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
