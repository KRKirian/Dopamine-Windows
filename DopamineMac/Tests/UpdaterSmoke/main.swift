import AppKit
import Sparkle

extension Notification.Name { static let settingsChanged = Notification.Name("DopamineSettingsChanged") }

// Runs the production updater without the tracker, HTTP server or user's database.
enum Log {
    static func error(_ message: String) { record("error: \(message)") }
    static func record(_ message: String) {
        let path = Bundle.main.object(forInfoDictionaryKey: "SmokeResultPath") as! String
        let file = URL(fileURLWithPath: path)
        var data = (try? Data(contentsOf: file)) ?? Data()
        data.append(Data((message + "\n").utf8))
        try? data.write(to: file)
    }
}

final class Probe: NSObject, NSApplicationDelegate {
    private let updates = UpdateChecker(isEnabled: { true })
    func applicationDidFinishLaunching(_ notification: Notification) {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as! String
        Log.record("launched \(version)")
        guard version == "1.0.0" else { NSApp.terminate(nil); return }
        updates.onChange = { [weak self] in
            if self?.updates.available?.ready == true {
                Log.record("verified download")
                self?.updates.install()
            }
        }
        updates.start()
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let probe = Probe()
app.delegate = probe
app.run()
