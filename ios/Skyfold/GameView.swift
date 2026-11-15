import SwiftUI
import WebKit
import UniformTypeIdentifiers

/// Hosts the bundled web game in a WKWebView.
/// Files are served through a custom `skyfold://` scheme so ES modules,
/// import maps and localStorage behave exactly like they do over HTTPS.
struct GameView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: BundleSchemeHandler.scheme)
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.preferences.isElementFullscreenEnabled = true

        let controller = config.userContentController
        let ai = FoundationModelsBridge()
        controller.add(ai, name: "skyfoldAI")
        controller.add(context.coordinator, name: "skyfoldHaptics")
        // Tell the game, before any script runs, whether on-device AI is available.
        controller.addUserScript(WKUserScript(source: ai.availabilityScript(),
                                              injectionTime: .atDocumentStart,
                                              forMainFrameOnly: true))

        let web = WKWebView(frame: .zero, configuration: config)
        ai.webView = web
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.12, alpha: 1)
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsBackForwardNavigationGestures = false
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif
        web.load(URLRequest(url: URL(string: "\(BundleSchemeHandler.scheme)://app/index.html")!))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    /// Native haptics: the game posts "light" | "medium" | "heavy" | "success" | "warning".
    final class Coordinator: NSObject, WKScriptMessageHandler {
        private let impact = [
            "light": UIImpactFeedbackGenerator(style: .light),
            "medium": UIImpactFeedbackGenerator(style: .medium),
            "heavy": UIImpactFeedbackGenerator(style: .heavy),
        ]
        private let notify = UINotificationFeedbackGenerator()

        func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let kind = message.body as? String else { return }
            switch kind {
            case "success": notify.notificationOccurred(.success)
            case "warning": notify.notificationOccurred(.warning)
            case "error": notify.notificationOccurred(.error)
            default: impact[kind]?.impactOccurred()
            }
        }
    }
}

/// Serves files from the app bundle's `game/` folder.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "skyfold"
    private let root = Bundle.main.resourceURL!.appendingPathComponent("game")

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard file.path.hasPrefix(root.standardizedFileURL.path), let data = try? Data(contentsOf: file) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        let mime: String
        switch file.pathExtension.lowercased() {
        case "js", "mjs": mime = "text/javascript"
        case "webmanifest": mime = "application/manifest+json"
        default: mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        }
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                       headerFields: ["Content-Type": mime, "Content-Length": "\(data.count)", "Cache-Control": "no-cache"])!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}
