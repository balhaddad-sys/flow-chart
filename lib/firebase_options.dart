import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static const String _androidApiKey = String.fromEnvironment(
    'FIREBASE_ANDROID_API_KEY',
    defaultValue: 'AIzaSyBC9lKDLIrHCGnM87qoREgHYZeRWhVFtC8',
  );
  static const String _androidAppId = String.fromEnvironment(
    'FIREBASE_ANDROID_APP_ID',
    defaultValue: '1:1061864749573:android:dd188cf3706ba97b34ba6c',
  );
  static const String _androidMessagingSenderId = String.fromEnvironment(
    'FIREBASE_ANDROID_MESSAGING_SENDER_ID',
    defaultValue: '1061864749573',
  );
  static const String _androidProjectId = String.fromEnvironment(
    'FIREBASE_ANDROID_PROJECT_ID',
    defaultValue: 'medq-a6cc6',
  );
  static const String _androidStorageBucket = String.fromEnvironment(
    'FIREBASE_ANDROID_STORAGE_BUCKET',
    defaultValue: 'medq-a6cc6.firebasestorage.app',
  );

  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for ios - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      case TargetPlatform.macOS:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for macos - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      case TargetPlatform.windows:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for windows - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for linux - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static FirebaseOptions get android {
    if (!_androidConfigured) {
      throw UnsupportedError(
        'DefaultFirebaseOptions are missing Android configuration. '
        'Provide --dart-define values for '
        'FIREBASE_ANDROID_API_KEY, FIREBASE_ANDROID_APP_ID, '
        'FIREBASE_ANDROID_MESSAGING_SENDER_ID.',
      );
    }

    return const FirebaseOptions(
      apiKey: _androidApiKey,
      appId: _androidAppId,
      messagingSenderId: _androidMessagingSenderId,
      projectId: _androidProjectId,
      storageBucket: _androidStorageBucket,
    );
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyDqmS_2wfbgoON5Rbp4hcXgs3ZuGl7Yq8s',
    appId: '1:1061864749573:web:2374190d0f988cad34ba6c',
    messagingSenderId: '1061864749573',
    projectId: 'medq-a6cc6',
    authDomain: 'medq-a6cc6.firebaseapp.com',
    storageBucket: 'medq-a6cc6.firebasestorage.app',
    measurementId: 'G-T05YWY35M9',
  );

  static bool get _androidConfigured =>
      _androidApiKey.isNotEmpty &&
      _androidAppId.isNotEmpty &&
      _androidMessagingSenderId.isNotEmpty;
}
