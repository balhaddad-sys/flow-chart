allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// Build outside OneDrive to avoid sync-lock failures on Windows.
// On Linux/CI the default Gradle build directory is used.
if (System.getProperty("os.name").startsWith("Windows")) {
    val newBuildDir: Directory =
        rootProject.layout.buildDirectory
            .dir("C:/Temp/medq-build")
            .get()
    rootProject.layout.buildDirectory.value(newBuildDir)
    subprojects {
        val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
        project.layout.buildDirectory.value(newSubprojectBuildDir)
    }
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
