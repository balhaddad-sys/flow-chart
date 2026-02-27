import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/providers/user_provider.dart';
import '../../../core/services/storage_service.dart';
import '../../../core/utils/error_handler.dart';
import '../providers/session_provider.dart';

/// AI-generated study notes tab (Overview · Key Points · Memory Aids).
/// Mirrors the "Notes" tab in the web study session page.
class NotesTab extends ConsumerStatefulWidget {
  final String sectionId;
  const NotesTab({super.key, required this.sectionId});

  @override
  ConsumerState<NotesTab> createState() => _NotesTabState();
}

class _NotesTabState extends ConsumerState<NotesTab>
    with AutomaticKeepAliveClientMixin {
  bool _loading = false;
  String? _error;
  _SectionSummary? _summary;

  @override
  bool get wantKeepAlive => true;

  Future<void> _generate() async {
    final sectionAsync = ref.read(sectionForSessionProvider(widget.sectionId));
    final section = sectionAsync.valueOrNull;
    if (section == null) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      // 1. Fetch the raw text blob from Storage.
      final storage = StorageService();
      final text = await storage.getTextBlob(section.textBlobPath);

      if (text.trim().isEmpty) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = 'No text content found for this section.';
        });
        return;
      }

      // 2. Call the cloud function.
      final result = await ref
          .read(cloudFunctionsServiceProvider)
          .generateSectionSummary(
            title: section.title,
            sectionText: text,
          );

      if (!mounted) return;
      setState(() {
        _loading = false;
        _summary = _SectionSummary.fromMap(result);
      });
    } catch (e, st) {
      ErrorHandler.logError(e, st);
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = ErrorHandler.userMessage(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_loading) {
      return Center(
        child: Padding(
          padding: AppSpacing.screenPadding,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(),
              AppSpacing.gapMd,
              Text(
                'Generating study notes…',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.textSecondary),
              ),
              AppSpacing.gapXs,
              Text(
                'Building a concise clinical summary from your section.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: isDark
                        ? AppColors.darkTextTertiary
                        : AppColors.textTertiary),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    if (_summary != null) {
      return _buildSummary(context, isDark);
    }

    if (_error != null) {
      return _buildError(context, isDark);
    }

    return _buildEmpty(context, isDark);
  }

  Widget _buildEmpty(BuildContext context, bool isDark) {
    return Center(
      child: Padding(
        padding: AppSpacing.screenPadding,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: isDark
                    ? AppColors.darkSurfaceVariant
                    : AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
              ),
              child: Icon(
                Icons.lightbulb_outline_rounded,
                size: 28,
                color:
                    isDark ? AppColors.darkTextTertiary : AppColors.textTertiary,
              ),
            ),
            AppSpacing.gapMd,
            Text('AI Study Notes',
                style: Theme.of(context).textTheme.titleMedium),
            AppSpacing.gapXs,
            Text(
              'Generate a concise summary with key points and memory aids from this section.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            AppSpacing.gapLg,
            ElevatedButton.icon(
              onPressed: _generate,
              icon: const Icon(Icons.auto_awesome_rounded, size: 16),
              label: const Text('Generate Notes'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg, vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(AppSpacing.radiusMd)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError(BuildContext context, bool isDark) {
    return Center(
      child: Padding(
        padding: AppSpacing.screenPadding,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline_rounded,
                size: 40,
                color: isDark
                    ? AppColors.darkTextTertiary
                    : AppColors.textTertiary),
            AppSpacing.gapMd,
            Text(_error!,
                style: Theme.of(context).textTheme.bodyMedium,
                textAlign: TextAlign.center),
            AppSpacing.gapMd,
            OutlinedButton(
              onPressed: _generate,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummary(BuildContext context, bool isDark) {
    final s = _summary!;
    return ListView(
      padding: AppSpacing.cardPaddingLarge,
      children: [
        // Overview
        _NoteCard(
          icon: Icons.lightbulb_outline_rounded,
          title: 'Overview',
          iconColor: AppColors.primary,
          iconBg: AppColors.primarySurface,
          isDark: isDark,
          child: Text(
            s.summary,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                height: 1.6,
                color:
                    isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
          ),
        ),
        AppSpacing.gapMd,

        // Key Points
        if (s.keyPoints.isNotEmpty) ...[
          _NoteCard(
            icon: Icons.flag_outlined,
            title: 'Key Points',
            iconColor: const Color(0xFF2563EB),
            iconBg: const Color(0xFFDBEAFE),
            isDark: isDark,
            child: Column(
              children: s.keyPoints
                  .map((point) => _BulletRow(
                        text: point,
                        color: const Color(0xFF3B82F6),
                        isDark: isDark,
                      ))
                  .toList(),
            ),
          ),
          AppSpacing.gapMd,
        ],

        // Memory Aids
        if (s.mnemonics.isNotEmpty) ...[
          _NoteCard(
            icon: Icons.psychology_outlined,
            title: 'Memory Aids',
            iconColor: const Color(0xFF7C3AED),
            iconBg: const Color(0xFFEDE9FE),
            isDark: isDark,
            accent: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: s.mnemonics
                  .map((m) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          m,
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(
                                  height: 1.5,
                                  color: isDark
                                      ? const Color(0xFFC4B5FD)
                                      : const Color(0xFF6D28D9)),
                        ),
                      ))
                  .toList(),
            ),
          ),
          AppSpacing.gapMd,
        ],

        // Regenerate button
        Center(
          child: TextButton.icon(
            onPressed: _generate,
            icon: const Icon(Icons.refresh_rounded, size: 16),
            label: const Text('Regenerate'),
            style: TextButton.styleFrom(
              foregroundColor:
                  isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
            ),
          ),
        ),
      ],
    );
  }
}

// ── Data model ─────────────────────────────────────────────────────────────

class _SectionSummary {
  final String summary;
  final List<String> keyPoints;
  final List<String> mnemonics;

  const _SectionSummary({
    required this.summary,
    required this.keyPoints,
    required this.mnemonics,
  });

  factory _SectionSummary.fromMap(Map<String, dynamic> map) {
    return _SectionSummary(
      summary: (map['summary'] as String? ?? '').trim(),
      keyPoints: (map['keyPoints'] as List?)
              ?.whereType<String>()
              .map((s) => s.trim())
              .where((s) => s.isNotEmpty)
              .toList() ??
          [],
      mnemonics: (map['mnemonics'] as List?)
              ?.whereType<String>()
              .map((s) => s.trim())
              .where((s) => s.isNotEmpty)
              .toList() ??
          [],
    );
  }
}

// ── Shared sub-widgets ──────────────────────────────────────────────────────

class _NoteCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color iconColor;
  final Color iconBg;
  final bool isDark;
  final bool accent;
  final Widget child;

  const _NoteCard({
    required this.icon,
    required this.title,
    required this.iconColor,
    required this.iconBg,
    required this.isDark,
    required this.child,
    this.accent = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: AppSpacing.cardPadding,
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                ),
                child: Icon(icon, size: 16, color: iconColor),
              ),
              AppSpacing.hGapSm,
              Text(title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600)),
            ],
          ),
          AppSpacing.gapMd,
          child,
        ],
      ),
    );
  }
}

class _BulletRow extends StatelessWidget {
  final String text;
  final Color color;
  final bool isDark;

  const _BulletRow({required this.text, required this.color, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 7),
            child: Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.6),
                shape: BoxShape.circle,
              ),
            ),
          ),
          AppSpacing.hGapSm,
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  height: 1.5,
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}
