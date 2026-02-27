package io.medq.app

import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.medq.app.dns.DnsBypassInit

class MainActivity : FlutterActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // 1. Register DoH gRPC NameResolver + seed App Check BEFORE Flutter starts.
        DnsBypassInit.initialize(this)

        super.onCreate(savedInstanceState)

        // 2. Patch Firebase Functions OkHttpClient AFTER super.onCreate().
        //    FirebaseInitProvider has already initialized FirebaseApp by this point.
        DnsBypassInit.patchFunctionsDns()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // 3. Register MethodChannel so Dart code can also resolve via DoH.
        DnsBypassInit.registerMethodChannel(flutterEngine.dartExecutor.binaryMessenger)
    }
}
