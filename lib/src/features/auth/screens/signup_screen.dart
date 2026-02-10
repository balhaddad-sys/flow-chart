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

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
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

    ref.listen<AuthScreenData>(authScreenProvider, (prev, next) {
      if (next.state == AuthScreenState.success) {
        context.go('/onboarding');
      }
    });

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.surface,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.border),
            ),
            child: const Icon(Icons.arrow_back, size: 18),
          ),
          onPressed: () => context.go('/login'),
        ),
      ),
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
                    Text(
                      'Create Account',
                      style: Theme.of(context).textTheme.displayMedium,
                    ),
                    AppSpacing.gapXs,
                    Text(
                      'Start your personalized study journey',
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

                    TextFormField(
                      controller: _nameController,
                      decoration: const InputDecoration(
                        labelText: 'Full Name',
                        prefixIcon: Icon(Icons.person_outline_rounded, size: 20),
                      ),
                      validator: (v) => Validators.required(v, 'Name'),
                    ),
                    AppSpacing.gapMd,
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
                      label: 'Create Account',
                      onPressed: _handleSignUp,
                      isLoading: authState.state == AuthScreenState.loading,
                    ),
                    AppSpacing.gapLg,

                    Row(
                      children: [
                        Expanded(child: Container(height: 1, color: AppColors.border)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                          child: Text(
                            'or',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: AppColors.textTertiary,
                                ),
                          ),
                        ),
                        Expanded(child: Container(height: 1, color: AppColors.border)),
                      ],
                    ),
                    AppSpacing.gapLg,

                    GoogleSignInButton(
                      onPressed: _handleGoogleSignIn,
                      isLoading: authState.state == AuthScreenState.loading,
                      label: 'Sign up with Google',
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
