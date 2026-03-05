import 'dart:io';

import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_spacing.dart';
import '../services/cloud_functions_service.dart';
import 'primary_button.dart';

// ── Friendly error message conversion ────────────────────────────────────────

class ErrorHandler {
  ErrorHandler._();

  /// Converts any exception/error into a user-friendly message.
  static String userMessage(Object error) {
    if (error is CloudFunctionException) {
      return _cloudFunctionMessage(error);
    }
    if (error is SocketException) {
      return 'No internet connection. Check your network and try again.';
    }
    if (error is HttpException) {
      return 'Server error. Please try again later.';
    }
    final msg = error.toString();
    if (msg.contains('network') || msg.contains('SocketException')) {
      return 'No internet connection. Check your network and try again.';
    }
    if (msg.contains('permission') || msg.contains('PERMISSION_DENIED')) {
      return 'You don\'t have permission to access this. Please sign in again.';
    }
    if (msg.contains('not-found') || msg.contains('NOT_FOUND')) {
      return 'The requested data was not found.';
    }
    if (msg.contains('timeout') || msg.contains('DEADLINE_EXCEEDED')) {
      return 'Request timed out. Please try again.';
    }
    if (msg.contains('unauthenticated') || msg.contains('UNAUTHENTICATED')) {
      return 'Your session has expired. Please sign in again.';
    }
    return 'Something went wrong. Please try again.';
  }

  static String _cloudFunctionMessage(CloudFunctionException e) {
    // If the backend provided a human-readable message, use it directly
    final msg = e.message;
    if (msg.isNotEmpty &&
        msg != 'Unknown error' &&
        !msg.startsWith('Unexpected error')) {
      return msg;
    }
    // Fallback based on code
    switch (e.code) {
      case 'DEADLINE_EXCEEDED':
        return 'Request timed out. Please try again.';
      case 'UNAVAILABLE':
        return 'Service temporarily unavailable. Please try again shortly.';
      case 'RESOURCE_EXHAUSTED':
        return 'Too many requests. Please wait a moment and try again.';
      case 'PERMISSION_DENIED':
      case 'UNAUTHENTICATED':
        return 'Access denied. Please sign in again.';
      case 'NOT_FOUND':
        return 'The requested data was not found.';
      case 'INVALID_RESPONSE':
        return 'Received an unexpected response. Please try again.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }
}

// ── Full-screen error state widget ───────────────────────────────────────────

class ErrorStateView extends StatelessWidget {
  final Object? error;
  final String? customMessage;
  final VoidCallback? onRetry;
  final String retryLabel;

  const ErrorStateView({
    super.key,
    this.error,
    this.customMessage,
    this.onRetry,
    this.retryLabel = 'Try Again',
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final message =
        customMessage ?? (error != null ? ErrorHandler.userMessage(error!) : 'Something went wrong.');

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: isDark
                      ? [
                          AppColors.error.withValues(alpha: 0.15),
                          AppColors.error.withValues(alpha: 0.05),
                        ]
                      : [
                          AppColors.errorLight,
                          AppColors.error.withValues(alpha: 0.05),
                        ],
                ),
                borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
              ),
              child: Icon(
                Icons.warning_amber_rounded,
                size: 38,
                color: isDark
                    ? AppColors.error.withValues(alpha: 0.8)
                    : AppColors.error.withValues(alpha: 0.6),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Oops!',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 280),
              child: Text(
                message,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textSecondary,
                      height: 1.5,
                    ),
                textAlign: TextAlign.center,
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 24),
              SizedBox(
                width: 220,
                child: PrimaryButton(
                  label: retryLabel,
                  onPressed: onRetry,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
