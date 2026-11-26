import Foundation
import Darwin

/// Builds and runs the learner's C and C++ programs with Apple's clang.
/// Programs run attached to a pseudo-terminal, so they behave as in VS Code's terminal:
/// output appears line by line, and typed input is echoed.
final class Runner {
    static let shared = Runner()

    private let lock = NSLock()
    private var process: Process?
    private var masterFD: Int32 = -1
    private var source: DispatchSourceRead?
    private var runId = 0
    private var outputBytes = 0
    private static let outputLimit = 2_000_000

    static func clangPath() -> String? {
        for p in ["/usr/bin/clang", "/Library/Developer/CommandLineTools/usr/bin/clang"] where FileManager.default.isExecutableFile(atPath: p) { return p }
        return nil
    }

    static func toolStatus() -> [String: Any] {
        guard let clang = clangPath() else { return ["clang": false] }
        let p = Process()
        p.executableURL = URL(fileURLWithPath: clang)
        p.arguments = ["--version"]
        let out = Pipe()
        p.standardOutput = out
        p.standardError = Pipe()
        do { try p.run() } catch { return ["clang": false] }
        p.waitUntilExit()
        let s = String(data: out.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        return ["clang": p.terminationStatus == 0, "clangVersion": s.components(separatedBy: "\n").first ?? ""]
    }

    // MARK: start / stop

    func start(track: String, lang: String, files: [String: String], mode: String) throws -> Int {
        guard lang == "c" || lang == "cpp" else { throw Bridge.Failure(message: "Running \(lang) isn't available yet.") }
        guard let clang = Runner.clangPath() else {
            throw Bridge.Failure(message: "Apple's C compiler wasn't found. Install the Command Line Tools: run xcode-select --install in Terminal.")
        }
        stop()
        lock.lock(); runId += 1; let id = runId; lock.unlock()

        let safeTrack = track.filter { $0.isLetter || $0.isNumber || $0 == "-" }
        let dir = Store.buildsDir.appendingPathComponent(safeTrack, isDirectory: true)
        let src = dir.appendingPathComponent("src", isDirectory: true)
        let fm = FileManager.default
        try? fm.removeItem(at: src)
        try fm.createDirectory(at: src, withIntermediateDirectories: true)
        var sources: [String] = []
        for (name, text) in files {
            let clean = (name as NSString).lastPathComponent
            guard !clean.isEmpty, !clean.hasPrefix(".") else { continue }
            try Data(text.utf8).write(to: src.appendingPathComponent(clean))
            let ext = (clean as NSString).pathExtension.lowercased()
            if (lang == "c" && ext == "c") || (lang == "cpp" && ["cpp", "cc", "cxx", "c"].contains(ext)) { sources.append(clean) }
        }
        sources.sort()
        let exe = dir.appendingPathComponent("program")
        try? fm.removeItem(at: exe)

        DispatchQueue.global(qos: .userInitiated).async {
            self.build(id: id, clang: clang, lang: lang, dir: src, sources: sources, exe: exe, thenRun: mode == "run")
        }
        return id
    }

    private func emit(_ id: Int, _ kind: String, _ extra: [String: Any] = [:]) {
        var d: [String: Any] = ["kind": kind, "runId": id]
        extra.forEach { d[$0.key] = $0.value }
        Events.shared.emit(d)
    }

    private func build(id: Int, clang: String, lang: String, dir: URL, sources: [String], exe: URL, thenRun: Bool) {
        guard !sources.isEmpty else {
            emit(id, "run.built", ["ok": false, "output": "There's no \(lang == "c" ? ".c" : ".cpp") file to build.", "diagnostics": [], "seconds": 0])
            emit(id, "run.exit", ["code": -1, "phase": "build"])
            return
        }
        emit(id, "run.phase", ["phase": "build", "command": (lang == "c" ? "clang" : "clang++") + " " + sources.joined(separator: " ")])
        let t0 = Date()
        let p = Process()
        p.executableURL = URL(fileURLWithPath: clang)
        var args = lang == "c" ? ["-x", "c", "-std=c17"] : ["-x", "c++", "-std=c++20"]
        args += ["-Wall", "-Wextra", "-g", "-O0", "-fno-color-diagnostics", "-fsanitize=undefined", "-fno-omit-frame-pointer",
                 "-o", exe.path]
        args += sources
        if lang == "cpp" { args += ["-lc++"] }
        p.arguments = args
        p.currentDirectoryURL = dir
        let out = Pipe()
        p.standardOutput = out
        p.standardError = out
        do { try p.run() } catch {
            emit(id, "run.built", ["ok": false, "output": "Couldn't start the compiler: \(error.localizedDescription)", "diagnostics": [], "seconds": 0])
            emit(id, "run.exit", ["code": -1, "phase": "build"])
            return
        }
        let data = out.fileHandleForReading.readDataToEndOfFile()
        p.waitUntilExit()
        let text = String(data: data, encoding: .utf8) ?? ""
        let ok = p.terminationStatus == 0
        emit(id, "run.built", ["ok": ok, "output": text, "diagnostics": Runner.parseDiagnostics(text),
                               "seconds": Date().timeIntervalSince(t0)])
        guard ok else { emit(id, "run.exit", ["code": Int(p.terminationStatus), "phase": "build"]); return }
        guard thenRun else { emit(id, "run.exit", ["code": 0, "phase": "build"]); return }
        lock.lock(); let current = runId == id; lock.unlock()
        if current { launch(id: id, exe: exe, cwd: dir) }
    }

    /// clang's "file:line:col: error: message" lines.
    static func parseDiagnostics(_ text: String) -> [[String: Any]] {
        var list: [[String: Any]] = []
        let re = try! NSRegularExpression(pattern: #"^(.+?):(\d+):(\d+): (fatal error|error|warning|note): (.*)$"#, options: [.anchorsMatchLines])
        let ns = text as NSString
        for m in re.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            let file = (ns.substring(with: m.range(at: 1)) as NSString).lastPathComponent
            var sev = ns.substring(with: m.range(at: 4))
            if sev == "fatal error" { sev = "error" }
            list.append(["file": file, "line": Int(ns.substring(with: m.range(at: 2))) ?? 1,
                         "column": Int(ns.substring(with: m.range(at: 3))) ?? 1, "severity": sev,
                         "message": ns.substring(with: m.range(at: 5))])
        }
        return list
    }

    private func launch(id: Int, exe: URL, cwd: URL) {
        var master: Int32 = -1, slave: Int32 = -1
        var ws = winsize(ws_row: 40, ws_col: 120, ws_xpixel: 0, ws_ypixel: 0)
        guard openpty(&master, &slave, nil, nil, &ws) == 0 else {
            emit(id, "run.out", ["text": "Couldn't open a terminal for the program.\n"])
            emit(id, "run.exit", ["code": -1, "phase": "run"])
            return
        }
        _ = fcntl(master, F_SETFL, fcntl(master, F_GETFL) | O_NONBLOCK)
        let slaveHandle = FileHandle(fileDescriptor: slave, closeOnDealloc: false)

        let p = Process()
        p.executableURL = exe
        p.currentDirectoryURL = cwd
        var env = ProcessInfo.processInfo.environment.filter { !$0.key.hasPrefix("CLAUDE") }
        env["TERM"] = "dumb"
        env["ASAN_OPTIONS"] = "detect_leaks=0:print_summary=1"
        env["UBSAN_OPTIONS"] = "print_stacktrace=1"
        p.environment = env
        p.standardInput = slaveHandle
        p.standardOutput = slaveHandle
        p.standardError = slaveHandle

        let t0 = Date()
        let group = DispatchGroup()
        group.enter()  // output finished
        group.enter()  // process finished
        let src = DispatchSource.makeReadSource(fileDescriptor: master, queue: DispatchQueue.global(qos: .userInitiated))
        var finishedOutput = false
        src.setEventHandler { [weak self] in
            guard let self = self else { return }
            var buf = [UInt8](repeating: 0, count: 16384)
            let n = read(master, &buf, buf.count)
            if n > 0 {
                self.outputBytes += n
                let text = String(decoding: buf[0..<n], as: UTF8.self)
                self.emit(id, "run.out", ["text": text])
                if self.outputBytes > Runner.outputLimit {
                    self.emit(id, "run.out", ["text": "\n[ACT stopped the program: it printed more than 2 MB.]\n"])
                    self.process?.terminate()
                }
            } else if n == 0 || (n < 0 && errno != EAGAIN && errno != EINTR) {
                if !finishedOutput { finishedOutput = true; src.cancel() }
            }
        }
        src.setCancelHandler { close(master); group.leave() }
        p.terminationHandler = { _ in
            // Give the last output a moment to arrive, then make sure reading stops.
            DispatchQueue.global().asyncAfter(deadline: .now() + 0.3) {
                if !finishedOutput { finishedOutput = true; src.cancel() }
            }
            group.leave()
        }

        lock.lock()
        process = p
        masterFD = master
        source = src
        outputBytes = 0
        lock.unlock()

        do { try p.run() } catch {
            close(slave)
            src.cancel()
            emit(id, "run.out", ["text": "Couldn't start the program: \(error.localizedDescription)\n"])
            emit(id, "run.exit", ["code": -1, "phase": "run"])
            return
        }
        close(slave)
        src.resume()
        emit(id, "run.phase", ["phase": "run"])

        group.notify(queue: .main) { [weak self] in
            guard let self = self else { return }
            var info: [String: Any] = ["phase": "run", "seconds": Date().timeIntervalSince(t0)]
            if p.terminationReason == .uncaughtSignal {
                let sig = p.terminationStatus
                info["code"] = 128 + Int(sig)
                info["signal"] = Runner.signalName(sig)
            } else {
                info["code"] = Int(p.terminationStatus)
            }
            self.lock.lock()
            if self.process === p { self.process = nil; self.masterFD = -1; self.source = nil }
            self.lock.unlock()
            self.emit(id, "run.exit", info)
        }
    }

    static func signalName(_ s: Int32) -> String {
        switch s {
        case SIGSEGV: return "Segmentation fault (the program touched memory it doesn't own)"
        case SIGBUS: return "Bus error (bad memory access)"
        case SIGABRT: return "Aborted"
        case SIGFPE: return "Arithmetic error (for example, dividing by zero)"
        case SIGILL: return "Illegal instruction"
        case SIGTERM, SIGKILL: return "Stopped"
        default: return "Signal \(s)"
        }
    }

    /// Typed input goes to the program as if typed in a terminal ("\u{4}" = end of input, like Control-D).
    func send(_ text: String) {
        lock.lock(); let fd = masterFD; lock.unlock()
        guard fd >= 0 else { return }
        let bytes = Array(text.utf8)
        _ = bytes.withUnsafeBufferPointer { write(fd, $0.baseAddress, $0.count) }
    }

    func stop() {
        lock.lock(); let p = process; lock.unlock()
        guard let p = p, p.isRunning else { return }
        p.terminate()
        DispatchQueue.global().asyncAfter(deadline: .now() + 1) { if p.isRunning { kill(p.processIdentifier, SIGKILL) } }
    }
}
