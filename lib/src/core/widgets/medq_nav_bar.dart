import 'package:flutter/material.dart';

import '../icons/medq_icons.dart';
import '../theme/app_colors.dart';

/// Bottom navigation bar using custom MedQ SVG icons with
/// animated pill indicator on the active item.
class MedQNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const MedQNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  static const _items = [
    (MedQIcons.home, 'Today'),
    (MedQIcons.library, 'Library'),
    (MedQIcons.quiz, 'Practice'),
    (MedQIcons.ai, 'AI'),
    (MedQIcons.plan, 'Plan'),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inactiveColor = isDark
        ? AppColors.darkTextSecondary.withValues(alpha: 0.7)
        : AppColors.textSecondary;

    return Container(
      decoration: BoxDecoration(
        color: (isDark ? AppColors.darkBackground : AppColors.surface)
            .withValues(alpha: 0.92),
        border: Border(
          top: BorderSide(
            color: isDark
                ? Colors.white.withValues(alpha: 0.06)
                : Colors.black.withValues(alpha: 0.05),
            width: 0.5,
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 56,
          child: Row(
            children: List.generate(_items.length, (i) {
              final (icon, label) = _items[i];
              final isActive = i == currentIndex;
              return Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onTap(i),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        curve: Curves.easeOutCubic,
                        width: isActive ? 48 : 32,
                        height: 28,
                        decoration: BoxDecoration(
                          color: isActive
                              ? (isDark
                                  ? AppColors.teal600.withValues(alpha: 0.15)
                                  : AppColors.teal600.withValues(alpha: 0.1))
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Center(
                          child: MedQIcon(
                            icon,
                            size: 18,
                            color: isActive ? AppColors.teal500 : inactiveColor,
                          ),
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                          color: isActive ? AppColors.teal500 : inactiveColor,
                        ),
                      ),
                    ],
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
