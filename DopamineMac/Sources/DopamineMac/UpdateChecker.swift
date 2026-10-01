import Foundation
import Sparkle

struct Release: Equatable {
    let version: String
    let url: URL
    var ready: Bool = false
}

/// Sparkle downloads and verifies updates, then installs on quit or on the user's restart request.
final class UpdateChecker: NSObject, SPUUpdaterDelegate {
    private let isEnabled: () -> Bool
    private var controller: SPUStandardUpdaterController?
    private var observer: NSObjectProtocol?
    private let lock = NSLock()
    private var found: Release?
    private var installHandler: (() -> Void)?
    var onChange: (() -> Void)?

    var available: Release? {
        lock.lock()
        defer { lock.unlock() }
        return isEnabled() ? found : nil
    }

    init(isEnabled: @escaping () -> Bool) {
        self.isEnabled = isEnabled
        super.init()
    }

    func start() {
        // swift run / unit tests aren't installable app bundles.
        guard Bundle.main.bundleURL.pathExtension == "app" else { return }
        let controller = SPUStandardUpdaterController(startingUpdater: false, updaterDelegate: self, userDriverDelegate: nil)
        self.controller = controller
        syncPreference()
        controller.startUpdater()
        observer = NotificationCenter.default.addObserver(forName: .settingsChanged, object: nil, queue: .main) { [weak self] _ in
            self?.syncPreference()
        }
    }

    private func syncPreference() {
        guard let updater = controller?.updater else { return }
        let enabled = isEnabled()
        if updater.automaticallyChecksForUpdates != enabled { updater.automaticallyChecksForUpdates = enabled }
        if updater.automaticallyDownloadsUpdates != enabled { updater.automaticallyDownloadsUpdates = enabled }
    }

    /// Called from the local HTTP server or the menu bar; the installer runs on the main thread.
    @discardableResult func install() -> Bool {
        lock.lock()
        let handler = isEnabled() ? installHandler : nil
        lock.unlock()
        guard let handler else { return false }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { handler() }
        return true
    }

    func updater(_ updater: SPUUpdater, didFindValidUpdate item: SUAppcastItem) {
        set(Release(version: item.displayVersionString, url: URL(string: "https://github.com/TempestShaw/Dopamine/releases/tag/v\(item.displayVersionString)")!))
    }

    func updater(_ updater: SPUUpdater, willInstallUpdateOnQuit item: SUAppcastItem, immediateInstallationBlock handler: @escaping () -> Void) -> Bool {
        lock.lock()
        installHandler = handler
        found?.ready = true
        lock.unlock()
        onChange?()
        return true
    }

    func updater(_ updater: SPUUpdater, didAbortWithError error: Error) {
        Log.error("Update failed: \(error)")
        set(nil)
    }

    private func set(_ release: Release?) {
        lock.lock()
        found = release
        if release == nil { installHandler = nil }
        lock.unlock()
        onChange?()
    }

    deinit {
        if let observer { NotificationCenter.default.removeObserver(observer) }
    }
}
