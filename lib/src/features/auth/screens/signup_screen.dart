// FILE: lib/src/features/auth/screens/signup_screen.dart
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
  final _confirmController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  bool _googleFlow = false;

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
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  String? _validateName(String? value) {
    if (value == null || value.trim().isEmpty) return 'Full name is required';
    return null;
  }

  String? _validatePassword(String? value) {
    if (value == null || value.isEmpty) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    return null;
  }

  String? _validateConfirm(String? value) {
    if (value == null || value.isEmpty) return 'Please confirm your password';
    if (value != _passwordController.text) return 'Passwords do not match';
    return null;
  }

  void _handleSignUp() {
    if (!_formKey.currentState!.validate()) return;
    _googleFlow = false;
    ref
        .read(authScreenProvider.notifier)
        .signUp(
          _nameController.text.trim(),
          _emailController.text.trim(),
          _passwordController.text,
        );
  }

  void _handleGoogleSignIn() {
    _googleFlow = true;
    ref.read(authScreenProvider.notifier).signInWithGoogle();
  }

  _PasswordStrength? get _strength =>
      _passwordStrength(_passwordController.text);

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authScreenProvider);
    final isLoading = authState.state == AuthScreenState.loading;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    ref.listen<AuthScreenData>(authScreenProvider, (prev, next) {
      if (next.state == AuthScreenState.success) {
        if (_googleFlow) {
          context.go('/today');
        } else {
          context.go('/today');
        }
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
                // ── Heading ──────────────────────────────────────────
                Text(
                  'Create your account',
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
                  'Join MedQ and start studying smarter',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color:
                        isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),

                // ── Google Sign-Up ────────────────────────────────────
                GoogleSignInButton(
                  onPressed: isLoading ? null : _handleGoogleSignIn,
                  isLoading: isLoading && _googleFlow,
                  label: 'Sign up with Google',
                ),
                const SizedBox(height: 20),

                // ── Divider ───────────────────────────────────────────
                _OrDivider(label: 'OR SIGN UP WITH EMAIL', isDark: isDark),
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

                      // Full Name
                      const _FieldLabel(text: 'Full Name'),
                      AppSpacing.gapXs,
                      TextFormField(
                        controller: _nameController,
                        textInputAction: TextInputAction.next,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(
                          hintText: 'Dr. Jane Smith',
                        ),
                        validator: _validateName,
                      ),
                      const SizedBox(height: 14),

                      // Email
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

                      // Password
                      const _FieldLabel(text: 'Password'),
                      AppSpacing.gapXs,
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        textInputAction: TextInputAction.next,
                        onChanged: (_) => setState(() {}),
                        decoration: InputDecoration(
                          hintText: 'At least 8 characters',
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

                      // Password strength indicator
                      if (_strength != null) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: List.generate(5, (i) {
                            final active = i < _strength!.score;
                            return Expanded(
                              child: Container(
                                height: 4,
                                margin: EdgeInsets.only(right: i == 4 ? 0 : 4),
                                decoration: BoxDecoration(
                                  color:
                                      active
                                          ? _strength!.color
                                          : (isDark
                                              ? AppColors.darkSurfaceVariant
                                              : AppColors.surfaceVariant),
                                  borderRadius: BorderRadius.circular(99),
                                ),
                              ),
                            );
                          }),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _strength!.label,
                          style: Theme.of(
                            context,
                          ).textTheme.labelSmall?.copyWith(
                            color: _strength!.color,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                      const SizedBox(height: 14),

                      // Confirm Password
                      const _FieldLabel(text: 'Confirm Password'),
                      AppSpacing.gapXs,
                      TextFormField(
                        controller: _confirmController,
                        obscureText: _obscureConfirm,
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _handleSignUp(),
                        decoration: InputDecoration(
                          hintText: 'Repeat your password',
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscureConfirm
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
                                  () => _obscureConfirm = !_obscureConfirm,
                                ),
                            splashRadius: 18,
                          ),
                        ),
                        validator: _validateConfirm,
                      ),
                      const SizedBox(height: 20),

                      // Create Account button
                      PrimaryButton(
                        label: 'Create Account',
                        onPressed: isLoading ? null : _handleSignUp,
                        isLoading: isLoading && !_googleFlow,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // ── Sign in link ──────────────────────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Already have an account? ',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color:
                            isDark
                                ? AppColors.darkTextSecondary
                                : AppColors.textSecondary,
                      ),
                    ),
                    GestureDetector(
                      onTap: () => context.go('/login'),
                      child: Text(
                        'Sign in',
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

// ─── Password strength ───────────────────────────────────────────────────────

class _PasswordStrength {
  final int score;
  final String label;
  final Color color;
  const _PasswordStrength({
    required this.score,
    required this.label,
    required this.color,
  });
}

_PasswordStrength? _passwordStrength(String pw) {
  if (pw.isEmpty) return null;
  var score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (RegExp(r'[A-Z]').hasMatch(pw) && RegExp(r'[a-z]').hasMatch(pw)) score++;
  if (RegExp(r'[0-9]').hasMatch(pw)) score++;
  if (RegExp(r'[^A-Za-z0-9]').hasMatch(pw)) score++;

  if (score <= 1) {
    return const _PasswordStrength(
      score: 1,
      label: 'Weak',
      color: Color(0xFFEF4444),
    );
  }
  if (score == 2) {
    return const _PasswordStrength(
      score: 2,
      label: 'Fair',
      color: Color(0xFFF97316),
    );
  }
  if (score == 3) {
    return const _PasswordStrength(
      score: 3,
      label: 'Good',
      color: Color(0xFFEAB308),
    );
  }
  if (score == 4) {
    return const _PasswordStrength(
      score: 4,
      label: 'Strong',
      color: Color(0xFF22C55E),
    );
  }
  return const _PasswordStrength(
    score: 5,
    label: 'Very strong',
    color: Color(0xFF10B981),
  );
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
