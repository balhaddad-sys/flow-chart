allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// Build outside OneDrive to avoid sync-lock failures on Windows.
// Flutter picks up the AAB from the path printed at the end of the build.
val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("C:/Temp/medq-build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
