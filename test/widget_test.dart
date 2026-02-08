import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:medq/src/app.dart';

void main() {
  testWidgets('MedQApp renders login screen', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MedQApp(),
      ),
    );

    // The app should render without crashing.
    // Auth redirect should land on the login screen.
    expect(find.text('MedQ'), findsOneWidget);
  });
}
