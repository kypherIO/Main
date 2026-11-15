import Foundation
import FoundationModels
import SkyfoldCore

/// Apple Intelligence via the on-device Foundation Models framework.
///  • Guided generation (@Generable) for newspaper headlines, resident posts
///    and petitions — injected into the simulation as its TextWriter.
///  • Tool calling: the advisor can query live city stats through `CityStatsTool`.
///  • Streaming: the advisor briefing streams into the UI as it is generated.
/// When the model is unavailable the procedural writer keeps gameplay intact.
final class IntelligenceService {
    let writer: TextWriter = AppleIntelligenceWriter()

    var isAvailable: Bool { SystemLanguageModel.default.isAvailable }

    var statusText: String {
        switch SystemLanguageModel.default.availability {
        case .available: return "Apple Intelligence · on-device"
        case .unavailable(let reason):
            switch reason {
            case .deviceNotEligible: return "Procedural writer (device not eligible for Apple Intelligence)"
            case .appleIntelligenceNotEnabled: return "Procedural writer (turn on Apple Intelligence in Settings)"
            case .modelNotReady: return "Procedural writer (on-device model downloading)"
            @unknown default: return "Procedural writer"
            }
        }
    }

    /// Streams an advisor briefing. `onUpdate` receives partial text as it arrives.
    func brief(_ snapshot: CitySnapshot, onUpdate: @escaping (String, [String]) -> Void) async -> Bool {
        guard isAvailable else { return false }
        let session = LanguageModelSession(
            tools: [CityStatsTool(snapshot: snapshot)],
            instructions: """
            You are the chief of staff to the mayor of \(snapshot.city) in the city-building game Skyfold. \
            Use the cityStats tool to look up facts before answering. Be concise, warm and concrete. \
            Never invent numbers; only use numbers returned by the tool.
            """)
        do {
            let stream = session.streamResponse(to: "Brief the mayor: summarise the city in two sentences, then give three prioritised actions.", generating: AdvisorBrief.self)
            for try await snap in stream {
                let partial = snap.content
                await MainActor.run { onUpdate(partial.summary ?? "", partial.priorities ?? []) }
            }
            return true
        } catch {
            return false
        }
    }
}

/// Snapshot of city facts the model may query (value type → Sendable).
struct CitySnapshot: Sendable {
    var city: String
    var facts: [String: String]

    init(sim: Sim) {
        let s = sim.stats, w = sim.world
        city = w.name
        facts = [
            "economy": "Treasury $\(Int(w.funds)); monthly income $\(s.income), expenses $\(s.expense); taxes R\(w.tax.r)% C\(w.tax.c)% I\(w.tax.i)%; loans \(w.loans.count).",
            "people": "Population \(s.pop); happiness \(s.happiness)%; mayor approval \(Int(w.approval))%; unemployment \(Int(s.unemployment * 100))%; education \(s.education)%; health \(s.health)%.",
            "traffic": "Average congestion \(s.congestion)%; \(s.jammed) gridlocked road segments; average commute \(s.avgCommute) minutes; \(s.transitRiders) transit riders.",
            "services": "Power \(s.powerDemand)/\(s.powerSupply) MW; \(s.unwatered) buildings without water; garbage \(s.garbageProd)t vs capacity \(s.garbageCap)t; \(s.burning) fires burning; \(s.abandoned) abandoned buildings.",
            "environment": "Average pollution \(Int(s.avgPollution)); average crime \(Int(s.avgCrime)); tourists \(s.tourists)/month.",
            "advisors": sim.advice.map { $0.text }.joined(separator: " "),
        ]
    }

    func describe(_ topic: String) -> String {
        let key = topic.lowercased()
        if let v = facts.first(where: { key.contains($0.key) })?.value { return v }
        return facts.values.joined(separator: " ")
    }
}

struct CityStatsTool: Tool {
    let name = "cityStats"
    let description = "Look up live statistics for the player's city. Topics: economy, people, traffic, services, environment, advisors."
    let snapshot: CitySnapshot

    @Generable
    struct Arguments {
        @Guide(description: "One of: economy, people, traffic, services, environment, advisors")
        var topic: String
    }

    func call(arguments: Arguments) async throws -> String {
        snapshot.describe(arguments.topic)
    }
}

@Generable
struct AdvisorBrief {
    @Guide(description: "Two-sentence summary of the city's situation")
    var summary: String
    @Guide(description: "Three short, concrete, prioritised actions for the mayor")
    var priorities: [String]
}

@Generable
struct GenHeadline {
    @Guide(description: "A punchy newspaper headline, at most 70 characters")
    var title: String
    @Guide(description: "One sentence of story text, at most 160 characters")
    var body: String
}

@Generable
struct GenChirp {
    @Guide(description: "A plausible social handle starting with @, no spaces, at most 20 characters")
    var handle: String
    @Guide(description: "The post, at most 160 characters, may include one emoji")
    var text: String
}

@Generable
struct GenPetition {
    @Guide(description: "Two vivid sentences written by residents to the mayor")
    var text: String
}

/// TextWriter backed by the on-device model, falling back to ProceduralWriter.
final class AppleIntelligenceWriter: TextWriter {
    private let fallback = ProceduralWriter()
    private let voice = "You write short, witty, family-friendly flavor text for a cozy city-building game called Skyfold. Never mention real people, brands or politics. Keep facts exactly as given; do not invent numbers."

    private var ready: Bool { SystemLanguageModel.default.isAvailable }

    private func json(_ d: [String: String]) -> String {
        (try? String(data: JSONSerialization.data(withJSONObject: d, options: [.sortedKeys]), encoding: .utf8)) ?? "{}"
    }

    func headline(fact: Fact, city: String, stats: [String: String]) async -> (title: String, body: String, ai: Bool) {
        guard ready else { return await fallback.headline(fact: fact, city: city, stats: stats) }
        do {
            let s = LanguageModelSession(instructions: voice + " You are the editor of the city newspaper.")
            var data = fact.fields; data["event"] = fact.type; data["city"] = city
            for (k, v) in stats { data["stat_\(k)"] = v }
            let r = try await s.respond(to: "Write a headline and one-sentence story for this city event: \(json(data))", generating: GenHeadline.self)
            return (r.content.title, r.content.body, true)
        } catch {
            return await fallback.headline(fact: fact, city: city, stats: stats)
        }
    }

    func chirp(mood: String, district: String, city: String, minutes: Int) async -> (who: String, text: String, ai: Bool) {
        guard ready else { return await fallback.chirp(mood: mood, district: district, city: city, minutes: minutes) }
        do {
            let s = LanguageModelSession(instructions: voice + " You write social posts from individual residents.")
            let r = try await s.respond(to: "Write one post from a resident of \(district) in \(city) whose main feeling is '\(mood)'. Their commute is \(minutes) minutes.", generating: GenChirp.self)
            return (r.content.handle, r.content.text, true)
        } catch {
            return await fallback.chirp(mood: mood, district: district, city: city, minutes: minutes)
        }
    }

    func petition(_ p: Petition, city: String) async -> String {
        guard ready else { return await fallback.petition(p, city: city) }
        do {
            let s = LanguageModelSession(instructions: voice + " You write citizen petitions to the mayor.")
            let r = try await s.respond(to: "Rewrite this petition from residents of \(p.district) in \(city). Goal: \(p.goal). Original: \(p.text)", generating: GenPetition.self)
            return r.content.text
        } catch {
            return await fallback.petition(p, city: city)
        }
    }
}
