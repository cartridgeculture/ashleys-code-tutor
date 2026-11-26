import Foundation

/// Talks to Claude through the Claude Code command-line tool, which is signed in to the user's
/// Claude plan (the same way AIM does). Each tutor reply is one `claude -p` run that resumes the
/// track's conversation, streaming its text back to the page.
final class Tutor {
    static let shared = Tutor()

    private let lock = NSLock()
    private var processes: [String: Process] = [:]

    static let lookupTools = ["Read", "Grep", "Glob"]
    static let webTools = ["WebSearch", "WebFetch"]

    // MARK: CLI discovery and sign-in

    static func findCLI() -> String? {
        let fm = FileManager.default
        let home = fm.homeDirectoryForCurrentUser.path
        let candidates = ["\(home)/.local/bin/claude", "\(home)/.claude/local/claude", "/opt/homebrew/bin/claude", "/usr/local/bin/claude", "\(home)/.npm-global/bin/claude"]
        if let hit = candidates.first(where: { fm.isExecutableFile(atPath: $0) }) { return hit }
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/zsh")
        p.arguments = ["-lc", "command -v claude"]
        let out = Pipe()
        p.standardOutput = out
        p.standardError = Pipe()
        do { try p.run() } catch { return nil }
        p.waitUntilExit()
        let s = String(data: out.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return (!s.isEmpty && fm.isExecutableFile(atPath: s)) ? s : nil
    }

    /// The environment minus anything that would make the CLI think it's nested inside another Claude Code session.
    static func cleanEnvironment(extra: [String: String] = [:]) -> [String: String] {
        var env = ProcessInfo.processInfo.environment.filter { key, _ in
            !(key == "CLAUDECODE" || key.hasPrefix("CLAUDE_CODE_") || key == "CLAUDE_EFFORT" || key == "ANTHROPIC_BASE_URL")
        }
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let path = env["PATH"] ?? "/usr/bin:/bin:/usr/sbin:/sbin"
        env["PATH"] = "\(home)/.local/bin:/opt/homebrew/bin:/usr/local/bin:\(path)"
        env["HOME"] = home
        env["USER"] = env["USER"] ?? NSUserName()
        env["LOGNAME"] = env["LOGNAME"] ?? NSUserName()
        extra.forEach { env[$0.key] = $0.value }
        return env
    }

    private static func runQuick(_ path: String, _ args: [String], timeout: Double) -> (Int32, Data) {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: path)
        p.arguments = args
        p.environment = cleanEnvironment()
        p.currentDirectoryURL = Store.tutorDir
        p.standardInput = FileHandle.nullDevice
        let out = Pipe()
        p.standardOutput = out
        p.standardError = Pipe()
        do { try p.run() } catch { return (-1, Data()) }
        DispatchQueue.global().asyncAfter(deadline: .now() + timeout) { if p.isRunning { p.terminate() } }
        let data = out.fileHandleForReading.readDataToEndOfFile()
        p.waitUntilExit()
        return (p.terminationStatus, data)
    }

    static func status() -> [String: Any] {
        guard let path = findCLI() else { return ["found": false] }
        let (_, v) = runQuick(path, ["--version"], timeout: 15)
        let version = (String(data: v, encoding: .utf8) ?? "").components(separatedBy: .whitespaces).first ?? ""
        let (_, s) = runQuick(path, ["auth", "status"], timeout: 15)
        let obj = (try? JSONSerialization.jsonObject(with: s)) as? [String: Any]
        var d: [String: Any] = ["found": true, "path": path, "version": version]
        if let signed = obj?["loggedIn"] as? Bool { d["signedIn"] = signed }
        return d
    }

    /// `claude auth login` opens the browser; the user approves there and it finishes by itself.
    static func signIn() -> Bool {
        guard let path = findCLI() else { return false }
        _ = runQuick(path, ["auth", "login"], timeout: 600)
        return (status()["signedIn"] as? Bool) == true
    }

    // MARK: Replies

    func send(id: String, args a: [String: Any]) throws {
        guard let path = Tutor.findCLI() else {
            throw Bridge.Failure(message: "Claude Code wasn't found. Install it from claude.com/code, then sign in.")
        }
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            let activity = ProcessInfo.processInfo.beginActivity(options: .userInitiatedAllowingIdleSystemSleep, reason: "Tutor is replying")
            defer { ProcessInfo.processInfo.endActivity(activity) }
            self.run(id: id, path: path, a: a)
        }
    }

    func stop(_ id: String) {
        lock.lock(); let p = processes[id]; lock.unlock()
        if let p = p, p.isRunning { p.terminate() }
    }

    func stopAll() {
        lock.lock(); let all = Array(processes.values); lock.unlock()
        all.filter { $0.isRunning }.forEach { $0.terminate() }
    }

    private func emit(_ id: String, _ kind: String, _ extra: [String: Any] = [:]) {
        var d: [String: Any] = ["kind": kind, "id": id]
        extra.forEach { d[$0.key] = $0.value }
        Events.shared.emit(d)
    }

    private func run(id: String, path: String, a: [String: Any]) {
        let model = a["model"] as? String ?? "claude-opus-5-5"
        let effort = a["effort"] as? String ?? ""
        let system = a["system"] as? String ?? ""
        let prompt = a["prompt"] as? String ?? ""
        let sessionId = a["sessionId"] as? String ?? ""
        let resume = a["resume"] as? Bool ?? false
        let web = a["web"] as? Bool ?? true

        let tools = Tutor.lookupTools + (web ? Tutor.webTools : [])
        var args = ["-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages",
                    "--safe-mode", "--strict-mcp-config", "--disable-slash-commands",
                    "--model", model, "--system-prompt", system,
                    "--tools", tools.joined(separator: ","),
                    "--permission-mode", "dontAsk", "--allowedTools", tools.joined(separator: ","),
                    "--max-turns", "16"]
        if !effort.isEmpty { args += ["--effort", effort] }
        if !sessionId.isEmpty { args += resume ? ["--resume", sessionId] : ["--session-id", sessionId] }

        let p = Process()
        p.executableURL = URL(fileURLWithPath: path)
        p.arguments = args
        p.currentDirectoryURL = Store.tutorDir
        p.environment = Tutor.cleanEnvironment(extra: ["CLAUDE_CODE_MAX_OUTPUT_TOKENS": "32000"])
        let stdin = Pipe(), stdout = Pipe(), stderr = Pipe()
        p.standardInput = stdin
        p.standardOutput = stdout
        p.standardError = stderr
        var errText = Data()
        let errLock = NSLock()
        stderr.fileHandleForReading.readabilityHandler = { h in
            let d = h.availableData
            errLock.lock(); if errText.count < 20000 { errText.append(d) }; errLock.unlock()
        }

        do { try p.run() } catch {
            emit(id, "tutor.error", ["message": "Couldn't start Claude Code: \(error.localizedDescription)"])
            return
        }
        lock.lock(); processes[id] = p; lock.unlock()
        defer { lock.lock(); processes[id] = nil; lock.unlock() }
        stdin.fileHandleForWriting.write(Data(prompt.utf8))
        try? stdin.fileHandleForWriting.close()

        var text = ""
        var messages = 0
        var lastEmit = Date.distantPast
        var toolName = ""
        var toolJSON = ""
        var resultError: String?
        var usage: [String: Any] = [:]
        var modelUsed = ""
        var newSession = sessionId

        func flush(force: Bool = false) {
            if force || Date().timeIntervalSince(lastEmit) > 0.05 {
                lastEmit = Date()
                emit(id, "tutor.delta", ["text": text])
            }
        }

        Tutor.readLines(stdout.fileHandleForReading) { line in
            guard let obj = (try? JSONSerialization.jsonObject(with: line)) as? [String: Any],
                  let type = obj["type"] as? String else { return }
            if let sid = obj["session_id"] as? String, !sid.isEmpty { newSession = sid }
            switch type {
            case "stream_event":
                guard let ev = obj["event"] as? [String: Any], let et = ev["type"] as? String else { return }
                switch et {
                case "message_start":
                    messages += 1
                    if let msg = ev["message"] as? [String: Any], let m = msg["model"] as? String { modelUsed = m }
                    if messages > 1, !text.isEmpty, !text.hasSuffix("\n\n") { text += text.hasSuffix("\n") ? "\n" : "\n\n" }
                case "content_block_start":
                    let block = ev["content_block"] as? [String: Any] ?? [:]
                    let bt = block["type"] as? String ?? ""
                    if bt == "thinking" { emit(id, "tutor.status", ["status": "thinking"]) }
                    if bt == "tool_use" || bt == "server_tool_use" {
                        toolName = block["name"] as? String ?? "tool"
                        toolJSON = ""
                    }
                    if bt == "text" { emit(id, "tutor.status", ["status": "writing"]) }
                case "content_block_delta":
                    guard let delta = ev["delta"] as? [String: Any] else { return }
                    if (delta["type"] as? String) == "text_delta", let t = delta["text"] as? String {
                        text += t
                        flush()
                    } else if (delta["type"] as? String) == "input_json_delta", let pj = delta["partial_json"] as? String {
                        toolJSON += pj
                    }
                case "content_block_stop":
                    if !toolName.isEmpty {
                        let input = (try? JSONSerialization.jsonObject(with: Data(toolJSON.utf8))) as? [String: Any] ?? [:]
                        let detail = (input["file_path"] ?? input["pattern"] ?? input["query"] ?? input["url"] ?? "") as? String ?? ""
                        emit(id, "tutor.tool", ["name": toolName, "detail": detail])
                        toolName = ""
                    }
                default: break
                }
            case "result":
                if let u = obj["usage"] as? [String: Any] { usage = u }
                let subtype = obj["subtype"] as? String ?? ""
                if (obj["is_error"] as? Bool) == true || subtype.hasPrefix("error") {
                    resultError = (obj["result"] as? String) ?? (obj["errors"] as? [String])?.joined(separator: "; ") ?? "Claude Code reported an error (\(subtype))."
                }
                if text.isEmpty, let r = obj["result"] as? String, resultError == nil { text = r }
            default:
                break
            }
        }
        p.waitUntilExit()
        stderr.fileHandleForReading.readabilityHandler = nil
        errLock.lock(); let errString = String(data: errText, encoding: .utf8) ?? ""; errLock.unlock()

        if p.terminationReason == .uncaughtSignal {
            emit(id, "tutor.done", ["text": text, "stopped": true, "sessionId": newSession, "model": modelUsed])
            return
        }
        let problem = resultError ?? (text.isEmpty ? errString.trimmingCharacters(in: .whitespacesAndNewlines) : nil)
        if let e = problem, !e.isEmpty || text.isEmpty {
            var code = ""
            let all = e + " " + errString
            if all.range(of: "No conversation found|session.*not found", options: [.regularExpression, .caseInsensitive]) != nil { code = "session-missing" }
            else if all.range(of: "not logged in|/login|invalid api key|oauth|authenticat", options: [.regularExpression, .caseInsensitive]) != nil { code = "signed-out" }
            else if all.range(of: "overloaded|rate limit|529|usage limit|limit reached", options: [.regularExpression, .caseInsensitive]) != nil { code = "busy" }
            emit(id, "tutor.error", ["message": e.isEmpty ? "Claude Code stopped without a reply (\(p.terminationStatus))." : e,
                                     "code": code, "partial": text])
            return
        }
        flush(force: true)
        emit(id, "tutor.done", ["text": text, "sessionId": newSession, "model": modelUsed, "usage": usage])
    }

    /// Calls `body` with each complete line written to `handle`, until end of file.
    static func readLines(_ handle: FileHandle, _ body: (Data) -> Void) {
        var buffer = Data()
        while true {
            let chunk = handle.availableData
            if chunk.isEmpty { break }
            buffer.append(chunk)
            while let nl = buffer.firstIndex(of: 0x0A) {
                body(buffer.subdata(in: buffer.startIndex..<nl))
                buffer.removeSubrange(buffer.startIndex...nl)
            }
        }
        if !buffer.isEmpty { body(buffer) }
    }
}
