import AppIntents
import Foundation
import SkyfoldCore

/// Lightweight city summary persisted for Siri / Shortcuts / Spotlight.
struct IntentsSnapshot: Codable {
    var city: String = "your city"
    var pop: Int = 0
    var happiness: Int = 0
    var approval: Int = 0
    var funds: Int = 0
    var net: Int = 0
    var topAdvice: String = ""

    static let key = "skyfold.intents.snapshot"

    static func store(from sim: Sim) {
        let s = sim.stats
        let snap = IntentsSnapshot(city: sim.world.name, pop: s.pop, happiness: s.happiness, approval: Int(sim.world.approval),
                                   funds: Int(sim.world.funds), net: s.income - s.expense, topAdvice: sim.advice.first?.text ?? "")
        if let d = try? JSONEncoder().encode(snap) { UserDefaults.standard.set(d, forKey: key) }
    }

    static func load() -> IntentsSnapshot {
        guard let d = UserDefaults.standard.data(forKey: key), let s = try? JSONDecoder().decode(IntentsSnapshot.self, from: d) else { return IntentsSnapshot() }
        return s
    }

    var summary: String {
        guard pop > 0 else { return "\(city) is still waiting for its first residents." }
        let money = net >= 0 ? "a surplus of $\(net.formatted()) a month" : "a deficit of $\((-net).formatted()) a month"
        return "\(city) has \(pop.formatted()) residents, \(happiness)% happiness and \(approval)% approval, running \(money). \(topAdvice)"
    }
}

struct CityStatusIntent: AppIntent {
    static let title: LocalizedStringResource = "City Status"
    static let description = IntentDescription("Hear how your Skyfold city is doing.")

    func perform() async throws -> some IntentResult & ProvidesDialog {
        .result(dialog: IntentDialog(stringLiteral: IntentsSnapshot.load().summary))
    }
}

struct OpenCityIntent: AppIntent {
    static let title: LocalizedStringResource = "Open My City"
    static let openAppWhenRun = true
    func perform() async throws -> some IntentResult { .result() }
}

struct SkyfoldShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: CityStatusIntent(), phrases: ["How is my city in \(.applicationName)", "\(.applicationName) city status"],
                    shortTitle: "City Status", systemImageName: "building.2.crop.circle")
        AppShortcut(intent: OpenCityIntent(), phrases: ["Open my city in \(.applicationName)"],
                    shortTitle: "Open City", systemImageName: "map")
    }
}
