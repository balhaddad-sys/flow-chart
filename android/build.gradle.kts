allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// On Windows, build outside OneDrive to avoid sync-lock failures.
// On Linux/Mac (CI), use the default build directory.
if (System.getProperty("os.name").lowercase().contains("windows")) {
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
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
