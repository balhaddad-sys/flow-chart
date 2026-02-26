import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';

/// Dialog for flagging a question — matches the web app's flag-question-dialog.
class FlagQuestionDialog extends StatefulWidget {
  final String questionId;
  final Future<void> Function(String questionId, String? reason) onSubmit;

  const FlagQuestionDialog({
    super.key,
    required this.questionId,
    required this.onSubmit,
  });

  /// Shows the dialog and returns `true` if the flag was submitted.
  static Future<bool> show(
    BuildContext context, {
    required String questionId,
    required Future<void> Function(String questionId, String? reason) onSubmit,
  }) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) =>
          FlagQuestionDialog(questionId: questionId, onSubmit: onSubmit),
    );
    return result ?? false;
  }

  @override
  State<FlagQuestionDialog> createState() => _FlagQuestionDialogState();
}

class _FlagQuestionDialogState extends State<FlagQuestionDialog> {
  final _controller = TextEditingController();
  bool _submitting = false;
  String? _selectedReason;

  static const _reasons = [
    'Incorrect answer',
    'Unclear question',
    'Outdated information',
    'Duplicate question',
    'Other',
  ];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    final reason = _selectedReason == 'Other'
        ? _controller.text.trim()
        : _selectedReason;
    try {
      await widget.onSubmit(widget.questionId, reason);
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to flag question'), behavior: SnackBarBehavior.floating),
        );
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurfaceVariant : AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(99)),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              const Icon(Icons.flag_outlined, size: 18, color: AppColors.warning),
              const SizedBox(width: 8),
              Text('Flag Question',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 4),
          Text('Help us improve by reporting an issue with this question.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary)),
          const SizedBox(height: 16),
          ...(_reasons.map((r) => RadioListTile<String>(
                value: r,
                groupValue: _selectedReason,
                onChanged: (v) => setState(() => _selectedReason = v),
                title: Text(r, style: const TextStyle(fontSize: 14)),
                dense: true,
                contentPadding: EdgeInsets.zero,
                activeColor: AppColors.primary,
              ))),
          if (_selectedReason == 'Other') ...[
            const SizedBox(height: 8),
            TextField(
              controller: _controller,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: 'Describe the issue...',
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppSpacing.radiusSm)),
              ),
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _selectedReason != null && !_submitting ? _submit : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.warning,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd)),
              ),
              child: _submitting
                  ? const SizedBox(width: 18, height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Submit Flag'),
            ),
          ),
        ],
      ),
    );
  }
}
