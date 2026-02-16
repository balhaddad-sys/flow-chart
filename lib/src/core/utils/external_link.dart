import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

Future<void> openExternalLink(
  BuildContext context,
  String url, {
  String? label,
}) async {
  final parsed = Uri.tryParse(url);
  if (parsed == null || !parsed.hasScheme) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Invalid link${label == null ? '' : ' for $label'}.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    return;
  }

  final opened = await launchUrl(
    parsed,
    mode: LaunchMode.externalApplication,
  );

  if (!opened) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Could not open ${label ?? 'link'}.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
