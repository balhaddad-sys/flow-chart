class AppLinks {
  // Use your production domain in CI/release:
  // --dart-define=MEDQ_PRIVACY_URL=https://your-domain/privacy
  // --dart-define=MEDQ_TERMS_URL=https://your-domain/terms
  static const String privacyPolicyUrl = String.fromEnvironment(
    'MEDQ_PRIVACY_URL',
    defaultValue: 'https://medqs.vercel.app/privacy',
  );

  static const String termsOfServiceUrl = String.fromEnvironment(
    'MEDQ_TERMS_URL',
    defaultValue: 'https://medqs.vercel.app/terms',
  );

  static const String supportEmail = String.fromEnvironment(
    'MEDQ_SUPPORT_EMAIL',
    defaultValue: 'support@medq.app',
  );

  static String get supportMailto => 'mailto:$supportEmail';
}
