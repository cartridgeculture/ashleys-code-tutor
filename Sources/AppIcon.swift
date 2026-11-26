import Cocoa

/// The app icon picked in Preferences (none = the icon the app ships with, the purple and yellow pixel "ACT").
/// Like AIM, it's kept in the data folder and put back on the app each time it opens, since installing an update
/// brings back the shipped icon.
enum AppIcon {
    static var savedURL: URL { Store.root.appendingPathComponent("app-icon.png") }
    static var bundlePath: String { Bundle.main.bundlePath }
    /// Test runs (a scratch data folder or a self-test script) only change the Dock, never the app in Finder.
    static var testMode: Bool {
        let env = ProcessInfo.processInfo.environment
        return env["ACT_SELFTEST"] != nil || env["ACT_DATA_DIR"] != nil
    }

    /// ACT's first icon (the blue one), offered as "Original".
    static var originalURL: URL? { Bundle.main.url(forResource: "OriginalIcon", withExtension: "png") }

    /// Shows the icon in the Dock now. save: also keeps it for next time and puts it on the app in Finder,
    /// Launchpad, and the Dock while the app is closed. png nil = back to the shipped icon.
    @MainActor
    static func show(png: Data?, save: Bool) -> Bool {
        let image = png.flatMap { NSImage(data: $0) }
        if png != nil && image == nil { return false }
        NSApp.applicationIconImage = image
        guard save else { return true }
        if let png { try? png.write(to: savedURL, options: .atomic) } else { try? FileManager.default.removeItem(at: savedURL) }
        if !testMode { NSWorkspace.shared.setIcon(image, forFile: bundlePath, options: []) }
        return true
    }

    @MainActor
    static func restore() {
        guard let image = NSImage(contentsOf: savedURL) else { return }
        NSApp.applicationIconImage = image
        // An update replaced the app (and its icon): put the picked one back on it.
        if !testMode, !FileManager.default.fileExists(atPath: bundlePath + "/Icon\r") {
            NSWorkspace.shared.setIcon(image, forFile: bundlePath, options: [])
        }
    }

    /// The Original icon, small, for the picker (base64 PNG).
    static func originalPNG() -> String? {
        guard let url = originalURL, let image = NSImage(contentsOf: url),
              let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 128, pixelsHigh: 128, bitsPerSample: 8, samplesPerPixel: 4,
                                         hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0) else { return nil }
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
        image.draw(in: NSRect(x: 0, y: 0, width: 128, height: 128))
        NSGraphicsContext.restoreGraphicsState()
        return rep.representation(using: .png, properties: [:])?.base64EncodedString()
    }
}
