import SwiftUI

@main
struct SkyfoldApp: App {
    @State private var game = GameModel()
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(game)
                .preferredColorScheme(.dark)
                .statusBarHidden(true)
                .persistentSystemOverlays(.hidden)
                .onChange(of: phase) { _, p in if p != .active && game.playing { game.save() } }
        }
    }
}

/// Fold-aware root layout.
///  • Folded cover screen: full-bleed city, bottom tool dock, desk as a sheet.
///  • Unfolded inner screen (1878 × 2670 px @ 430 ppi = 626 × 890 pt): city on top,
///    Mayor's Desk docked below (portrait) or beside (landscape).
struct ContentView: View {
    @Environment(GameModel.self) private var game

    static func isUnfolded(_ s: CGSize) -> Bool {
        let short = min(s.width, s.height), aspect = s.width / max(1, s.height)
        return (short >= 560 && aspect > 0.62 && aspect < 1.75) || short >= 740
    }

    var body: some View {
        @Bindable var game = game
        GeometryReader { geo in
            let unfolded = Self.isUnfolded(geo.size)
            let landscape = geo.size.width > geo.size.height
            ZStack {
                if game.playing && unfolded {
                    if landscape {
                        HStack(spacing: 0) {
                            CityLayer(compact: false)
                            DeskView().frame(width: min(400, max(300, geo.size.width * 0.31)))
                        }
                    } else {
                        VStack(spacing: 0) {
                            CityLayer(compact: false)
                            DeskView().frame(height: max(270, geo.size.height * 0.37))
                        }
                    }
                } else {
                    CityLayer(compact: !unfolded || !game.playing)
                }
                if !game.playing { TitleView().transition(.opacity) }
            }
            .animation(.easeInOut(duration: 0.4), value: game.playing)
        }
        .background(Color(red: 0.04, green: 0.06, blue: 0.12))
        .ignoresSafeArea(.container, edges: .all)
        .sheet(isPresented: $game.deskOpen) {
            DeskView()
                .presentationDetents([.medium, .large])
                .presentationBackgroundInteraction(.enabled(upThrough: .medium))
        }
        .fullScreenCover(isPresented: $game.showAR) { ARCityScreen() }
    }
}

struct CityLayer: View {
    @Environment(GameModel.self) private var game
    let compact: Bool

    var body: some View {
        ZStack(alignment: .top) {
            MetalCityView().ignoresSafeArea()
            if game.playing {
                VStack(spacing: 8) {
                    TopBar(compact: compact)
                    HintPill()
                    PetitionBanner()
                    ToastStack()
                    Spacer(minLength: 0)
                    if compact { ToolDock() }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                if !compact {
                    HStack { ToolRail(); Spacer() }
                        .padding(.top, 74).padding(.leading, 10).padding(.bottom, 10)
                }
                FloatingButtons(compact: compact)
                InspectCard(compact: compact)
            }
        }
    }
}
