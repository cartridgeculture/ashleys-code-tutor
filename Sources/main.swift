import Cocoa
import WebKit
import UniformTypeIdentifiers

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var bridge: Bridge!
    var titleObserver: NSKeyValueObservation?
    static let appName = "Ashley's Code Tutor"

    func applicationDidFinishLaunching(_ notification: Notification) {
        Store.ensureFolders()
        Store.syncKnowledge()
        AppIcon.restore()
        buildMenu()

        let config = WKWebViewConfiguration()
        let controller = WKUserContentController()
        bridge = Bridge()
        controller.addScriptMessageHandler(bridge, contentWorld: .page, name: "native")
        if let path = ProcessInfo.processInfo.environment["ACT_SELFTEST"], let js = try? String(contentsOfFile: path, encoding: .utf8) {
            controller.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        config.userContentController = controller
        config.preferences.setValue(Bridge.devMode, forKey: "developerExtrasEnabled")
        if #available(macOS 14.0, *) { config.preferences.inactiveSchedulingPolicy = .none }
        // The page loads its own sound effects and sprite data from the app bundle,
        // and plays sounds without waiting for a click.
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.mediaTypesRequiringUserActionForPlayback = []

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        bridge.webView = webView
        Events.shared.webView = webView

        let frame = NSRect(x: 0, y: 0, width: 1560, height: 940)
        window = NSWindow(contentRect: frame, styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = AppDelegate.appName
        window.minSize = NSSize(width: 1100, height: 640)
        window.contentView = webView
        window.delegate = self
        window.setFrameAutosaveName("ACTMain")
        if !window.setFrameUsingName("ACTMain") { window.center() }
        window.makeKeyAndOrderFront(nil)
        // The page's <title> ("main.c — Lesson 1: Hello, World — Ashley's Code Tutor") becomes the window title.
        titleObserver = webView.observe(\.title, options: [.new]) { [weak self] wv, _ in
            DispatchQueue.main.async { self?.window.title = (wv.title?.isEmpty == false ? wv.title! : AppDelegate.appName) }
        }

        if let web = Bundle.main.resourceURL?.appendingPathComponent("web"), FileManager.default.fileExists(atPath: web.path) {
            webView.loadFileURL(web.appendingPathComponent("index.html"), allowingReadAccessTo: web)
        } else {
            webView.loadHTMLString("<h2 style='font-family:-apple-system'>Missing web resources in the app bundle.</h2>", baseURL: nil)
        }
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        // Let the page save open files first (with a short safety timeout).
        var replied = false
        let finish = {
            if !replied { replied = true; Runner.shared.stop(); Tutor.shared.stopAll(); NSApp.reply(toApplicationShouldTerminate: true) }
        }
        webView.callAsyncJavaScript("if (window.ACT && ACT.app && ACT.app.flush) { await ACT.app.flush(); } return true;",
                                    arguments: [:], in: nil, in: .page) { _ in finish() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { finish() }
        return .terminateLater
    }

    // Only the app's own page may load; links open in the default browser.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        let web = Bundle.main.resourceURL?.appendingPathComponent("web").path ?? ""
        if url.isFileURL && url.path.hasPrefix(web) { decisionHandler(.allow); return }
        if url.scheme == "about" || url.scheme == "blob" || url.scheme == "data" { decisionHandler(.allow); return }
        if url.scheme == "https" || url.scheme == "http" { NSWorkspace.shared.open(url) }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, url.scheme == "https" || url.scheme == "http" { NSWorkspace.shared.open(url) }
        return nil
    }

    // <input type="file"> (choosing an avatar picture in Preferences).
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.allowedContentTypes = [.image]
        panel.message = "Choose a picture for your avatar"
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.urls : nil) }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.runModal()
        completionHandler()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        completionHandler(alert.runModal() == .alertFirstButtonReturn)
    }

    // MARK: menu

    @objc func menuAction(_ sender: NSMenuItem) {
        guard let action = sender.representedObject as? String else { return }
        Events.shared.emit(["kind": "menu", "action": action])
    }

    private func item(_ title: String, _ key: String, _ action: String, mods: NSEvent.ModifierFlags = .command) -> NSMenuItem {
        let i = NSMenuItem(title: title, action: #selector(menuAction(_:)), keyEquivalent: key)
        i.keyEquivalentModifierMask = mods
        i.representedObject = action
        i.target = self
        return i
    }

    private func buildMenu() {
        let main = NSMenu()

        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(item("About Ashley's Code Tutor", "", "about"))
        appMenu.addItem(.separator())
        appMenu.addItem(item("Settings…", "", "settings"))
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide ACT", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = appMenu.addItem(withTitle: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit ACT", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        main.addItem(appItem)

        let fileItem = NSMenuItem()
        let fileMenu = NSMenu(title: "File")
        fileMenu.addItem(item("Choose a Language…", "l", "home", mods: [.command, .shift]))
        fileMenu.addItem(item("Change Tutor Character…", "", "character"))
        fileMenu.addItem(item("New File…", "n", "new-file"))
        fileMenu.addItem(.separator())
        fileMenu.addItem(item("Save", "s", "save"))
        fileMenu.addItem(item("Reset Lesson Code…", "", "reset-lesson"))
        fileMenu.addItem(item("Show Lesson Files in Finder", "", "reveal"))
        fileMenu.addItem(.separator())
        fileMenu.addItem(item("Preferences…", ",", "settings"))
        fileMenu.addItem(.separator())
        fileMenu.addItem(withTitle: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        fileItem.submenu = fileMenu
        main.addItem(fileItem)

        // Undo/copy/paste go to the web page, where the editor handles them like VS Code does.
        let editItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenu.addItem(.separator())
        editMenu.addItem(item("Ask the Tutor About Selection", "k", "ask"))
        editMenu.addItem(item("Clear Highlights", "", "clear-highlights"))
        editItem.submenu = editMenu
        main.addItem(editItem)

        let viewItem = NSMenuItem()
        let viewMenu = NSMenu(title: "View")
        viewMenu.addItem(item("Command Palette…", "p", "palette", mods: [.command, .shift]))
        viewMenu.addItem(item("Toggle Lesson Tabs", "b", "toggle-lessons", mods: [.command, .option]))
        viewMenu.addItem(item("Toggle Minimap", "", "minimap"))
        viewMenu.addItem(item("Toggle Word Wrap (⌥Z)", "", "word-wrap"))
        viewMenu.addItem(.separator())
        viewMenu.addItem(item("Zoom In", "=", "zoom-in"))
        viewMenu.addItem(item("Zoom Out", "-", "zoom-out"))
        viewMenu.addItem(item("Reset Zoom", "0", "zoom-reset"))
        viewMenu.addItem(.separator())
        let fs = viewMenu.addItem(withTitle: "Enter Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        fs.keyEquivalentModifierMask = [.command, .control]
        viewItem.submenu = viewMenu
        main.addItem(viewItem)

        let runItem = NSMenuItem()
        let runMenu = NSMenu(title: "Run")
        runMenu.addItem(item("Run", "r", "run"))
        runMenu.addItem(item("Build Only", "b", "build", mods: [.command, .shift]))
        runMenu.addItem(item("Stop", ".", "stop"))
        runItem.submenu = runMenu
        main.addItem(runItem)

        let windowItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowItem.submenu = windowMenu
        main.addItem(windowItem)
        NSApp.windowsMenu = windowMenu

        NSApp.mainMenu = main
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
