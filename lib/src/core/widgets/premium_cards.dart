import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../icons/medq_icons.dart';

// ─── Premium Card ────────────────────────────────────────────────────────────

class PremiumCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final Color? accentColor;
  final VoidCallback? onTap;
  final double borderRadius;
  final Gradient? gradient;

  const PremiumCard({
    super.key,
    required this.child,
    this.padding,
    this.accentColor,
    this.onTap,
    this.borderRadius = 16,
    this.gradient,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    Widget card = Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: gradient,
        color: gradient == null
            ? (isDark ? AppColors.darkSurface : AppColors.surface)
            : null,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.06)
              : Colors.black.withValues(alpha: 0.05),
        ),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 12,
                  offset: const Offset(0, 3),
                ),
              ],
      ),
      child: accentColor != null
          ? Container(
              decoration: BoxDecoration(
                border: Border(left: BorderSide(color: accentColor!, width: 3)),
              ),
              padding: padding ?? const EdgeInsets.all(16),
              child: child,
            )
          : Padding(
              padding: padding ?? const EdgeInsets.all(16),
              child: child,
            ),
    );
    if (onTap != null) {
      card = GestureDetector(onTap: onTap, child: card);
    }
    return card;
  }
}

// ─── Gradient Header ─────────────────────────────────────────────────────────

class PremiumHeader extends StatelessWidget {
  final Widget child;

  const PremiumHeader({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(gradient: AppColors.headerGradient(isDark)),
      child: Stack(
        children: [
          Positioned(
            top: -60,
            right: -30,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.teal600.withValues(alpha: isDark ? 0.08 : 0.12),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
            child: child,
          ),
        ],
      ),
    );
  }
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

class TealProgressBar extends StatelessWidget {
  final double value; // 0.0 – 1.0
  final double height;

  const TealProgressBar({super.key, required this.value, this.height = 8});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF292524) : const Color(0xFFE7E5E4),
        borderRadius: BorderRadius.circular(10),
      ),
      child: FractionallySizedBox(
        alignment: Alignment.centerLeft,
        widthFactor: value.clamp(0, 1),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            gradient: const LinearGradient(
              colors: [AppColors.teal600, AppColors.teal400],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Section Header ──────────────────────────────────────────────────────────

class SectionHeader extends StatelessWidget {
  final String title;
  final String? action;
  final VoidCallback? onAction;

  const SectionHeader({super.key, required this.title, this.action, this.onAction});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: TextStyle(
            fontSize: 14, fontWeight: FontWeight.w700,
            color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
            letterSpacing: -0.2,
          )),
          if (action != null)
            GestureDetector(
              onTap: onAction,
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(action!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.teal500)),
                const SizedBox(width: 2),
                MedQIcon(MedQIcons.chevronRight, size: 14, color: AppColors.teal500),
              ]),
            ),
        ],
      ),
    );
  }
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

class MetricCard extends StatelessWidget {
  final MedQIconData icon;
  final String value;
  final String label;
  final String? trend;
  final Color color;

  const MetricCard({super.key, required this.icon, required this.value, required this.label, required this.color, this.trend});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return PremiumCard(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Container(
            width: 30, height: 30,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(9)),
            child: Center(child: MedQIcon(icon, size: 16, color: color)),
          ),
          if (trend != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: AppColors.success.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
              child: Text(trend!, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.success)),
            ),
        ]),
        const SizedBox(height: 10),
        Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary, letterSpacing: -0.5)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 11, color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary)),
      ]),
    );
  }
}

// ─── Task Card ───────────────────────────────────────────────────────────────

class TaskCard extends StatelessWidget {
  final String title;
  final String type;
  final String time;
  final bool done;
  final VoidCallback? onTap;

  const TaskCard({super.key, required this.title, required this.type, required this.time, this.done = false, this.onTap});

  static const _cfg = <String, (Color, MedQIconData)>{
    'STUDY':  (AppColors.teal500, MedQIcons.book),
    'QUIZ':   (Color(0xFF8B5CF6), MedQIcons.sparkles),
    'REVIEW': (Color(0xFFD97706), MedQIcons.refresh),
  };

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final (color, icon) = _cfg[type] ?? _cfg['STUDY']!;
    final tx = isDark ? AppColors.darkTextPrimary : AppColors.textPrimary;
    final ts = isDark ? AppColors.darkTextSecondary : AppColors.textSecondary;
    final td = isDark ? AppColors.darkTextTertiary : AppColors.divider;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.black.withValues(alpha: 0.05)),
          boxShadow: isDark ? null : [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4, offset: const Offset(0, 1))],
        ),
        child: Row(children: [
          // Accent left border effect
          if (!done) Container(width: 3, height: 34, margin: const EdgeInsets.only(right: 11), decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
          if (done) const SizedBox(width: 14),
          Container(
            width: 34, height: 34,
            decoration: BoxDecoration(color: color.withValues(alpha: isDark ? 0.12 : 0.07), borderRadius: BorderRadius.circular(9)),
            child: Center(child: MedQIcon(icon, size: 16, color: color)),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: done ? td : tx, decoration: done ? TextDecoration.lineThrough : null)),
            const SizedBox(height: 2),
            Row(children: [
              MedQIcon(MedQIcons.clock, size: 11, color: ts),
              const SizedBox(width: 4),
              Text(time, style: TextStyle(fontSize: 11, color: ts)),
            ]),
          ])),
          Container(
            width: 22, height: 22,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(7),
              border: Border.all(color: done ? AppColors.success : (isDark ? const Color(0xFF44403C) : const Color(0xFFD6D3D1)), width: 2),
              color: done ? AppColors.success : Colors.transparent,
            ),
            child: done ? Center(child: MedQIcon(MedQIcons.check, size: 13, color: Colors.white)) : null,
          ),
        ]),
      ),
    );
  }
}

// ─── Status Tag ──────────────────────────────────────────────────────────────

class StatusTag extends StatelessWidget {
  final String text;
  final Color color;

  const StatusTag({super.key, required this.text, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.12)),
      ),
      child: Text(text, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color)),
    );
  }
}

// ─── Callout Box ─────────────────────────────────────────────────────────────

class CalloutBox extends StatelessWidget {
  final MedQIconData icon;
  final Color color;
  final String text;

  const CalloutBox({super.key, required this.icon, required this.color, required this.text});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.08 : 0.05),
        border: Border.all(color: color.withValues(alpha: 0.12)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        MedQIcon(icon, size: 16, color: color),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: TextStyle(fontSize: 12, color: color, height: 1.55))),
      ]),
    );
  }
}
