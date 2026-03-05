import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/constants/app_spacing.dart';

class CompletionCheckbox extends StatefulWidget {
  final bool isDone;
  final Color color;
  final ValueChanged<bool> onChanged;
  final double size;

  const CompletionCheckbox({
    super.key,
    required this.isDone,
    required this.color,
    required this.onChanged,
    this.size = 26,
  });

  @override
  State<CompletionCheckbox> createState() => _CompletionCheckboxState();
}

class _CompletionCheckboxState extends State<CompletionCheckbox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _scaleController;
  late final Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _scaleController = AnimationController(
      vsync: this,
      duration: AppSpacing.animNormal,
    );
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.2), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 1.2, end: 1.0), weight: 50),
    ]).animate(
      CurvedAnimation(parent: _scaleController, curve: Curves.easeOutCubic),
    );
  }

  @override
  void didUpdateWidget(CompletionCheckbox oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isDone && !oldWidget.isDone) {
      _scaleController.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _scaleController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        widget.onChanged(!widget.isDone);
      },
      child: ScaleTransition(
        scale: _scaleAnimation,
        child: AnimatedContainer(
          duration: AppSpacing.animFast,
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            color: widget.isDone
                ? widget.color
                : Colors.transparent,
            borderRadius: BorderRadius.circular(widget.size * 0.3),
            border: Border.all(
              color: widget.isDone
                  ? widget.color
                  : (isDark
                      ? Colors.white.withValues(alpha: 0.2)
                      : Colors.black.withValues(alpha: 0.15)),
              width: 2,
            ),
          ),
          child: widget.isDone
              ? Icon(
                  Icons.check_rounded,
                  size: widget.size * 0.6,
                  color: Colors.white,
                )
              : null,
        ),
      ),
    );
  }
}
