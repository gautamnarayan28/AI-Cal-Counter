// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "CalorieCore", platforms: [.iOS(.v17), .macOS(.v13)], products: [.library(name: "CalorieCore", targets: ["CalorieCore"])], targets: [.target(name: "CalorieCore"), .testTarget(name: "CalorieCoreTests", dependencies: ["CalorieCore"])])
