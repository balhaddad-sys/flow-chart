allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// Flutter convention: all Gradle outputs go to {flutter_root}/build/ (outside android/).
// This matches where flutter_tools looks for the generated APK/AAB.
// On Windows, use C:/Temp/medq-build instead to avoid OneDrive sync-lock failures.
val flutterBuildRoot: Directory =
    if (System.getProperty("os.name").startsWith("Windows"))
        rootProject.layout.projectDirectory.dir("C:/Temp/medq-build")
    else
        rootProject.layout.projectDirectory.dir("../build")
rootProject.layout.buildDirectory.value(flutterBuildRoot)
subprojects {
    project.layout.buildDirectory.value(flutterBuildRoot.dir(project.name))
}

// Fix for AGP 8.x: FlutterFire plugins declare `api project(':firebase_core')` inside
// android { dependencies {} }, which AGP 8.x silently routes to DependenciesInfo (not
// DependencyHandler). We inject the missing dependency via afterEvaluate so that javac
// can find the firebase_core interfaces at compile time.
val flutterFirePluginsNeedingCore = setOf(
    "cloud_firestore", "firebase_auth", "firebase_storage", "cloud_functions"
)
subprojects {
    afterEvaluate {
        if (name !in flutterFirePluginsNeedingCore) return@afterEvaluate
        val coreProj = rootProject.findProject(":firebase_core") ?: return@afterEvaluate
        dependencies.add("api", coreProj)
        logger.lifecycle("[FlutterFire fix] Injected :firebase_core api dep into :$name")
    }
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
