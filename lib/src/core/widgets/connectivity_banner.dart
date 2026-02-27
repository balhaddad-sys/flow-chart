import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_spacing.dart';

/// A banner that slides in from the top when the device is offline.
///
/// Wraps around the app shell and listens to connectivity changes.
/// Shows a non-intrusive but clear offline indicator.
class ConnectivityBanner extends StatefulWidget {
  final Widget child;
  const ConnectivityBanner({super.key, required this.child});

  @override
  State<ConnectivityBanner> createState() => _ConnectivityBannerState();
}

class _ConnectivityBannerState extends State<ConnectivityBanner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _slideAnimation;
  StreamSubscription<List<ConnectivityResult>>? _subscription;
  bool _isOffline = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _slideAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    );

    _subscription = Connectivity().onConnectivityChanged.listen(_onChanged);
    // Check initial state.
    Connectivity().checkConnectivity().then(_onChanged);
  }

  void _onChanged(List<ConnectivityResult> results) {
    final offline = results.isEmpty ||
        results.every((r) => r == ConnectivityResult.none);
    if (offline != _isOffline) {
      setState(() => _isOffline = offline);
      if (offline) {
        _controller.forward();
      } else {
        // Show "back online" briefly then hide.
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted && !_isOffline) _controller.reverse();
        });
      }
    }
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      children: [
        SizeTransition(
          sizeFactor: _slideAnimation,
          axisAlignment: -1.0,
          child: Container(
            width: double.infinity,
            padding: EdgeInsets.only(
              top: MediaQuery.of(context).padding.top + 4,
              bottom: 8,
              left: 16,
              right: 16,
            ),
            decoration: BoxDecoration(
              color: _isOffline
                  ? (isDark ? const Color(0xFF3D1414) : AppColors.errorLight)
                  : (isDark ? const Color(0xFF0A2918) : AppColors.successLight),
              border: Border(
                bottom: BorderSide(
                  color: _isOffline
                      ? AppColors.error.withValues(alpha: 0.3)
                      : AppColors.success.withValues(alpha: 0.3),
                ),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  _isOffline
                      ? Icons.wifi_off_rounded
                      : Icons.wifi_rounded,
                  size: 14,
                  color: _isOffline ? AppColors.error : AppColors.success,
                ),
                const SizedBox(width: 8),
                Text(
                  _isOffline
                      ? 'No internet connection'
                      : 'Back online',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: _isOffline ? AppColors.error : AppColors.success,
                  ),
                ),
              ],
            ),
          ),
        ),
        Expanded(child: widget.child),
      ],
    );
  }
}
