// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "SkyfoldCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "SkyfoldCore", targets: ["SkyfoldCore"]),
    ],
    targets: [
        .target(name: "SkyfoldCore"),
        .testTarget(name: "SkyfoldCoreTests", dependencies: ["SkyfoldCore"]),
    ]
)
