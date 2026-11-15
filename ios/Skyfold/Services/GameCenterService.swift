import GameKit
import UIKit
import SkyfoldCore

/// GameKit: Game Center sign-in, Access Point, leaderboards, achievements and
/// cloud saves (GKSavedGame).
///
/// App Store Connect setup — create these IDs:
///  • Leaderboards: skyfold.leaderboard.population, skyfold.leaderboard.approval, skyfold.leaderboard.treasury
///  • Achievements: skyfold.achievement.<id> for each id in Events.ACHIEVEMENTS
///    (founder, pop1k, pop5k, pop15k, skyline, green, fullemp, flow, firefighter, books, beloved, scholar, civic, tourist)
final class GameCenterService {
    static let population = "skyfold.leaderboard.population"
    static let approval = "skyfold.leaderboard.approval"
    static let treasury = "skyfold.leaderboard.treasury"

    private(set) var authenticated = false
    private var reported = Set<String>()

    func authenticate() {
        GKLocalPlayer.local.authenticateHandler = { [weak self] vc, _ in
            if let vc {
                Self.topViewController()?.present(vc, animated: true)
                return
            }
            self?.authenticated = GKLocalPlayer.local.isAuthenticated
            if GKLocalPlayer.local.isAuthenticated {
                GKAccessPoint.shared.location = .bottomTrailing
                GKAccessPoint.shared.showHighlights = true
                GKAccessPoint.shared.isActive = false
            }
        }
    }

    func setAccessPoint(visible: Bool) { GKAccessPoint.shared.isActive = visible && authenticated }

    func showDashboard() {
        guard authenticated else { return }
        GKAccessPoint.shared.trigger(state: .dashboard) {}
    }

    func submit(population: Int, approval: Int, funds: Int) {
        guard authenticated else { return }
        Task {
            try? await GKLeaderboard.submitScore(population, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [Self.population])
            try? await GKLeaderboard.submitScore(approval, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [Self.approval])
            try? await GKLeaderboard.submitScore(max(0, funds), context: 0, player: GKLocalPlayer.local, leaderboardIDs: [Self.treasury])
        }
    }

    func unlock(achievement id: String) {
        guard authenticated, !reported.contains(id) else { return }
        reported.insert(id)
        let a = GKAchievement(identifier: "skyfold.achievement.\(id)")
        a.percentComplete = 100
        a.showsCompletionBanner = true
        GKAchievement.report([a]) { _ in }
    }

    /// Requires the iCloud capability (CloudKit/iCloud Documents) for saved games.
    func saveToCloud(_ world: World) async {
        guard authenticated, let data = try? world.save() else { return }
        _ = try? await GKLocalPlayer.local.saveGameData(data, withName: "Skyfold")
    }

    func loadFromCloud() async -> World? {
        guard authenticated, let games = try? await GKLocalPlayer.local.fetchSavedGames() else { return nil }
        guard let latest = games.max(by: { ($0.modificationDate ?? .distantPast) < ($1.modificationDate ?? .distantPast) }),
              let data = try? await latest.loadData() else { return nil }
        return try? World.load(data)
    }

    static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        var vc = scene?.windows.first(where: { $0.isKeyWindow })?.rootViewController
        while let p = vc?.presentedViewController { vc = p }
        return vc
    }
}
