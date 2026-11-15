// Generative text layer (port of the procedural grammar in game/src/ai.js).
//
// The app can inject its own `TextWriter` (e.g. Apple Foundation Models). The
// simulation decides every number and fact; writers only choose the wording.
import Foundation

/// A newsworthy event. `fields` holds the JS fact properties as strings
/// (e.g. `district`, `name`, `pop`, `id`, `on`, `amount`, `title`, `desc`, plus
/// `policy` / `building` display names added before a headline is requested).
public struct Fact: Codable, Equatable, Sendable {
    public var type: String
    public var fields: [String: String]
    public init(type: String, fields: [String: String] = [:]) {
        self.type = type
        self.fields = fields
    }
}

public protocol TextWriter: AnyObject {
    func headline(fact: Fact, city: String, stats: [String: String]) async -> (title: String, body: String, ai: Bool)
    func chirp(mood: String, district: String, city: String, minutes: Int) async -> (who: String, text: String, ai: Bool)
    func petition(_ p: Petition, city: String) async -> String
}

public final class ProceduralWriter: TextWriter, @unchecked Sendable {
    private var rnd: () -> Double
    private let lock = NSLock()

    public init(seed: UInt32? = nil) {
        let ms = Int64(Date().timeIntervalSince1970 * 1000)
        rnd = mulberry32(seed ?? UInt32(truncatingIfNeeded: ms))
    }

    public func seed(_ s: UInt32) {
        lock.lock(); defer { lock.unlock() }
        rnd = mulberry32(s)
    }

    private func next() -> Double {
        lock.lock(); defer { lock.unlock() }
        return rnd()
    }

    private func pick<T>(_ a: [T]) -> T {
        a[min(a.count - 1, Int(next() * Double(a.count)))]
    }

    // MARK: TextWriter

    public func headline(fact: Fact, city: String, stats: [String: String]) async -> (title: String, body: String, ai: Bool) {
        let t = templateHeadline(fact: fact, city: city, stats: stats)
        return (t.title, t.body, false)
    }

    public func chirp(mood: String, district: String, city: String, minutes: Int) async -> (who: String, text: String, ai: Bool) {
        let c = templateChirp(mood: mood, district: district, city: city, minutes: minutes)
        return (c.who, c.text, false)
    }

    public func petition(_ p: Petition, city: String) async -> String {
        p.text
    }

    // MARK: Templates (synchronous; usable as fallbacks by other writers)

    public func templateHeadline(fact: Fact, city: String, stats: [String: String]) -> (title: String, body: String) {
        var v = stats
        for (k, val) in fact.fields { v[k] = val }
        v["type"] = fact.type
        v["city"] = city
        var key = fact.type
        if fact.type == "policy" { key = fact.fields["on"] == "true" ? "policyOn" : "policyOff" }
        if fact.type == "loan" { v["amount"] = ProceduralWriter.money(Double(fact.fields["amount"] ?? "0") ?? 0) }
        let list = ProceduralWriter.H[key] ?? ProceduralWriter.H["quiet"]!
        let t = pick(list)
        return (ProceduralWriter.fill(t.0, v), ProceduralWriter.fill(t.1, v))
    }

    public func templateChirp(mood: String, district: String, city: String, minutes: Int) -> (who: String, text: String) {
        let first = pick(ProceduralWriter.FIRST)
        let last = pick(ProceduralWriter.LAST)
        var who = "@" + first + last
        if next() < 0.5 { who += String(10 + Int(next() * 89)) }
        let v = ["mood": mood, "district": district, "city": city, "m": String(minutes)]
        let list = ProceduralWriter.CHIRPS[mood] ?? ProceduralWriter.CHIRPS["love"]!
        return (who, ProceduralWriter.fill(pick(list), v))
    }

    // MARK: Helpers

    /// Replaces `{word}` placeholders (JS `/\{(\w+)\}/g`) with values, or "" when missing.
    public static func fill(_ t: String, _ v: [String: String]) -> String {
        var out = ""
        var i = t.startIndex
        while i < t.endIndex {
            let ch = t[i]
            if ch == "{" {
                var j = t.index(after: i)
                var key = ""
                while j < t.endIndex, isWord(t[j]) {
                    key.append(t[j])
                    j = t.index(after: j)
                }
                if !key.isEmpty, j < t.endIndex, t[j] == "}" {
                    out += v[key] ?? ""
                    i = t.index(after: j)
                    continue
                }
            }
            out.append(ch)
            i = t.index(after: i)
        }
        return out
    }

    private static func isWord(_ c: Character) -> Bool {
        guard let a = c.asciiValue else { return false }
        return (a >= 48 && a <= 57) || (a >= 65 && a <= 90) || (a >= 97 && a <= 122) || a == 95
    }

    public static func money(_ n: Double) -> String {
        "$" + formatThousands(Int(jsRound(n)))
    }

    static let FIRST = ["Maya", "Leo", "Ava", "Noah", "Iris", "Kai", "Zoe", "Omar", "Lena", "Theo", "Ruby", "Jun", "Nina", "Eli",
                        "Sana", "Marco", "Priya", "Owen", "Mei", "Diego"]
    static let LAST = ["Park", "Rivera", "Chen", "Okafor", "Novak", "Haas", "Silva", "Tanaka", "Moreau", "Kim", "Patel", "Byrne",
                       "Costa", "Ibrahim", "Lund"]

    static let H: [String: [(String, String)]] = [
        "fire": [("Blaze rips through {district}", "Crews raced to contain the fire as neighbours watched from the street."),
                 ("Firefighters battle flames in {district}", "Officials urge residents to check their smoke detectors."),
                 ("Smoke over {district} as fire breaks out", "The cause is under investigation.")],
        "milestone": [("{city} officially becomes a {name}", "Population tops {pop}. The council toasted the milestone at City Hall."),
                      ("Welcome to the big leagues: {city} is a {name}", "Planners say new civic buildings are now within reach.")],
        "policyOn": [("Council passes {policy}", "The mayor says the ordinance takes effect immediately."),
                     ("{policy} becomes law", "Supporters cheered; critics worry about the cost.")],
        "policyOff": [("{policy} repealed", "The council voted to end the ordinance."),
                      ("City scraps {policy}", "The mayor cited changing priorities.")],
        "built": [("New {building} opens in {district}", "Locals turned out for the ribbon cutting."),
                  ("{district} gets a {building}", "Residents say it was long overdue.")],
        "tower": [("New tower rises over {district}", "The skyline keeps climbing."),
                  ("Cranes crown {district} with a high-rise", "Developers call it a vote of confidence in {city}.")],
        "loan": [("City borrows {amount} to fund growth", "Repayments will run for ten years.")],
        "petitionDone": [("Promise kept in {district}", "“{title}” is done, and residents noticed."),
                         ("{district} celebrates as City Hall delivers", "Approval of the mayor ticks up.")],
        "petitionFailed": [("Frustration in {district} over broken promise", "Residents say “{title}” never happened.")],
        "achievement": [("{city} earns “{name}” recognition", "{desc}")],
        "traffic": [("Gridlock grips {city}", "Average congestion hit {cong}% this month."),
                    ("Commuters fume as jams spread", "The average commute is now {commute} minutes.")],
        "jobs": [("Job seekers outnumber openings", "Unemployment stands at {unemp}%.")],
        "boom": [("{city} keeps growing", "Population reached {pop} this month."),
                 ("Moving trucks everywhere in {city}", "{pop} people now call it home.")],
        "quiet": [("A calm month in {city}", "Nothing much to report — and the mayor is fine with that."),
                  ("Sunny skies over {city}", "Parks were busy and the buses ran on time.")],
    ]

    static let CHIRPS: [String: [String]] = [
        "commute": ["{m} minutes to get to work AGAIN. {district} needs a bus stop 😩",
                    "Sat in traffic so long I finished a podcast series. Thanks {city}.",
                    "Whoever designed the roads in {district}: we need to talk."],
        "noRoute": ["There is literally no road from my place to any job. How is this legal?"],
        "garbage": ["The trash in {district} hasn’t been picked up in weeks. 🗑️",
                    "Raccoons have formed a government on my street."],
        "crime": ["Second bike stolen this month in {district}. More police please.",
                  "Not feeling safe walking home in {district} lately."],
        "power": ["Power’s out in {district}. Again. Candles it is 🕯️"],
        "water": ["No running water in {district}. Showering with bottled water is a vibe I guess."],
        "pollution": ["Can’t open my windows in {district} — the factory smell is brutal."],
        "jobs": ["Applied to 30 jobs in {city}. Zero callbacks. 😞"],
        "taxes": ["Tax rate is getting wild. Considering moving out of {city}."],
        "love": ["Just moved to {district} and honestly? Love it here. 🌳",
                 "Sunset from {district} tonight was unreal. Proud to live in {city}.",
                 "Walked to the park, grabbed coffee, home in 10. {city} is getting it right."],
    ]
}
