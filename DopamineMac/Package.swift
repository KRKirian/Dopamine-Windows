// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "DopamineMac",
    platforms: [.macOS(.v12)],
    products: [
        .executable(name: "DopamineMac", targets: ["DopamineMac"]),
    ],
    dependencies: [.package(url: "https://github.com/sparkle-project/Sparkle", exact: "2.10.0")],
    targets: [
        .executableTarget(
            name: "DopamineMac",
            dependencies: [.product(name: "Sparkle", package: "Sparkle")],
            linkerSettings: [.linkedLibrary("sqlite3"), .unsafeFlags(["-Xlinker", "-rpath", "-Xlinker", "@executable_path/../Frameworks"])]
        ),
        .testTarget(
            name: "DopamineMacTests",
            dependencies: ["DopamineMac"]
        ),
    ]
)
