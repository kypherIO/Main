import Foundation
import WebKit
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Bridges the game's generative-text requests to Apple's on-device
/// Foundation Models framework (Apple Intelligence, iOS 26+).
///
/// JS → native:  window.webkit.messageHandlers.skyfoldAI.postMessage({ id, kind, payload })
/// native → JS:  window.__skyfoldAI(id, json)
///
/// Every request carries a procedural `fallback`; if the model is unavailable
/// or errors, the game simply keeps its own text. Gameplay never blocks on AI.
final class FoundationModelsBridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?

    static let cityVoice = """
    You write short, witty, family-friendly flavor text for a cozy city-building game called Skyfold. \
    Never mention real people, brands or politics. Keep facts exactly as given; do not invent numbers.
    """

    var isAvailable: Bool {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            if case .available = SystemLanguageModel.default.availability { return true }
        }
        #endif
        return false
    }

    func availabilityScript() -> String {
        "window.__skyfoldAIInfo = { available: \(isAvailable), model: 'Apple Foundation Model' };"
    }

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let id = body["id"] as? Int,
              let kind = body["kind"] as? String else { return }
        let payload = body["payload"] as? [String: Any] ?? [:]
        Task { @MainActor in
            let result = await self.generate(kind: kind, payload: payload)
            self.reply(id: id, result: result)
        }
    }

    @MainActor private func reply(id: Int, result: [String: Any]?) {
        let json: String
        if let result, let data = try? JSONSerialization.data(withJSONObject: result),
           let s = String(data: data, encoding: .utf8) { json = s } else { json = "null" }
        webView?.evaluateJavaScript("window.__skyfoldAI(\(id), \(json))", completionHandler: nil)
    }

    private func describe(_ payload: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]),
              let s = String(data: data, encoding: .utf8) else { return "{}" }
        return s
    }

    private func generate(kind: String, payload: [String: Any]) async -> [String: Any]? {
        #if canImport(FoundationModels)
        guard #available(iOS 26.0, *), isAvailable else { return nil }
        let facts = describe(payload)
        do {
            switch kind {
            case "headline":
                let session = LanguageModelSession(instructions: Self.cityVoice + " You are the editor of the city newspaper.")
                let r = try await session.respond(
                    to: "Write a newspaper headline and one-sentence story for this city event. Event data (JSON): \(facts)",
                    generating: Headline.self)
                return ["title": r.content.title, "body": r.content.body]

            case "chirp":
                let session = LanguageModelSession(instructions: Self.cityVoice + " You write social-media posts from individual residents.")
                let r = try await session.respond(
                    to: "Write one short post (max 160 chars, may include one emoji) from a resident whose main feeling is '\(payload["mood"] ?? "content")'. Context (JSON): \(facts)",
                    generating: Chirp.self)
                return ["handle": r.content.handle, "text": r.content.text]

            case "petition":
                let session = LanguageModelSession(instructions: Self.cityVoice + " You write citizen petitions addressed to the mayor.")
                let r = try await session.respond(
                    to: "Rewrite this petition request in two vivid sentences from the residents' point of view. Keep the same goal. Data (JSON): \(facts)",
                    generating: Petition.self)
                return ["text": r.content.text]

            case "brief":
                let session = LanguageModelSession(instructions: Self.cityVoice + " You are the mayor's chief of staff giving a crisp briefing.")
                let r = try await session.respond(
                    to: "Summarise the state of the city in two sentences and give three prioritised, concrete actions. City data (JSON): \(facts)",
                    generating: Briefing.self)
                return ["summary": r.content.summary, "priorities": r.content.priorities]

            default:
                return nil
            }
        } catch {
            return nil   // guardrail refusals, context limits, etc. → game uses its fallback text
        }
        #else
        return nil
        #endif
    }
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
@Generable
struct Headline {
    @Guide(description: "A punchy newspaper headline, at most 70 characters")
    var title: String
    @Guide(description: "One sentence of story text, at most 160 characters")
    var body: String
}

@available(iOS 26.0, *)
@Generable
struct Chirp {
    @Guide(description: "A plausible social handle starting with @, no spaces, at most 20 characters")
    var handle: String
    @Guide(description: "The post text, at most 160 characters")
    var text: String
}

@available(iOS 26.0, *)
@Generable
struct Petition {
    @Guide(description: "Two sentences written by residents to the mayor")
    var text: String
}

@available(iOS 26.0, *)
@Generable
struct Briefing {
    @Guide(description: "Two-sentence summary of the city's situation")
    var summary: String
    @Guide(description: "Exactly three short, concrete, prioritised actions for the mayor")
    var priorities: [String]
}
#endif
