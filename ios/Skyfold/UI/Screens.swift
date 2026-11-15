import SwiftUI
import SkyfoldCore

struct TitleView: View {
    @Environment(GameModel.self) private var game
    @State private var showNew = false
    @State private var showHelp = false

    var body: some View {
        ZStack {
            RadialGradient(colors: [.clear, Color(red: 0.03, green: 0.05, blue: 0.11).opacity(0.85)], center: .center, startRadius: 80, endRadius: 520)
                .ignoresSafeArea().allowsHitTesting(false)
            VStack(spacing: 26) {
                Spacer()
                VStack(spacing: 10) {
                    Image(systemName: "building.2.crop.circle.fill").font(.system(size: 64)).foregroundStyle(Theme.gradient)
                    Text("SKYFOLD").font(.system(size: 64, weight: .heavy, design: .rounded)).tracking(10)
                        .foregroundStyle(LinearGradient(colors: [.white, Color(red: 0.66, green: 0.85, blue: 1), Color(red: 0.49, green: 0.61, blue: 1)], startPoint: .top, endPoint: .bottom))
                    Text("Build a city that unfolds with you.").font(.headline).foregroundStyle(.white.opacity(0.8))
                }
                VStack(spacing: 10) {
                    Button { game.start() } label: { Text(game.hasSave ? "Continue \(game.world.name)" : "Explore \(game.world.name)").frame(maxWidth: .infinity) }
                        .buttonStyle(.glassProminent)
                    Button { showNew = true } label: { Text("Found a new city").frame(maxWidth: .infinity) }.buttonStyle(.glass)
                    Button { showHelp = true } label: { Text("How to play").frame(maxWidth: .infinity) }.buttonStyle(.glass)
                }
                .controlSize(.extraLarge)
                .frame(maxWidth: 420)
                Spacer()
                Text("Metal · Game Center · Apple Intelligence").font(.caption).foregroundStyle(Theme.muted)
            }
            .padding(24)
        }
        .onAppear { game.gameCenter.authenticate(); game.gameCenter.setAccessPoint(visible: true) }
        .onDisappear { game.gameCenter.setAccessPoint(visible: false) }
        .sheet(isPresented: $showNew) { NewCitySheet().presentationDetents([.medium]) }
        .sheet(isPresented: $showHelp) { HelpSheet() }
    }
}

struct NewCitySheet: View {
    @Environment(GameModel.self) private var game
    @Environment(\.dismiss) private var dismiss
    @State private var name = ["New Harbor", "Port Aurelia", "Cedar Bay", "Lumen Isle", "Brightwater", "Kestrel Point", "Juniper Cove"].randomElement()!
    @State private var seed = String(Int.random(in: 1...999_999))

    var body: some View {
        NavigationStack {
            Form {
                Section("City name") { TextField("Name", text: $name) }
                Section("Island seed") { TextField("Seed", text: $seed).keyboardType(.numberPad) }
                Section { Text("Every seed grows a different island. Your current city is replaced — save it to Game Center first if you want to keep it.").font(.footnote).foregroundStyle(.secondary) }
            }
            .navigationTitle("Found a new city")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Found") {
                        game.newCity(name: name.isEmpty ? "New Harbor" : name, seed: UInt32(seed) ?? UInt32.random(in: 1...999_999))
                        dismiss()
                    }
                }
            }
        }
    }
}

struct MenuSheet: View {
    @Environment(GameModel.self) private var game
    @Environment(\.dismiss) private var dismiss
    @State private var showNew = false

    var body: some View {
        @Bindable var game = game
        NavigationStack {
            Form {
                Section {
                    Button { game.save(); game.toast("City saved"); dismiss() } label: { Label("Save city", systemImage: "square.and.arrow.down") }
                    Button { game.cloudSave(); dismiss() } label: { Label("Save to Game Center (iCloud)", systemImage: "icloud.and.arrow.up") }
                    Button { game.gameCenter.showDashboard() } label: { Label("Leaderboards & achievements", systemImage: "trophy") }
                    Button { showNew = true } label: { Label("Found a new city", systemImage: "plus.circle") }
                }
                Section("Graphics") {
                    Picker("Quality", selection: $game.settings.quality) { ForEach(Quality.allCases) { Text($0.label).tag($0) } }
                    Picker("Frame rate", selection: $game.settings.fps) { Text("30").tag(30); Text("60").tag(60); Text("ProMotion 120").tag(120) }
                    Text("Balanced and Battery render below native resolution and upscale with MetalFX.").font(.footnote).foregroundStyle(.secondary)
                }
                Section("Gameplay") {
                    Toggle("Sound", isOn: $game.settings.sound)
                    Toggle("Haptics", isOn: $game.settings.haptics)
                    Toggle("Disasters (fires)", isOn: $game.settings.disasters)
                }
                Section("Apple Intelligence") {
                    Text(game.intelligence.statusText).font(.footnote)
                }
            }
            .navigationTitle(game.world.name)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .sheet(isPresented: $showNew) { NewCitySheet().presentationDetents([.medium]) }
        }
    }
}

struct HelpSheet: View {
    var body: some View {
        NavigationStack {
            List {
                Section("Build") { Text("Pick a tool, then drag on the map to draw roads or paint zones. Tap to place buildings — tap twice to confirm.") }
                Section("Grow") { Text("Zones develop next to roads with power. Water towers allow denser buildings; land value, schools and parks unlock towers.") }
                Section("Traffic") { Text("Every household drives to its nearest job. Upgrade busy streets to avenues and add bus stops or metro.") }
                Section("Services") { Text("Garbage needs landfills, fires need fire stations, crime needs police. Tune funding and ordinances on the desk.") }
                Section("Camera") { Text("One finger pans or draws, two fingers pan, pinch to zoom, twist to rotate. Game controllers: sticks move and orbit, A builds, shoulders switch tools.") }
                Section("Unfold") { Text("Open your phone for the Mayor’s Desk beside the city — budgets, policies, petitions, news and the AI advisor.") }
            }.navigationTitle("How to play")
        }
    }
}
