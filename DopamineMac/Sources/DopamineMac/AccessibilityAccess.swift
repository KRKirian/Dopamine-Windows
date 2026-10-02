import ApplicationServices
import Foundation
import Security

/// The Accessibility permission, which Dopamine needs to read window titles.
///
/// macOS ties the grant to the app's code signature. An ad-hoc signed build gets a new signature
/// every time it is rebuilt, updated or reinstalled, so its old entry in System Settings stays
/// switched on without applying any more — and macOS won't ask again while that stale entry
/// exists. Removing our own entry while access is missing lets the system prompt appear afresh.
enum AccessibilityAccess {
    private static let askedKey = "accessibilityAskedForBuild"

    static var isGranted: Bool { AXIsProcessTrusted() }

    /// Asks once per signed build: a build with a new signature can't use the previous grant.
    static func askIfNewBuild(defaults: UserDefaults = .standard) {
        guard !isGranted else { return }
        let build = buildIdentity()
        guard defaults.string(forKey: askedKey) != build else { return }
        defaults.set(build, forKey: askedKey)
        ask()
    }

    /// Clears any stale entry, then shows the system prompt that adds Dopamine to the list.
    static func ask() {
        guard !isGranted else { return }
        resetOwnEntry()
        let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
        _ = AXIsProcessTrustedWithOptions([key: true] as CFDictionary)
    }

    /// Only runs while access is missing, so it can never take away a grant that works.
    private static func resetOwnEntry() {
        guard let bundleID = Bundle.main.bundleIdentifier, Bundle.main.bundleURL.pathExtension == "app" else { return }
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/tccutil")
        task.arguments = ["reset", "Accessibility", bundleID]
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice
        do {
            try task.run()
            task.waitUntilExit()
            if task.terminationStatus != 0 {
                Log.error("tccutil reset Accessibility \(bundleID) exited with \(task.terminationStatus)")
            }
        } catch {
            Log.error("Could not run tccutil: \(error)")
        }
    }

    /// The code directory hash macOS matches the grant against; falls back to the bundle version.
    static func buildIdentity() -> String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "dev"
        var code: SecCode?
        var staticCode: SecStaticCode?
        var info: CFDictionary?
        guard SecCodeCopySelf([], &code) == errSecSuccess, let code,
              SecCodeCopyStaticCode(code, [], &staticCode) == errSecSuccess, let staticCode,
              SecCodeCopySigningInformation(staticCode, [], &info) == errSecSuccess,
              let hash = (info as? [String: Any])?[kSecCodeInfoUnique as String] as? Data
        else { return version }
        return hash.map { String(format: "%02x", $0) }.joined()
    }
}
