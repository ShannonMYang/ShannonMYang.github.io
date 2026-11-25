import Cocoa
import WebKit

/// 木禾书店 · 写作台 —— macOS 原生窗口外壳
/// 复用本地 Node 写作台（studio/server.mjs），WebKit 只负责显示。
final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var serverProcess: Process?
    private var didSpawnServer = false
    private var currentPort: Int = 4400
    private let repoRoot: URL = Bundle.main.bundleURL.deletingLastPathComponent()

    // MARK: - lifecycle

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        buildWindow()
        NSApp.activate(ignoringOtherApps: true)
        connect()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationWillTerminate(_ notification: Notification) {
        if didSpawnServer, let process = serverProcess, process.isRunning {
            process.terminate()
        }
    }

    // MARK: - window / menu

    private func buildWindow() {
        let frame = NSRect(x: 0, y: 0, width: 1360, height: 900)
        window = NSWindow(
            contentRect: frame,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "木禾书店 · 写作台"
        window.minSize = NSSize(width: 980, height: 640)
        window.center()
        window.isReleasedWhenClosed = false
        window.setFrameAutosaveName("MuheStudioWindow")

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.setValue(true, forKey: "developerExtrasEnabled")
        // 让写作台里的 window.open / target=_blank 能在系统浏览器打开
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        let controller = WKUserContentController()
        controller.add(self, name: "muheOpen")
        configuration.userContentController = controller

        webView = WKWebView(frame: frame, configuration: configuration)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
    }

    private func buildMenu() {
        let mainMenu = NSMenu()

        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appItem.submenu = appMenu
        appMenu.addItem(withTitle: "关于木禾书店", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "隐藏木禾书店", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = NSMenuItem(title: "隐藏其他", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(hideOthers)
        appMenu.addItem(withTitle: "显示全部", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "退出木禾书店", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let editItem = NSMenuItem()
        mainMenu.addItem(editItem)
        let editMenu = NSMenu(title: "编辑")
        editItem.submenu = editMenu
        editMenu.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "拷贝", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        let viewItem = NSMenuItem()
        mainMenu.addItem(viewItem)
        let viewMenu = NSMenu(title: "视图")
        viewItem.submenu = viewMenu
        viewMenu.addItem(withTitle: "刷新写作台", action: #selector(reloadStudio), keyEquivalent: "r")
        viewMenu.addItem(withTitle: "打开站点预览", action: #selector(openSitePreview), keyEquivalent: "o")
        viewMenu.addItem(withTitle: "在浏览器中打开写作台", action: #selector(openStudioInBrowser), keyEquivalent: "O")
        viewMenu.addItem(.separator())
        viewMenu.addItem(withTitle: "在访达中显示内容目录", action: #selector(revealContent), keyEquivalent: "")

        let windowItem = NSMenuItem()
        mainMenu.addItem(windowItem)
        let windowMenu = NSMenu(title: "窗口")
        windowItem.submenu = windowMenu
        windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.miniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "缩放", action: #selector(NSWindow.zoom(_:)), keyEquivalent: "")
        NSApp.windowsMenu = windowMenu

        NSApp.mainMenu = mainMenu
    }

    @objc private func reloadStudio() {
        webView.reload()
    }

    @objc private func openSitePreview() {
        let file = repoRoot.appendingPathComponent(".tmp/preview-port")
        let port = (try? String(contentsOf: file, encoding: .utf8)).flatMap { Int($0.trimmingCharacters(in: .whitespacesAndNewlines)) }
        openURL("http://127.0.0.1:\(port ?? currentPort + 1)/")
    }

    @objc private func openStudioInBrowser() {
        openURL("http://127.0.0.1:\(currentPort)/")
    }

    @objc private func revealContent() {
        NSWorkspace.shared.open(repoRoot.appendingPathComponent("content"))
    }

    private func openURL(_ string: String) {
        guard let url = URL(string: string) else { return }
        NSWorkspace.shared.open(url)
    }

    // MARK: - server

    private func connect() {
        if let port = readPortFile(), probe(port: port) {
            currentPort = port
            loadStudio()
            return
        }
        guard let node = findNode() else {
            showFatal(
                title: "找不到 Node.js",
                message: "写作台需要 Node.js 18 或更高版本。请先安装 Node.js（brew install node），然后重新打开木禾书店。"
            )
            return
        }
        startServer(node: node)
    }

    private func readPortFile() -> Int? {
        let file = repoRoot.appendingPathComponent(".tmp/studio-port")
        guard let text = try? String(contentsOf: file, encoding: .utf8) else { return nil }
        return Int(text.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    private func probe(port: Int) -> Bool {
        let semaphore = DispatchSemaphore(value: 0)
        var healthy = false
        var request = URLRequest(url: URL(string: "http://127.0.0.1:\(port)/api/state")!)
        request.timeoutInterval = 1.2
        URLSession.shared.dataTask(with: request) { _, response, _ in
            if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                healthy = true
            }
            semaphore.signal()
        }.resume()
        _ = semaphore.wait(timeout: .now() + 2.0)
        return healthy
    }

    private func findNode() -> String? {
        let candidates = [
            "/opt/homebrew/bin/node",
            "/usr/local/bin/node",
            "/usr/bin/node",
            "/opt/local/bin/node",
        ]
        for candidate in candidates where FileManager.default.isExecutableFile(atPath: candidate) {
            return candidate
        }
        let task = Process()
        let pipe = Pipe()
        task.executableURL = URL(fileURLWithPath: "/bin/zsh")
        task.arguments = ["-lc", "command -v node"]
        task.standardOutput = pipe
        task.standardError = Pipe()
        do {
            try task.run()
            task.waitUntilExit()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            let path = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !path.isEmpty { return path }
        } catch {
            return nil
        }
        return nil
    }

    private func startServer(node: String) {
        let process = Process()
        let pipe = Pipe()
        process.executableURL = URL(fileURLWithPath: node)
        process.arguments = ["studio/server.mjs", "--no-open", "--parent-pid", "\(ProcessInfo.processInfo.processIdentifier)"]
        process.currentDirectoryURL = repoRoot
        process.standardOutput = pipe
        process.standardError = pipe
        do {
            try process.run()
            serverProcess = process
            didSpawnServer = true
        } catch {
            showFatal(title: "写作台启动失败", message: error.localizedDescription)
            return
        }

        var attempts = 0
        func poll() {
            attempts += 1
            if let port = readPortFile(), probe(port: port) {
                currentPort = port
                loadStudio()
                return
            }
            if attempts > 160 {
                let log = String(data: pipe.fileHandleForReading.availableData, encoding: .utf8) ?? ""
                showFatal(title: "写作台启动超时", message: "本地服务没有在 40 秒内就绪。\n\n\(log)")
                return
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { poll() }
        }
        poll()
    }

    private func loadStudio() {
        let url = URL(string: "http://127.0.0.1:\(currentPort)/")!
        webView.load(URLRequest(url: url))
    }

    private func showFatal(title: String, message: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = .critical
        alert.addButton(withTitle: "好")
        alert.runModal()
        NSApp.terminate(nil)
    }

    // MARK: - WKNavigationDelegate

    // MARK: - WKUIDelegate / bridge

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "muheOpen", let value = message.body as? String, let url = URL(string: value) else { return }
        NSWorkspace.shared.open(url)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let alert = NSAlert()
        alert.messageText = "无法连接写作台"
        alert.informativeText = "本地服务可能没有启动。\n可从终端运行 npm run studio 查看错误，然后重启应用。\n\n\(error.localizedDescription)"
        alert.alertStyle = .warning
        alert.addButton(withTitle: "重新加载")
        alert.addButton(withTitle: "退出")
        if alert.runModal() == .alertFirstButtonReturn {
            loadStudio()
        } else {
            NSApp.terminate(nil)
        }
    }
}

let application = NSApplication.shared
let delegate = AppDelegate()
application.delegate = delegate
application.setActivationPolicy(.regular)
application.run()
