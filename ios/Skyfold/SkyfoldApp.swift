import SwiftUI

@main
struct SkyfoldApp: App {
    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()          // the web UI handles safe areas itself
                .statusBarHidden(true)
                .persistentSystemOverlays(.hidden)
                .background(Color(red: 0.04, green: 0.06, blue: 0.12))
        }
    }
}
