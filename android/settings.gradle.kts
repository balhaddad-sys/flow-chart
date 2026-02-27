pluginManagement {
    val flutterSdkPath =
        run {
            val properties = java.util.Properties()
            file("local.properties").inputStream().use { properties.load(it) }
            val flutterSdkPath = properties.getProperty("flutter.sdk")
            require(flutterSdkPath != null) { "flutter.sdk not set in local.properties" }
            flutterSdkPath
        }

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    resolutionStrategy {
        eachPlugin {
            // Redirect Kotlin plugins to Maven Central so Gradle doesn't
            // try to fetch artifacts from plugins-artifacts.gradle.org (CDN
            // blocked in some build environments).
            if (requested.id.namespace?.startsWith("org.jetbrains.kotlin") == true) {
                useModule("org.jetbrains.kotlin:kotlin-gradle-plugin:${requested.version}")
            }
            // NOTE: kotlin-dsl is bundled inside the Gradle distribution itself
            // (gradle-kotlin-dsl-provider-plugins-X.jar). Do NOT add a useModule
            // redirect for it — that would force Gradle to fetch an external Maven
            // artifact (org.gradle.kotlin:gradle-kotlin-dsl-plugins) which is only
            // served from the blocked plugins-artifacts.gradle.org CDN.
        }
    }
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    id("com.android.application") version "8.9.1" apply false
    id("org.jetbrains.kotlin.android") version "2.2.20" apply false
}

include(":app")
