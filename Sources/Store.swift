import Cocoa

/// ACT's data folder: ~/Library/Application Support/ACT
///   settings.json                       model, effort, theme, last track
///   tracks/<track>/state.json           current lesson, finished lessons, added lessons, tutor session id
///   tracks/<track>/chat.json            the tutor conversation
///   tracks/<track>/lessons/<n>/...      the learner's files for each lesson
///   tutor/                              the tutor's working folder (Claude Code runs here)
///   tutor/knowledge/                    reference library copied from the app on every launch
///   builds/                             compiler output
enum Store {
    static let root: URL = {
        // ACT_DATA_DIR points tests at a scratch folder so they never touch your real lessons.
        if let custom = ProcessInfo.processInfo.environment["ACT_DATA_DIR"], !custom.isEmpty {
            return URL(fileURLWithPath: custom, isDirectory: true)
        }
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("ACT", isDirectory: true)
    }()
    static var tutorDir: URL { root.appendingPathComponent("tutor", isDirectory: true) }
    static var buildsDir: URL { root.appendingPathComponent("builds", isDirectory: true) }

    static func ensureFolders() {
        let fm = FileManager.default
        for dir in [root, root.appendingPathComponent("tracks"), tutorDir, buildsDir] {
            try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        }
    }

    /// Copies the app's reference library into the tutor's folder so Claude can read it.
    static func syncKnowledge() {
        let fm = FileManager.default
        guard let src = Bundle.main.resourceURL?.appendingPathComponent("knowledge"), fm.fileExists(atPath: src.path) else { return }
        let dest = tutorDir.appendingPathComponent("knowledge", isDirectory: true)
        try? fm.removeItem(at: dest)
        try? fm.copyItem(at: src, to: dest)
    }

    /// Resolves a relative path inside the data folder; refuses anything that escapes it.
    static func url(_ path: String) throws -> URL {
        let clean = path.split(separator: "/").map(String.init)
        guard !clean.isEmpty, !clean.contains(".."), !path.hasPrefix("/") else { throw Bridge.Failure(message: "Bad path \(path)") }
        let u = root.appendingPathComponent(clean.joined(separator: "/"))
        // (".." and absolute paths are refused above; standardizing would turn /private/tmp into /tmp.)
        guard u.path.hasPrefix(root.path) else { throw Bridge.Failure(message: "Bad path \(path)") }
        return u
    }

    static func read(_ path: String) -> String? {
        guard let u = try? url(path) else { return nil }
        return try? String(contentsOf: u, encoding: .utf8)
    }

    static func write(_ path: String, _ text: String) throws {
        let u = try url(path)
        try FileManager.default.createDirectory(at: u.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data(text.utf8).write(to: u, options: .atomic)
    }

    /// Lists file names (not folders) directly inside a folder.
    static func list(_ path: String) -> [String] {
        guard let u = try? url(path) else { return [] }
        let items = (try? FileManager.default.contentsOfDirectory(at: u, includingPropertiesForKeys: [.isDirectoryKey])) ?? []
        return items.filter { (try? $0.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) != true }
            .map { $0.lastPathComponent }
            .filter { !$0.hasPrefix(".") }
            .sorted()
    }

    static func remove(_ path: String) throws {
        let u = try url(path)
        if FileManager.default.fileExists(atPath: u.path) { try FileManager.default.trashItem(at: u, resultingItemURL: nil) }
    }

    static func reveal(_ path: String) {
        let u = (try? url(path)) ?? root
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        NSWorkspace.shared.activateFileViewerSelecting([u])
    }
}
