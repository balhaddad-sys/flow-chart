// FILE: lib/src/core/widgets/medq_nav_bar.dart
import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_spacing.dart';
import '../icons/medq_icons.dart';

/// Bottom navigation bar with 5 tabs and an animated pill indicator.
///
/// Usage:
/// ```dart
/// MedQNavBar(
///   currentIndex: _index,
///   onTap: (i) => setState(() => _index = i),
/// )
/// ```
class MedQNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const MedQNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  static const _items = [
    _NavItem(MedQIcons.home, 'Today'),
    _NavItem(MedQIcons.library, 'Library'),
    _NavItem(MedQIcons.quiz, 'Practice'),
    _NavItem(MedQIcons.ai, 'AI'),
    _NavItem(MedQIcons.profile, 'Profile'),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final dockColor =
        isDark
            ? AppColors.darkSurface.withValues(alpha: 0.98)
            : AppColors.surface.withValues(alpha: 0.98);

    final inactiveColor =
        isDark ? AppColors.darkTextSecondary : AppColors.textSecondary;

    final borderColor = isDark ? AppColors.darkBorder : AppColors.border;

    return SafeArea(
      top: false,
      minimum: const EdgeInsets.fromLTRB(14, 0, 14, 12),
      child: Material(
        color: Colors.transparent,
        child: Container(
          height: 72,
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: dockColor,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: borderColor.withValues(alpha: 0.95)),
            boxShadow: isDark ? null : AppSpacing.shadowLg,
          ),
          child: Row(
            children: List.generate(_items.length, (i) {
              final item = _items[i];
              final isActive = i == currentIndex;

              return Expanded(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeOutCubic,
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  decoration: BoxDecoration(
                    gradient: isActive ? AppColors.primaryGradient : null,
                    color: isActive ? null : Colors.transparent,
                    borderRadius: BorderRadius.circular(22),
                    boxShadow:
                        isActive ? AppColors.primaryGradientShadow : null,
                  ),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(22),
                      onTap: () => onTap(i),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 10,
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            MedQIcon(
                              item.icon,
                              size: 18,
                              color: isActive ? Colors.white : inactiveColor,
                            ),
                            const SizedBox(height: 4),
                            AnimatedDefaultTextStyle(
                              duration: const Duration(milliseconds: 180),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight:
                                    isActive
                                        ? FontWeight.w700
                                        : FontWeight.w600,
                                color: isActive ? Colors.white : inactiveColor,
                                letterSpacing: 0.15,
                              ),
                              child: Text(item.label),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}

// ─── Data class ──────────────────────────────────────────────────────────────

class _NavItem {
  final MedQIconData icon;
  final String label;
  const _NavItem(this.icon, this.label);
}
