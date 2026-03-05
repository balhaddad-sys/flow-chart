import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';

/// Bottom sheet for configuring quiz before starting.
/// Returns the selected question count, or null if dismissed.
class QuizSetupSheet extends StatefulWidget {
  final String? sectionTitle;
  final int availableCount;

  const QuizSetupSheet({
    super.key,
    this.sectionTitle,
    this.availableCount = 0,
  });

  /// Show the setup sheet and return the selected count, or null if cancelled.
  static Future<int?> show(
    BuildContext context, {
    String? sectionTitle,
    int availableCount = 0,
  }) {
    return showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => QuizSetupSheet(
        sectionTitle: sectionTitle,
        availableCount: availableCount,
      ),
    );
  }

  @override
  State<QuizSetupSheet> createState() => _QuizSetupSheetState();
}

class _QuizSetupSheetState extends State<QuizSetupSheet> {
  int _selectedCount = 10;

  static const _countOptions = [5, 10, 15, 20];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark
                      ? AppColors.darkBorder
                      : AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),

              // Title
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.quiz_outlined,
                      color: AppColors.primary,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Quiz Setup',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        if (widget.sectionTitle != null)
                          Text(
                            widget.sectionTitle!,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                  color: isDark
                                      ? AppColors.darkTextSecondary
                                      : AppColors.textSecondary,
                                ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Count selector label
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Number of Questions',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
              const SizedBox(height: 10),

              // Count option chips
              Row(
                children: _countOptions.map((count) {
                  final isSelected = count == _selectedCount;
                  final isDisabled = widget.availableCount > 0 &&
                      count > widget.availableCount;

                  return Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(
                        right: count != _countOptions.last ? 8 : 0,
                      ),
                      child: GestureDetector(
                        onTap: isDisabled
                            ? null
                            : () {
                                HapticFeedback.selectionClick();
                                setState(() => _selectedCount = count);
                              },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppColors.primary
                                : isDisabled
                                    ? (isDark
                                        ? AppColors.darkSurfaceVariant
                                            .withValues(alpha: 0.5)
                                        : AppColors.surfaceVariant
                                            .withValues(alpha: 0.5))
                                    : (isDark
                                        ? AppColors.darkSurfaceVariant
                                        : AppColors.surfaceVariant),
                            borderRadius:
                                BorderRadius.circular(AppSpacing.radiusMd),
                            border: Border.all(
                              color: isSelected
                                  ? AppColors.primary
                                  : isDisabled
                                      ? Colors.transparent
                                      : (isDark
                                          ? AppColors.darkBorder
                                          : AppColors.border),
                              width: isSelected ? 1.5 : 1,
                            ),
                          ),
                          child: Column(
                            children: [
                              Text(
                                '$count',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  color: isSelected
                                      ? Colors.white
                                      : isDisabled
                                          ? (isDark
                                              ? AppColors.darkTextTertiary
                                              : AppColors.textTertiary)
                                          : (isDark
                                              ? AppColors.darkTextPrimary
                                              : AppColors.textPrimary),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Qs',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                  color: isSelected
                                      ? Colors.white.withValues(alpha: 0.8)
                                      : (isDark
                                          ? AppColors.darkTextTertiary
                                          : AppColors.textTertiary),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),

              if (widget.availableCount > 0) ...[
                const SizedBox(height: 8),
                Text(
                  '${widget.availableCount} questions available',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? AppColors.darkTextTertiary
                            : AppColors.textTertiary,
                        fontSize: 11,
                      ),
                ),
              ],

              const SizedBox(height: 24),

              // Start button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context, _selectedCount),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  child: const Text('Start Quiz'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
