import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Top-level handler for background messages (required by FCM).
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // No-op — Firebase will display the notification automatically.
  // Add custom logic here if needed (e.g. local caching).
}

/// Manages Firebase Cloud Messaging setup, token refresh, and foreground
/// notification display.
class NotificationService {
  NotificationService._();

  static final _messaging = FirebaseMessaging.instance;
  static final _localNotifications = FlutterLocalNotificationsPlugin();

  static const _channel = AndroidNotificationChannel(
    'medq_default',
    'MedQ Notifications',
    description: 'Study reminders and updates from MedQ',
    importance: Importance.high,
  );

  /// Initialize FCM and local notifications. Call once during app startup.
  static Future<void> init() async {
    if (kIsWeb) return; // Skip on web — handled differently.

    // Register background handler.
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Create the notification channel (Android).
    if (Platform.isAndroid) {
      await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(_channel);
    }

    // Initialize local notifications plugin.
    await _localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );

    // Listen for foreground messages and display them as local notifications.
    FirebaseMessaging.onMessage.listen(_showForegroundNotification);
  }

  /// Request notification permission from the user.
  ///
  /// Call this at an appropriate moment (e.g. after onboarding), not at startup.
  static Future<bool> requestPermission() async {
    if (kIsWeb) return false;
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    return settings.authorizationStatus == AuthorizationStatus.authorized;
  }

  /// Get the current FCM token. Returns null if unavailable.
  static Future<String?> getToken() async {
    if (kIsWeb) return null;
    return _messaging.getToken();
  }

  /// Subscribe to token refresh events.
  static void onTokenRefresh(void Function(String token) callback) {
    if (kIsWeb) return;
    _messaging.onTokenRefresh.listen(callback);
  }

  static Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    await _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
    );
  }
}
