class Validators {
  Validators._();

  static String? email(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Email is required';
    }
    final emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
    if (!emailRegex.hasMatch(value.trim())) {
      return 'Enter a valid email address';
    }
    return null;
  }

  static String? password(String? value) {
    if (value == null || value.isEmpty) {
      return 'Password is required';
    }
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    final hasLetter = RegExp(r'[A-Za-z]').hasMatch(value);
    final hasDigit = RegExp(r'\d').hasMatch(value);
    if (!hasLetter || !hasDigit) {
      return 'Password must include letters and numbers';
    }
    return null;
  }

  static String? required(String? value, [String fieldName = 'This field']) {
    if (value == null || value.trim().isEmpty) {
      return '$fieldName is required';
    }
    return null;
  }

  static String? courseTitle(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Course title is required';
    }
    if (value.trim().length > 100) {
      return 'Course title must be under 100 characters';
    }
    return null;
  }

  static String? minutes(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Required';
    }
    final mins = int.tryParse(value.trim());
    if (mins == null || mins < 15 || mins > 600) {
      return 'Enter 15-600 minutes';
    }
    return null;
  }
}
