allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// Redirect subproject build dirs so the Flutter tool finds the APK at
// build/app/outputs/... (its expected layout).
//
// On Windows:  base = C:/Temp/medq-build  (outside OneDrive, avoids file-locks)
// On Linux/Mac (CI): base = <root>/build   (the default project build dir)
//
// Either way, :app ends up at <base>/app/outputs/... which is what Flutter wants.
val buildBase: File =
    if (System.getProperty("os.name").lowercase().contains("windows"))
        file("C:/Temp/medq-build")
    else
        rootProject.layout.buildDirectory.get().asFile

subprojects {
    layout.buildDirectory.set(buildBase.resolve(project.name))
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(buildBase)
}
