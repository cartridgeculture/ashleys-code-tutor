import Cocoa
import WebKit

/// Sends events to the page: ACT.native.receive({kind, ...}).
final class Events {
    static let shared = Events()
    weak var webView: WKWebView?

    func emit(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict), let json = String(data: data, encoding: .utf8) else { return }
        let js = "window.ACT && ACT.native && ACT.native.receive(\(json));"
        if Thread.isMainThread {
            webView?.evaluateJavaScript(js, completionHandler: nil)
        } else {
            DispatchQueue.main.async { [weak self] in self?.webView?.evaluateJavaScript(js, completionHandler: nil) }
        }
    }
}

/// Handles window.webkit.messageHandlers.native.postMessage({cmd, args}) from the page.
/// Every reply is a JSON string; errors reject the page's promise.
final class Bridge: NSObject, WKScriptMessageHandlerWithReply {
    weak var webView: WKWebView?

    struct Failure: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    static let devMode = ProcessInfo.processInfo.environment["ACT_DEV"] != nil || ProcessInfo.processInfo.environment["ACT_SELFTEST"] != nil

    /// Runs blocking work (child processes, file reads) on a GCD thread.
    static func offPool<T>(_ work: @escaping () -> T) async -> T {
        await withCheckedContinuation { cont in
            DispatchQueue.global(qos: .userInitiated).async { cont.resume(returning: work()) }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let cmd = body["cmd"] as? String else {
            replyHandler(nil, "Bad message")
            return
        }
        let args = body["args"] as? [String: Any] ?? [:]
        Task { @MainActor in
            do {
                let result = try await self.handle(cmd, args)
                replyHandler(Bridge.json(result), nil)
            } catch {
                replyHandler(nil, error.localizedDescription)
            }
        }
    }

    static func json(_ value: Any?) -> String? {
        guard let value = value else { return "null" }
        guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed]) else { return "null" }
        return String(data: data, encoding: .utf8)
    }

    private func str(_ a: [String: Any], _ key: String) throws -> String {
        guard let v = a[key] as? String else { throw Failure(message: "Missing \(key)") }
        return v
    }

    @MainActor
    private func handle(_ cmd: String, _ a: [String: Any]) async throws -> Any? {
        switch cmd {
        // Files in the data folder (paths are relative to it).
        case "store.read":
            return Store.read(try str(a, "path")) as Any
        case "store.write":
            try Store.write(try str(a, "path"), try str(a, "text"))
            return true
        case "store.list":
            return Store.list(try str(a, "path"))
        case "store.remove":
            try Store.remove(try str(a, "path"))
            return true
        case "store.reveal":
            Store.reveal(a["path"] as? String ?? "")
            return true

        // Building and running the learner's code.
        case "run.start":
            let files = a["files"] as? [String: String] ?? [:]
            return try Runner.shared.start(track: try str(a, "track"), lang: try str(a, "lang"), files: files,
                                           mode: a["mode"] as? String ?? "run")
        case "run.stdin":
            Runner.shared.send(try str(a, "text"))
            return true
        case "run.stop":
            Runner.shared.stop()
            return true
        case "run.tools":
            return await Bridge.offPool { Runner.toolStatus() }

        // The tutor (Claude Code CLI on the user's Claude plan).
        case "tutor.send":
            try Tutor.shared.send(id: try str(a, "id"), args: a)
            return true
        case "tutor.stop":
            Tutor.shared.stop(try str(a, "id"))
            return true
        case "claude.status":
            return await Bridge.offPool { Tutor.status() }
        case "claude.signIn":
            return await Bridge.offPool { Tutor.signIn() }

        case "app.openURL":
            if let u = URL(string: try str(a, "url")), u.scheme == "https" || u.scheme == "http" { NSWorkspace.shared.open(u) }
            return true
        // The app icon picked in Preferences (see AppIcon.swift).
        case "app.setIcon":
            let save = a["save"] as? Bool ?? false
            if a["original"] as? Bool == true {
                guard let url = AppIcon.originalURL, let data = try? Data(contentsOf: url) else { throw Failure(message: "The original icon is missing") }
                return AppIcon.show(png: data, save: save)
            }
            let b64 = a["png"] as? String ?? ""
            if b64.isEmpty { return AppIcon.show(png: nil, save: save) }
            guard let data = Data(base64Encoded: b64) else { throw Failure(message: "Bad icon") }
            return AppIcon.show(png: data, save: save)
        case "app.originalIcon":
            return AppIcon.originalPNG() as Any
        case "app.version":
            return Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        case "app.info":
            let info = Bundle.main.infoDictionary ?? [:]
            return ["version": info["CFBundleShortVersionString"] as? String ?? "", "build": info["CFBundleVersion"] as? String ?? ""]
        case "debug.log":
            if Bridge.devMode { FileHandle.standardError.write(Data("[page] \(a["text"] as? String ?? "")\n".utf8)) }
            return true
        default:
            throw Failure(message: "Unknown command \(cmd)")
        }
    }
}
