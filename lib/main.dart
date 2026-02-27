import 'dart:io';

import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_plugins/url_strategy.dart';

import 'firebase_options.dart';
import 'src/app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Use path-based URLs instead of hash-based (removes # from URLs)
  // This fixes service worker navigation issues with Firebase Hosting
  if (kIsWeb) {
    usePathUrlStrategy();
  }

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // App Check — debug provider lets the app pass App Check enforcement
  // without Play Store distribution. Switch to playIntegrity once on Store.
  await FirebaseAppCheck.instance.activate(
    androidProvider: AndroidProvider.debug,
    appleProvider: AppleProvider.debug,
  );

  // Patch Firebase Functions OkHttpClient to use DoH DNS (Android only).
  // Called here (after Firebase is fully initialized) so that the Dagger
  // component for FirebaseFunctions is ready when we call getInstance().
  if (!kIsWeb && Platform.isAndroid) {
    try {
      await const MethodChannel('io.medq.app/dns').invokeMethod('patchFunctions');
    } catch (_) {
      // Non-fatal — functions will still attempt the call, just via system DNS.
    }
  }

  // Production crash reporting via Firebase Crashlytics (mobile only)
  if (!kIsWeb) {
    FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
    PlatformDispatcher.instance.onError = (error, stack) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
      return true;
    };
  } else {
    FlutterError.onError = (details) {
      FlutterError.presentError(details);
      if (kDebugMode) {
        debugPrint('Flutter Error: ${details.exceptionAsString()}');
      }
    };
    PlatformDispatcher.instance.onError = (error, stack) {
      if (kDebugMode) {
        debugPrint('Unhandled Error: $error');
      }
      return true;
    };
  }

  runApp(
    const ProviderScope(
      child: MedQApp(),
    ),
  );
}
