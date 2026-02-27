allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// Flutter tool expects APK at <flutter_root>/build/app/outputs/flutter-apk/
// The Gradle root is android/, so we must go up one level to reach <flutter_root>/build/.
//
// On Windows:  redirect to C:/Temp/medq-build to avoid OneDrive file-locks.
// On Linux/Mac (CI): redirect to <flutter_root>/build/ so Flutter tool finds the APK.
val buildBase: File =
    if (System.getProperty("os.name").lowercase().contains("windows"))
        file("C:/Temp/medq-build")
    else
        rootProject.projectDir.resolve("../build")  // android/../build = <flutter_root>/build

subprojects {
    layout.buildDirectory.set(buildBase.resolve(project.name))
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(buildBase)
}
