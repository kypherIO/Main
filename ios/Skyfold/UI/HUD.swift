import SwiftUI
import SkyfoldCore

// MARK: - Theme
enum Theme {
    static let accent = Color(red: 0.31, green: 0.82, blue: 1.0)
    static let accent2 = Color(red: 0.49, green: 0.36, blue: 1.0)
    static let good = Color(red: 0.31, green: 0.89, blue: 0.6)
    static let warn = Color(red: 1.0, green: 0.77, blue: 0.28)
    static let bad = Color(red: 1.0, green: 0.36, blue: 0.42)
    static let muted = Color(white: 0.65)
    static let res = Color(red: 0.37, green: 0.82, blue: 0.41)
    static let com = Color(red: 0.29, green: 0.66, blue: 1.0)
    static let ind = Color(red: 1.0, green: 0.77, blue: 0.28)
    static let gradient = LinearGradient(colors: [accent, accent2], startPoint: .topLeading, endPoint: .bottomTrailing)
}

extension View {
    /// iOS 26 Liquid Glass panel.
    func glassPanel(_ radius: CGFloat = 18, interactive: Bool = false) -> some View {
        glassEffect(interactive ? .regular.interactive() : .regular, in: .rect(cornerRadius: radius))
    }
}

func money(_ v: Double) -> String { (v < 0 ? "-$" : "$") + Int(abs(v)).formatted() }
func short(_ v: Int) -> String {
    let a = abs(v)
    if a >= 1_000_000 { return String(format: "%.1fM", Double(v) / 1e6) }
    if a >= 10_000 { return String(format: "%.1fk", Double(v) / 1e3) }
    return v.formatted()
}

extension Tool {
    var symbol: String {
        switch self {
        case .inspect: "magnifyingglass"
        case .bulldoze: "hammer.fill"
        case .road: "road.lanes"
        case .avenue: "road.lanes.curved.right"
        case .res: "house.fill"
        case .com: "storefront.fill"
        case .ind: "gearshape.2.fill"
        case .wind: "wind"
        case .solar: "sun.max.fill"
        case .gas: "bolt.fill"
        case .tower: "drop.fill"
        case .landfill: "trash.fill"
        case .recycling: "arrow.3.trianglepath"
        case .police: "shield.lefthalf.filled"
        case .fire: "flame.fill"
        case .clinic: "cross.case.fill"
        case .hospital: "cross.fill"
        case .school: "graduationcap.fill"
        case .university: "building.columns.fill"
        case .bus: "bus.fill"
        case .metro: "tram.fill"
        case .park: "tree.fill"
        case .stadium: "sportscourt.fill"
        }
    }
    var tint: Color {
        switch self { case .res: Theme.res; case .com: Theme.com; case .ind: Theme.ind; case .bulldoze: Theme.bad; default: .white }
    }
    var shortLabel: String {
        switch self {
        case .res: "Homes"; case .com: "Shops"; case .ind: "Industry"; case .wind: "Wind"; case .gas: "Gas Plant"; case .tower: "Water"
        case .police: "Police"; case .fire: "Fire"; case .solar: "Solar"; case .recycling: "Recycle"; case .university: "University"
        case .bus: "Bus Stop"; case .metro: "Metro"
        default: label
        }
    }
}

// MARK: - Top bar
struct TopBar: View {
    @Environment(GameModel.self) private var game
    let compact: Bool
    @State private var showMenu = false

    var body: some View {
        let _ = game.hudTick
        let s = game.sim.stats, w = game.world
        HStack(spacing: 10) {
            Button { showMenu = true } label: { Image(systemName: "line.3.horizontal").font(.title3.weight(.semibold)).frame(width: 40, height: 40) }
                .buttonStyle(.plain)
            if !compact {
                VStack(alignment: .leading, spacing: 1) {
                    Text(w.name).font(.subheadline.weight(.bold)).lineLimit(1)
                    Text("\(w.dateString()) · \(game.sim.milestone().name)").font(.caption2).foregroundStyle(Theme.muted)
                }.frame(maxWidth: 140, alignment: .leading)
            }
            Spacer(minLength: 0)
            kpi("dollarsign.circle", money(w.funds), delta: s.income - s.expense)
            kpi("person.2.fill", short(s.pop))
            if !compact { kpi("face.smiling", "\(s.happiness)%") }
            RCIBars(demand: game.sim.demand)
            SpeedControl(compact: compact)
        }
        .padding(.horizontal, 8).frame(height: 54)
        .glassPanel(18)
        .sheet(isPresented: $showMenu) { MenuSheet().presentationDetents([.medium, .large]) }
    }

    private func kpi(_ symbol: String, _ value: String, delta: Int? = nil) -> some View {
        HStack(spacing: 4) {
            Image(systemName: symbol).font(.caption).foregroundStyle(Theme.muted)
            Text(value).font(.subheadline.weight(.semibold)).monospacedDigit()
            if let delta, delta != 0 {
                Text((delta > 0 ? "+" : "−") + short(abs(delta))).font(.caption2.weight(.semibold)).foregroundStyle(delta > 0 ? Theme.good : Theme.bad)
            }
        }.lineLimit(1)
    }
}

struct RCIBars: View {
    let demand: Demand
    var body: some View {
        HStack(spacing: 3) {
            bar(demand.r, Theme.res); bar(demand.c, Theme.com); bar(demand.i, Theme.ind)
        }.frame(height: 34).accessibilityLabel("Demand")
    }
    private func bar(_ v: Double, _ c: Color) -> some View {
        GeometryReader { g in
            let h = g.size.height
            ZStack {
                Capsule().fill(.white.opacity(0.1))
                Rectangle().fill(.white.opacity(0.3)).frame(height: 1)
                Capsule().fill(c.opacity(v >= 0 ? 1 : 0.45))
                    .frame(height: max(2, CGFloat(abs(v)) * h / 2))
                    .offset(y: v >= 0 ? -CGFloat(abs(v)) * h / 4 : CGFloat(abs(v)) * h / 4)
            }
        }.frame(width: 7)
    }
}

struct SpeedControl: View {
    @Environment(GameModel.self) private var game
    let compact: Bool
    var body: some View {
        HStack(spacing: 2) {
            ForEach(compact ? [0, max(1, game.speed)] : [0, 1, 2, 3], id: \.self) { s in
                Button {
                    if compact && s > 0 && game.speed == s { game.setSpeed(s % 3 + 1) }
                    else if s == 0 && game.speed == 0 { game.togglePause() }
                    else { game.setSpeed(s) }
                    game.haptics.play(.tick)
                } label: {
                    Image(systemName: ["pause.fill", "play.fill", "forward.fill", "forward.end.alt.fill"][s])
                        .font(.footnote.weight(.bold))
                        .frame(width: 32, height: 32)
                        .foregroundStyle(game.speed == s ? .white : Theme.muted)
                        .background(game.speed == s ? AnyShapeStyle(Theme.gradient) : AnyShapeStyle(.clear), in: .rect(cornerRadius: 9))
                }.buttonStyle(.plain)
            }
        }.padding(3).background(.black.opacity(0.25), in: .rect(cornerRadius: 12))
    }
}

// MARK: - Hint, petitions, toasts
struct HintPill: View {
    @Environment(GameModel.self) private var game
    var body: some View {
        if let h = game.hint {
            Text(h).font(.footnote.weight(.semibold)).multilineTextAlignment(.center)
                .padding(.horizontal, 14).padding(.vertical, 9).glassPanel(14)
                .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}

struct PetitionBanner: View {
    @Environment(GameModel.self) private var game
    var body: some View {
        if let p = game.petitionOffer {
            VStack(alignment: .leading, spacing: 8) {
                Label("Petition · \(p.district)", systemImage: "doc.text.fill").font(.footnote.weight(.bold)).foregroundStyle(Theme.warn)
                Text(p.text).font(.subheadline)
                Text("Goal: \(p.goal) within \(p.months) months · \(p.rewardCash > 0 ? "$\(p.rewardCash.formatted()) + " : "")approval +\(Int(p.rewardApproval))")
                    .font(.caption).foregroundStyle(Theme.muted)
                HStack {
                    Button("Accept") { game.sim.events.accept(); game.petitionOffer = nil; game.haptics.play(.success); game.toast("Petition accepted — see Goals") }
                        .buttonStyle(.borderedProminent).tint(Theme.accent)
                    Button { game.focus(tile: game.world.idx(p.x, p.z)) } label: { Label("Show", systemImage: "mappin") }.buttonStyle(.bordered)
                    Button("Decline") { game.sim.events.decline(); game.petitionOffer = nil }.buttonStyle(.bordered)
                }.controlSize(.small)
            }
            .padding(14).frame(maxWidth: 460).glassPanel(20)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}

struct ToastStack: View {
    @Environment(GameModel.self) private var game
    var body: some View {
        VStack(spacing: 6) {
            ForEach(game.toasts) { t in
                Text(t.text).font(.footnote.weight(.semibold)).multilineTextAlignment(.center)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(t.kind == .milestone ? AnyShapeStyle(Theme.gradient) : AnyShapeStyle(.clear), in: .rect(cornerRadius: 14))
                    .glassPanel(14)
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(t.kind == .bad ? Theme.bad.opacity(0.7) : .clear, lineWidth: 1))
                    .onTapGesture { if let at = t.at { game.focus(tile: at) } }
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.35), value: game.toasts)
        .frame(maxWidth: 460)
    }
}

// MARK: - Tools
struct ToolButton: View {
    @Environment(GameModel.self) private var game
    let tool: Tool
    var size: CGFloat = 64

    var body: some View {
        let locked = tool.service.map { game.world.peakPop < SERVICES[$0]!.unlock } ?? false
        let on = game.tool == tool
        Button { game.select(tool) } label: {
            VStack(spacing: 2) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: tool.symbol).font(.system(size: 22, weight: .semibold)).foregroundStyle(tool.tint)
                        .frame(width: 30, height: 26)
                    if locked { Image(systemName: "lock.fill").font(.system(size: 9)).offset(x: 10, y: -4) }
                }
                Text(tool.shortLabel).font(.system(size: 9.5, weight: .semibold)).lineLimit(1)
                if tool.cost > 0 { Text("$\(short(tool.cost))").font(.system(size: 9)).foregroundStyle(Theme.muted).monospacedDigit() }
            }
            .frame(width: size, height: size)
            .background(on ? AnyShapeStyle(LinearGradient(colors: [Theme.accent.opacity(0.3), Theme.accent2.opacity(0.3)], startPoint: .top, endPoint: .bottom)) : AnyShapeStyle(.clear), in: .rect(cornerRadius: 15))
            .overlay(RoundedRectangle(cornerRadius: 15).stroke(on ? Theme.accent : .clear, lineWidth: 1.5))
            .opacity(locked ? 0.42 : 1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tool.label)
    }
}

struct ToolDock: View {
    @Environment(GameModel.self) private var game
    var body: some View {
        let _ = game.hudTick
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(Tool.allCases, id: \.self) { t in ToolButton(tool: t).id(t) }
                }.padding(7)
            }
            .onChange(of: game.tool) { _, t in withAnimation { proxy.scrollTo(t, anchor: .center) } }
        }
        .glassPanel(22)
    }
}

struct ToolRail: View {
    @Environment(GameModel.self) private var game
    private let groups = ["Core", "Zones", "Utilities", "Services", "Transit", "Leisure"]
    var body: some View {
        let _ = game.hudTick
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(groups, id: \.self) { g in
                    Text(g.uppercased()).font(.system(size: 10.5, weight: .bold)).tracking(1).foregroundStyle(Theme.muted).padding(.top, 4)
                    LazyVGrid(columns: [GridItem(.fixed(66), spacing: 6), GridItem(.fixed(66), spacing: 6)], spacing: 6) {
                        ForEach(Tool.allCases.filter { $0.group == g }, id: \.self) { t in ToolButton(tool: t, size: 66) }
                    }
                }
            }.padding(10)
        }
        .frame(width: 162)
        .glassPanel(22)
    }
}

struct FloatingButtons: View {
    @Environment(GameModel.self) private var game
    let compact: Bool
    var body: some View {
        @Bindable var game = game
        VStack(spacing: 10) {
            Menu {
                Picker("Layer", selection: $game.overlay) {
                    ForEach(Overlay.allCases, id: \.self) { o in Text(o.label).tag(o) }
                }
            } label: { fab("square.3.layers.3d", on: game.overlay != .none) }
            if compact { Button { game.deskOpen = true } label: { fab("chart.xyaxis.line", on: game.deskOpen) }.buttonStyle(.plain) }
            Button { game.showAR = true } label: { fab("arkit", on: false) }.buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: compact ? .bottomTrailing : .topTrailing)
        .padding(.trailing, 12)
        .padding(.top, compact ? 0 : 76)
        .padding(.bottom, compact ? 104 : 0)
    }
    private func fab(_ s: String, on: Bool) -> some View {
        Image(systemName: s).font(.title3.weight(.semibold)).frame(width: 50, height: 50)
            .glassPanel(16, interactive: true)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(on ? Theme.accent : .clear, lineWidth: 1.5))
    }
}

// MARK: - Inspect card
struct InspectCard: View {
    @Environment(GameModel.self) private var game
    let compact: Bool
    @State private var quote: String?

    var body: some View {
        let _ = game.hudTick
        if let i = game.inspectTile {
            let info = TileInfo(i, game: game)
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    Image(systemName: info.symbol).font(.headline).foregroundStyle(.black).frame(width: 34, height: 34).background(info.color, in: .rect(cornerRadius: 10))
                    VStack(alignment: .leading, spacing: 1) {
                        Text(info.title).font(.headline)
                        Text(info.subtitle).font(.caption).foregroundStyle(Theme.muted).lineLimit(2)
                    }
                    Spacer()
                    Button { game.inspectTile = nil; game.scene?.cursorBatch.instances = [] } label: { Image(systemName: "xmark").foregroundStyle(Theme.muted) }.buttonStyle(.plain)
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                    ForEach(Array(info.rows.enumerated()), id: \.offset) { _, r in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(r.0.uppercased()).font(.system(size: 10)).foregroundStyle(Theme.muted)
                            Text(r.1).font(.subheadline.weight(.semibold)).foregroundStyle(r.2).monospacedDigit()
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(8).background(.white.opacity(0.06), in: .rect(cornerRadius: 10))
                    }
                }
                if !info.factors.isEmpty {
                    VStack(spacing: 4) { ForEach(info.factors, id: \.label) { f in FactorRow(label: f.label, value: f.value) } }
                }
                if let tip = info.tip { Text(tip).font(.footnote).padding(8).frame(maxWidth: .infinity, alignment: .leading).background(Theme.accent.opacity(0.12), in: .rect(cornerRadius: 10)) }
                if info.isHome, let q = quote { Text(q).font(.footnote.italic()).foregroundStyle(.white.opacity(0.85)) }
            }
            .padding(14)
            .frame(maxWidth: compact ? .infinity : 320)
            .glassPanel(20)
            .padding(.horizontal, compact ? 8 : 12)
            .padding(.bottom, compact ? 100 : 12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: compact ? .bottom : .bottomTrailing)
            .task(id: i) {
                quote = nil
                guard info.isHome else { return }
                let w = game.world, (x, z) = w.xz(i)
                let c = Int(w.commute[i])
                let mood = c == 255 ? "noRoute" : w.power[i] == 0 ? "power" : w.garbage[i] > 45 ? "garbage" : w.crime[i] > 25 ? "crime" : w.pollution[i] > 25 ? "pollution" : c > 26 ? "commute" : "love"
                let r = await game.intelligence.writer.chirp(mood: mood, district: w.district(x, z), city: w.name, minutes: c)
                quote = "\(r.who) “\(r.text)”\(r.ai ? "  ✦" : "")"
            }
        }
    }
}

struct FactorRow: View {
    let label: String; let value: Int
    var body: some View {
        HStack(spacing: 8) {
            Text(label).font(.caption).frame(width: 110, alignment: .leading)
            GeometryReader { g in
                Capsule().fill(value >= 0 ? Theme.good : Theme.bad).frame(width: min(g.size.width, CGFloat(abs(value)) * g.size.width / 25), height: 7)
                    .frame(maxHeight: .infinity)
            }.frame(height: 10)
            Text("\(value > 0 ? "+" : "")\(value)").font(.caption.weight(.semibold)).foregroundStyle(value >= 0 ? Theme.good : Theme.bad).frame(width: 30, alignment: .trailing).monospacedDigit()
        }
    }
}

/// Human-readable facts about a tile (shared by the inspect card).
struct TileInfo {
    var title = "Open land", subtitle = "Grassland", symbol = "leaf.fill", color = Theme.res
    var rows: [(String, String, Color)] = []
    var factors: [Factor] = []
    var tip: String?
    var isHome = false

    init(_ i: Int, game: GameModel) {
        let w = game.world, sim = game.sim
        let (x, z) = w.xz(i), district = w.district(x, z)
        let k = Kind(rawValue: w.kind[i]) ?? .empty, L = Int(w.level[i]), fl = TileFlags(rawValue: w.flags[i])
        func yes(_ b: Bool) -> (String, Color) { b ? ("Yes", Theme.good) : ("No", Theme.bad) }
        subtitle = district + " · " + (w.terrain[i] != 0 ? "Water" : w.tree[i] != 0 ? "Woodland" : "Grassland")
        if fl.contains(.rubble) {
            title = "Rubble"; subtitle = "\(district) · destroyed by fire — bulldoze to rebuild"; symbol = "hammer.fill"; color = .gray
        } else if k == .road {
            let R = ROADS[L]; title = R.name; symbol = L > 0 ? "road.lanes.curved.right" : "road.lanes"; color = .gray
            subtitle = "\(district) · capacity \(Int(R.cap))"
            let t = Int(w.traffic[i])
            rows.append(("Traffic", "\(t)%", t > 100 ? Theme.bad : t > 70 ? Theme.warn : Theme.good))
            if L == 0 && t > 80 { tip = "Drag the Avenue tool over this street to nearly triple its capacity." }
        } else if k == .res || k == .com || k == .ind {
            let zi = zoneInfo(k)
            title = zi.name; color = k == .res ? Theme.res : k == .com ? Theme.com : Theme.ind
            symbol = k == .res ? "house.fill" : k == .com ? "storefront.fill" : "gearshape.2.fill"
            subtitle = district + " · " + (fl.contains(.abandoned) ? "Abandoned" : fl.contains(.burning) ? "On fire!" : L > 0 ? ["", "Low density", "Medium density", "High density"][L] : "Zoned · awaiting development")
            let alive = !fl.contains(.abandoned)
            if k == .res { rows.append(("Residents", "\(alive ? zi.pop[L] : 0)", .white)) } else { rows.append(("Jobs", "\(alive ? zi.jobs[L] : 0)", .white)) }
            let p = yes(w.power[i] != 0), wa = yes(w.water[i] != 0)
            rows.append(("Power", p.0, p.1)); rows.append(("Water", wa.0, wa.1))
            if k == .res && L > 0 {
                isHome = true
                rows.append(("Happy", "\(Int(sim.tileHappiness(i)))%", .white))
                let c = Int(w.commute[i])
                rows.append(("Commute", c == 255 ? "No route" : "\(c) min", c == 255 || c > 28 ? Theme.bad : c > 18 ? Theme.warn : Theme.good))
                rows.append(("Educated", "\(Int(Double(w.cov.edu[i]) / 2.55))%", .white))
                factors = Array(sim.happinessFactors(i).sorted { abs($0.value) > abs($1.value) }.prefix(5))
            } else {
                rows.append(("Road", w.roadDist[i] <= 3 ? "Near" : "Far", w.roadDist[i] <= 3 ? Theme.good : Theme.bad))
            }
            let mx = sim.maxLevel(i)
            if L < 3 && alive { rows.append(("Can reach", "L\(mx)", mx > L ? Theme.good : Theme.warn)) }
            if w.garbage[i] > 10 { rows.append(("Garbage", "\(w.garbage[i])", w.garbage[i] > 50 ? Theme.bad : Theme.warn)) }
            if L >= 1 && mx <= L && L < 3 {
                tip = "To grow denser: " + (w.water[i] == 0 ? "needs water." : k == .ind ? "needs educated workers and 1,500 residents." : w.lv[i] < 36 ? "needs land value 36+." : "needs land value 60, schooling and 1,200 residents.")
            }
        } else if k == .service {
            let r = Int(w.root[i]), idx = Int(w.svc[r]) - 1
            if idx >= 0 && idx < ServiceID.allCases.count {
                let id = ServiceID.allCases[idx], s = SERVICES[id]!
                title = s.name; subtitle = "\(district) · \(s.desc)"; color = Theme.accent
                symbol = Tool(rawValue: id.rawValue)?.symbol ?? "building.2.fill"
                let mul = s.dept.map { Double(w.budget[$0] ?? 100) / 100 } ?? 1
                rows.append(("Upkeep", "$\(Int(Double(s.upkeep) * mul))", .white))
                if s.power > 0 { rows.append(("Output", "\(s.power) MW", .white)) }
                if s.radius > 0 { rows.append(("Radius", "\(s.radius)", .white)) }
                if s.garbage > 0 { rows.append(("Capacity", "\(s.garbage) t", .white)) }
                if let d = s.dept { rows.append(("Funding", "\(w.budget[d] ?? 100)%", .white)) }
                let p = yes(w.power[r] != 0); rows.append(("Powered", p.0, p.1))
            }
        }
        if w.terrain[i] == 0 {
            rows.append(("Land value", "\(w.lv[i])", Theme.warn))
            rows.append(("Pollution", "\(w.pollution[i])", w.pollution[i] > 20 ? Theme.bad : .white))
            rows.append(("Crime", "\(w.crime[i])", w.crime[i] > 20 ? Theme.bad : .white))
        }
    }
}
