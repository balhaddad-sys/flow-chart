import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_spacing.dart';

/// Lightweight markdown-like renderer for AI-generated text.
/// Handles: **bold**, *italic*, ## headings, - bullet lists, 1. numbered lists,
/// `code`, --- dividers, and paragraph breaks.
///
/// Does NOT add a flutter_markdown dependency — pure Flutter widgets.
class FormattedText extends StatelessWidget {
  final String text;
  final TextStyle? baseStyle;
  final bool selectable;

  const FormattedText({
    super.key,
    required this.text,
    this.baseStyle,
    this.selectable = true,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final style = baseStyle ??
        Theme.of(context).textTheme.bodyMedium?.copyWith(
              height: 1.7,
              color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
            ) ??
        const TextStyle(height: 1.7);

    final blocks = _parseBlocks(text);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: blocks.map((block) => _buildBlock(context, block, style, isDark)).toList(),
    );
  }

  Widget _buildBlock(BuildContext context, _Block block, TextStyle style, bool isDark) {
    switch (block.type) {
      case _BlockType.heading:
        final level = block.meta as int;
        final fontSize = level == 1 ? 20.0 : level == 2 ? 17.0 : 15.0;
        return Padding(
          padding: EdgeInsets.only(top: level == 1 ? 20 : 14, bottom: 6),
          child: Text(
            block.text,
            style: style.copyWith(
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.3,
            ),
          ),
        );

      case _BlockType.bullet:
        return Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 6,
                height: 6,
                margin: const EdgeInsets.only(top: 8, right: 10),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.7),
                  shape: BoxShape.circle,
                ),
              ),
              Expanded(child: _richText(block.text, style)),
            ],
          ),
        );

      case _BlockType.numbered:
        final number = block.meta as String;
        return Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 24,
                child: Text(
                  '$number.',
                  style: style.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
              ),
              Expanded(child: _richText(block.text, style)),
            ],
          ),
        );

      case _BlockType.divider:
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Divider(
            color: isDark ? AppColors.darkBorder : AppColors.border,
          ),
        );

      case _BlockType.code:
        return Container(
          width: double.infinity,
          margin: const EdgeInsets.symmetric(vertical: 6),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isDark
                ? AppColors.darkSurfaceVariant
                : const Color(0xFFF6F8FA),
            borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
            border: Border.all(
              color: isDark ? AppColors.darkBorder : const Color(0xFFE1E4E8),
            ),
          ),
          child: SelectableText(
            block.text,
            style: style.copyWith(
              fontFamily: 'monospace',
              fontSize: (style.fontSize ?? 14) - 1,
            ),
          ),
        );

      case _BlockType.paragraph:
        if (block.text.trim().isEmpty) {
          return const SizedBox(height: 8);
        }
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: selectable
              ? SelectableText.rich(_buildRichSpan(block.text, style))
              : Text.rich(_buildRichSpan(block.text, style)),
        );
    }
  }

  /// Build a RichText span handling **bold**, *italic*, `code`
  Widget _richText(String text, TextStyle style) {
    return selectable
        ? SelectableText.rich(_buildRichSpan(text, style))
        : Text.rich(_buildRichSpan(text, style));
  }

  TextSpan _buildRichSpan(String text, TextStyle style) {
    final spans = <InlineSpan>[];
    final regex = RegExp(r'\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`');
    int lastEnd = 0;

    for (final match in regex.allMatches(text)) {
      if (match.start > lastEnd) {
        spans.add(TextSpan(text: text.substring(lastEnd, match.start)));
      }

      if (match.group(1) != null) {
        // **bold**
        spans.add(TextSpan(
          text: match.group(1),
          style: const TextStyle(fontWeight: FontWeight.w700),
        ));
      } else if (match.group(2) != null) {
        // *italic*
        spans.add(TextSpan(
          text: match.group(2),
          style: const TextStyle(fontStyle: FontStyle.italic),
        ));
      } else if (match.group(3) != null) {
        // `code`
        spans.add(TextSpan(
          text: match.group(3),
          style: TextStyle(
            fontFamily: 'monospace',
            backgroundColor: AppColors.surfaceVariant.withValues(alpha: 0.5),
            fontSize: (style.fontSize ?? 14) - 1,
          ),
        ));
      }

      lastEnd = match.end;
    }

    if (lastEnd < text.length) {
      spans.add(TextSpan(text: text.substring(lastEnd)));
    }

    return TextSpan(style: style, children: spans.isEmpty ? [TextSpan(text: text)] : spans);
  }

  /// Parse raw text into structured blocks
  List<_Block> _parseBlocks(String raw) {
    final lines = raw.split('\n');
    final blocks = <_Block>[];
    final codeBuffer = StringBuffer();
    bool inCode = false;

    for (final line in lines) {
      final trimmed = line.trim();

      // Code block fences
      if (trimmed.startsWith('```')) {
        if (inCode) {
          blocks.add(_Block(_BlockType.code, codeBuffer.toString().trimRight()));
          codeBuffer.clear();
          inCode = false;
        } else {
          inCode = true;
        }
        continue;
      }

      if (inCode) {
        codeBuffer.writeln(line);
        continue;
      }

      // Divider
      if (RegExp(r'^-{3,}$').hasMatch(trimmed)) {
        blocks.add(_Block(_BlockType.divider, ''));
        continue;
      }

      // Headings
      final headingMatch = RegExp(r'^(#{1,3})\s+(.+)$').firstMatch(trimmed);
      if (headingMatch != null) {
        blocks.add(_Block(
          _BlockType.heading,
          headingMatch.group(2)!,
          meta: headingMatch.group(1)!.length,
        ));
        continue;
      }

      // Bullet list
      if (RegExp(r'^[-•*]\s+').hasMatch(trimmed)) {
        blocks.add(_Block(
          _BlockType.bullet,
          trimmed.replaceFirst(RegExp(r'^[-•*]\s+'), ''),
        ));
        continue;
      }

      // Numbered list
      final numMatch = RegExp(r'^(\d+)[.)]\s+(.+)$').firstMatch(trimmed);
      if (numMatch != null) {
        blocks.add(_Block(
          _BlockType.numbered,
          numMatch.group(2)!,
          meta: numMatch.group(1)!,
        ));
        continue;
      }

      // Paragraph / empty line
      blocks.add(_Block(_BlockType.paragraph, trimmed));
    }

    // Close unclosed code block
    if (inCode && codeBuffer.isNotEmpty) {
      blocks.add(_Block(_BlockType.code, codeBuffer.toString().trimRight()));
    }

    return blocks;
  }
}

enum _BlockType { paragraph, heading, bullet, numbered, divider, code }

class _Block {
  final _BlockType type;
  final String text;
  final dynamic meta;
  _Block(this.type, this.text, {this.meta});
}
