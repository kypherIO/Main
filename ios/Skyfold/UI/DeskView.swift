import SwiftUI
import Charts
import ImagePlayground
import SkyfoldCore

/// The Mayor's Desk: docked beside/below the city when unfolded, a sheet when folded.
struct DeskView: View {
    @Environment(GameModel.self) private var game
    @State private var tab = "Overview"
    private let tabs = ["Overview", "Budget", "Policy", "Goals", "Feed", "Map"]

    var body: some View {
        let _ = game.hudTick
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                CityEmblem(size: 34)
                Text(game.world.name).font(.title3.weight(.bold)).lineLimit(1)
                Text(game.sim.milestone().name.uppercased()).font(.caption2.weight(.heavy)).tracking(0.8)
                    .padding(.horizontal, 8).padding(.vertical, 4).background(Theme.gradient, in: .rect(cornerRadius: 8))
                Spacer()
                Text(game.world.dateString()).font(.footnote).foregroundStyle(Theme.muted).monospacedDigit()
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    ForEach(tabs, id: \.self) { t in
                        Button { tab = t; game.haptics.play(.tick) } label: {
                            Text(t).font(.footnote.weight(.semibold)).padding(.horizontal, 12).padding(.vertical, 8)
                                .foregroundStyle(tab == t ? .white : Theme.muted)
                                .background(tab == t ? .white.opacity(0.12) : .clear, in: .rect(cornerRadius: 10))
                                .overlay(alignment: .topTrailing) {
                                    if t == "Goals" && game.world.petitions.offer != nil { Circle().fill(Theme.bad).frame(width: 7, height: 7).offset(x: -4, y: 4) }
                                }
                        }.buttonStyle(.plain)
                    }
                }.padding(4)
            }
            .background(.black.opacity(0.25), in: .rect(cornerRadius: 13))
            ScrollView {
                Group {
                    switch tab {
                    case "Budget": BudgetPane()
                    case "Policy": PolicyPane()
                    case "Goals": GoalsPane()
                    case "Feed": FeedPane()
                    case "Map": MapPane()
                    default: OverviewPane()
                    }
                }.padding(.bottom, 12)
            }
        }
        .padding(12)
        .background(LinearGradient(colors: [Color(red: 0.06, green: 0.09, blue: 0.19), Color(red: 0.04, green: 0.07, blue: 0.14)], startPoint: .top, endPoint: .bottom))
    }
}

struct Panel<Content: View>: View {
    let title: String
    var trailing: String? = nil
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title.uppercased()).font(.system(size: 11, weight: .bold)).tracking(0.9).foregroundStyle(Theme.muted)
                Spacer()
                if let trailing { Text(trailing).font(.caption).foregroundStyle(Theme.muted) }
            }
            content
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.05), in: .rect(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.08)))
    }
}

struct KPI: View {
    let label: String; let value: String; var color: Color = .white
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.caption2).foregroundStyle(Theme.muted)
            Text(value).font(.headline).foregroundStyle(color).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Overview
struct OverviewPane: View {
    @Environment(GameModel.self) private var game
    var body: some View {
        let s = game.sim.stats, w = game.world, d = game.sim.demand
        let net = s.income - s.expense, ap = Int(w.approval)
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 10)], spacing: 10) {
            Panel(title: "City", trailing: ap >= 75 ? "Beloved mayor" : ap >= 55 ? "Solid support" : ap >= 35 ? "Grumbling" : "Recall rumours") {
                Grid(alignment: .leading, horizontalSpacing: 8, verticalSpacing: 10) {
                    GridRow { KPI(label: "Population", value: s.pop.formatted()); KPI(label: "Happiness", value: "\(s.happiness)%"); KPI(label: "Approval", value: "\(ap)%", color: ap < 35 ? Theme.bad : ap < 55 ? Theme.warn : .white) }
                    GridRow { KPI(label: "Jobs", value: s.jobs.formatted()); KPI(label: "Unemployed", value: "\(Int(s.unemployment * 100))%", color: s.unemployment > 0.12 ? Theme.bad : s.unemployment > 0.06 ? Theme.warn : .white); KPI(label: "Educated", value: "\(s.education)%") }
                    GridRow { KPI(label: "Treasury", value: money(w.funds)); KPI(label: "Net / mo", value: (net >= 0 ? "+" : "−") + "$" + short(abs(net)), color: net >= 0 ? Theme.good : Theme.bad); KPI(label: "Power MW", value: "\(s.powerDemand)/\(s.powerSupply)", color: s.powerDemand > s.powerSupply ? Theme.bad : .white) }
                    GridRow { KPI(label: "Commute", value: "\(s.avgCommute)m", color: s.avgCommute > 30 ? Theme.bad : s.avgCommute > 20 ? Theme.warn : .white); KPI(label: "Congestion", value: "\(s.congestion)%", color: s.congestion > 100 ? Theme.bad : s.congestion > 70 ? Theme.warn : .white); KPI(label: "Health", value: "\(s.health)%", color: s.health < 35 ? Theme.bad : s.health < 50 ? Theme.warn : .white) }
                }
            }
            Panel(title: "Demand") {
                demandRow("Residential", d.r, Theme.res); demandRow("Commercial", d.c, Theme.com); demandRow("Industrial", d.i, Theme.ind)
                Divider().opacity(0.2)
                Text("Low-skill: \(s.lowWorkers.formatted()) workers · \(s.lowJobs.formatted()) jobs").font(.caption)
                Text("Skilled: \(s.highWorkers.formatted()) workers · \(s.highJobs.formatted()) jobs\(s.highVac > 0.3 ? " — short of grads" : "")").font(.caption).foregroundStyle(s.highVac > 0.3 ? Theme.warn : .white)
                if s.unreachable > 0 { Text("\(s.unreachable.formatted()) can’t reach any job").font(.caption).foregroundStyle(Theme.bad) }
            }
            Panel(title: "What citizens feel") {
                if s.factors.isEmpty { Text("Appears once people move in.").font(.caption).foregroundStyle(Theme.muted) }
                ForEach(Array(s.factors.prefix(7)), id: \.label) { f in FactorRow(label: f.label, value: f.value) }
            }
            Panel(title: "Population") {
                Chart(Array(w.history.enumerated()), id: \.offset) { e in
                    AreaMark(x: .value("Month", e.offset), y: .value("Pop", e.element.pop)).foregroundStyle(Theme.accent.opacity(0.25))
                    LineMark(x: .value("Month", e.offset), y: .value("Pop", e.element.pop)).foregroundStyle(Theme.accent)
                }
                .chartXAxis(.hidden).frame(height: 110)
            }
            Panel(title: "Next milestone", trailing: game.sim.nextMilestone()?.name ?? "Max") {
                if let nm = game.sim.nextMilestone() {
                    let cur = game.sim.milestone()
                    Text("Reach \(nm.pop.formatted()) residents.").font(.caption).foregroundStyle(Theme.muted)
                    ProgressView(value: min(1, max(0, Double(w.peakPop - cur.pop) / Double(max(1, nm.pop - cur.pop))))).tint(Theme.accent)
                } else { Text("Your city has reached legendary status.").font(.caption) }
            }
        }
    }
    private func demandRow(_ label: String, _ v: Double, _ c: Color) -> some View {
        HStack {
            Text(label).font(.footnote).frame(width: 92, alignment: .leading)
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.08))
                    Capsule().fill(c).frame(width: CGFloat(abs(v)) * g.size.width / 2)
                        .offset(x: v >= 0 ? g.size.width / 2 : g.size.width / 2 - CGFloat(abs(v)) * g.size.width / 2)
                    Rectangle().fill(.white.opacity(0.3)).frame(width: 1).offset(x: g.size.width / 2)
                }
            }.frame(height: 10)
            Text("\(v > 0 ? "+" : "")\(Int(v * 100))").font(.caption.weight(.semibold)).frame(width: 34, alignment: .trailing).monospacedDigit()
        }
    }
}

// MARK: - Budget
struct BudgetPane: View {
    @Environment(GameModel.self) private var game
    var body: some View {
        let s = game.sim.stats, w = game.world
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 10)], spacing: 10) {
            Panel(title: "Tax rates") {
                taxRow("Residential", \.r); taxRow("Commercial", \.c); taxRow("Industrial", \.i)
                Text("Higher taxes slow growth and hurt happiness. Wealthier residents pay more.").font(.caption).foregroundStyle(Theme.muted)
            }
            Panel(title: "Department funding") {
                ForEach(Dept.allCases, id: \.self) { d in
                    HStack {
                        Text(d.displayName).font(.footnote).frame(width: 84, alignment: .leading)
                        Slider(value: Binding(get: { Double(w.budget[d] ?? 100) }, set: { w.budget[d] = Int($0); game.sim.fieldsDirty = true; game.hudTick &+= 1 }), in: 50...150, step: 10)
                        Text("\(w.budget[d] ?? 100)%").font(.caption.weight(.semibold)).frame(width: 40).monospacedDigit()
                    }
                }
                Text("Funding scales coverage radius, effectiveness and upkeep.").font(.caption).foregroundStyle(Theme.muted)
            }
            Panel(title: "Last month") {
                let b = s.breakdown ?? Breakdown()
                ledger("Residential tax", b.incR); ledger("Commercial tax", b.incC); ledger("Industrial tax", b.incI)
                ledger("Transit fares", b.fares); ledger("Tourism", b.tourism); ledger("Road upkeep", -b.roads)
                ledger("Services", -Int(b.svc.values.reduce(0, +))); ledger("Policies", -b.policies); ledger("Loan payments", -b.loans)
                Divider().opacity(0.2)
                ledger("Net", s.income - s.expense, bold: true)
            }
            Panel(title: "Loans", trailing: "5.5% APR · 10 years") {
                if w.loans.isEmpty { Text("No outstanding debt.").font(.caption).foregroundStyle(Theme.muted) }
                ForEach(Array(w.loans.enumerated()), id: \.offset) { k, L in
                    HStack {
                        Text("$\(L.amount.formatted()) · \(L.left) mo left").font(.footnote)
                        Spacer()
                        Text("$\(L.payment.formatted())/mo").font(.footnote).monospacedDigit()
                        Button("Repay") { let r = game.sim.repayLoan(k); game.toast(r.ok ? "Loan repaid" : (r.msg ?? "Can't repay"), r.ok ? .info : .bad); game.hudTick &+= 1 }.controlSize(.mini).buttonStyle(.bordered)
                    }
                }
                HStack {
                    ForEach([25_000, 75_000], id: \.self) { amt in
                        Button("Borrow $\(amt / 1000)k") {
                            let r = game.sim.takeLoan(amt)
                            if r.ok { game.audio.play(.cash); game.toast("Loan approved · $\(r.cost.formatted())/mo") } else { game.toast(r.msg ?? "Denied", .bad) }
                            game.hudTick &+= 1
                        }.buttonStyle(.bordered).controlSize(.small)
                    }
                }
            }
            Panel(title: "Treasury") {
                Chart(Array(w.history.enumerated()), id: \.offset) { e in
                    LineMark(x: .value("Month", e.offset), y: .value("Funds", e.element.funds)).foregroundStyle(Theme.good)
                }.chartXAxis(.hidden).frame(height: 110)
            }
        }
    }
    private func taxRow(_ label: String, _ key: WritableKeyPath<Taxes, Int>) -> some View {
        let w = game.world
        return HStack {
            Text(label).font(.footnote).frame(width: 84, alignment: .leading)
            Slider(value: Binding(get: { Double(w.tax[keyPath: key]) }, set: { w.tax[keyPath: key] = Int($0); game.sim.computeDemand(); game.hudTick &+= 1 }), in: 0...20, step: 1)
            Text("\(w.tax[keyPath: key])%").font(.caption.weight(.semibold)).frame(width: 34).monospacedDigit()
        }
    }
    private func ledger(_ label: String, _ v: Int, bold: Bool = false) -> some View {
        HStack {
            Text(label).font(bold ? .footnote.weight(.bold) : .footnote)
            Spacer()
            Text(money(Double(v))).font(bold ? .footnote.weight(.bold) : .footnote).foregroundStyle(v < 0 ? Theme.bad : Theme.good).monospacedDigit()
        }
    }
}

// MARK: - Policy
struct PolicyPane: View {
    @Environment(GameModel.self) private var game
    var body: some View {
        let pop = game.sim.stats.pop
        VStack(spacing: 8) {
            Text("Ordinances shape your city. Costs are monthly and scale with population.").font(.caption).foregroundStyle(Theme.muted).frame(maxWidth: .infinity, alignment: .leading)
            ForEach(PolicyID.allCases, id: \.self) { p in
                let def = p.def, on = game.world.policies.contains(p)
                let cost = Int(def.flat + def.perCap * Double(pop))
                Toggle(isOn: Binding(get: { on }, set: { v in game.sim.setPolicy(p, on: v); game.haptics.play(.select); game.toast("\(def.name) \(v ? "enacted" : "repealed")"); game.hudTick &+= 1 })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(def.name).font(.subheadline.weight(.semibold))
                        Text(def.desc).font(.caption).foregroundStyle(Theme.muted)
                        Text(cost > 0 ? "$\(cost.formatted())/mo" : "Free").font(.caption2).foregroundStyle(Theme.muted)
                    }
                }
                .tint(Theme.accent)
                .padding(12)
                .background(on ? Theme.accent.opacity(0.1) : .white.opacity(0.05), in: .rect(cornerRadius: 14))
            }
        }
    }
}

// MARK: - Goals
struct GoalsPane: View {
    @Environment(GameModel.self) private var game
    var body: some View {
        let w = game.world
        VStack(spacing: 10) {
            Panel(title: "Petitions", trailing: "\(w.petitions.active.count)/3") {
                if let p = w.petitions.offer {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("New: \(p.goal)").font(.subheadline.weight(.semibold))
                        Text(p.text).font(.caption).foregroundStyle(.white.opacity(0.8))
                        HStack {
                            Button("Accept") { game.sim.events.accept(); game.petitionOffer = nil; game.hudTick &+= 1 }.buttonStyle(.borderedProminent).tint(Theme.accent)
                            Button("Decline") { game.sim.events.decline(); game.petitionOffer = nil; game.hudTick &+= 1 }.buttonStyle(.bordered)
                        }.controlSize(.small)
                    }.padding(10).background(Theme.warn.opacity(0.1), in: .rect(cornerRadius: 12))
                }
                if w.petitions.active.isEmpty && w.petitions.offer == nil { Text("Citizens will bring requests as the city grows.").font(.caption).foregroundStyle(Theme.muted) }
                ForEach(w.petitions.active) { p in
                    let left = max(0, ((p.deadline ?? w.day) - w.day + 29) / 30)
                    VStack(alignment: .leading, spacing: 4) {
                        HStack { Text(p.goal).font(.subheadline.weight(.semibold)); Spacer(); Text(p.district).font(.caption2).foregroundStyle(Theme.muted) }
                        Text(game.sim.events.progress(p)).font(.caption).foregroundStyle(Theme.accent).monospacedDigit()
                        HStack {
                            Text("\(left) mo left").font(.caption2).foregroundStyle(left <= 1 ? Theme.bad : Theme.muted)
                            Text("+\(Int(p.rewardApproval)) approval\(p.rewardCash > 0 ? " · $\(p.rewardCash.formatted())" : "")").font(.caption2).foregroundStyle(Theme.muted)
                            Spacer()
                            Button("Show") { game.focus(tile: w.idx(p.x, p.z)) }.controlSize(.mini).buttonStyle(.bordered)
                        }
                    }.padding(10).background(.white.opacity(0.05), in: .rect(cornerRadius: 12))
                }
            }
            Panel(title: "Achievements", trailing: "\(w.achievements.count)/\(Events.ACHIEVEMENTS.count)") {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 6)], spacing: 6) {
                    ForEach(Events.ACHIEVEMENTS, id: \.id) { a in
                        let got = w.achievements.contains(a.id)
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "trophy.fill").foregroundStyle(got ? Theme.warn : Theme.muted)
                            VStack(alignment: .leading, spacing: 1) { Text(a.name).font(.caption.weight(.semibold)); Text(a.desc).font(.caption2).foregroundStyle(Theme.muted) }
                        }
                        .padding(8).frame(maxWidth: .infinity, alignment: .leading)
                        .background(got ? Theme.warn.opacity(0.1) : .white.opacity(0.03), in: .rect(cornerRadius: 10))
                        .opacity(got ? 1 : 0.5)
                    }
                }
                Button { game.gameCenter.showDashboard() } label: { Label("Game Center", systemImage: "gamecontroller.fill") }.buttonStyle(.bordered).controlSize(.small)
            }
        }
    }
}

// MARK: - Feed
struct FeedPane: View {
    @Environment(GameModel.self) private var game
    @State private var summary = "Ask your chief advisor for a read on the city."
    @State private var priorities: [String] = []
    @State private var thinking = false
    @State private var aiUsed = false

    var body: some View {
        VStack(spacing: 10) {
            Panel(title: "Advisor briefing", trailing: game.intelligence.isAvailable ? "✦ Apple Intelligence" : "Procedural") {
                Text(summary).font(.footnote).opacity(thinking && summary.isEmpty ? 0.5 : 1)
                ForEach(Array(priorities.enumerated()), id: \.offset) { k, p in Text("\(k + 1). \(p)").font(.caption).foregroundStyle(.white.opacity(0.8)) }
                if aiUsed { Text("✦ Generated on-device with tool calling").font(.caption2).foregroundStyle(Theme.accent2) }
                Button { Task { await ask() } } label: { Label(thinking ? "Thinking…" : "Ask advisor", systemImage: "sparkles") }
                    .buttonStyle(.borderedProminent).tint(Theme.accent2).controlSize(.small).disabled(thinking)
            }
            ForEach(Array(game.sim.advice.prefix(5).enumerated()), id: \.offset) { _, a in
                HStack(alignment: .top, spacing: 10) {
                    RoundedRectangle(cornerRadius: 3).fill(a.lvl == "bad" ? Theme.bad : a.lvl == "warn" ? Theme.warn : a.lvl == "good" ? Theme.good : Theme.accent).frame(width: 5)
                    VStack(alignment: .leading, spacing: 2) { Text(a.who.uppercased()).font(.caption2.weight(.bold)).foregroundStyle(Theme.muted); Text(a.text).font(.footnote) }
                }.padding(10).frame(maxWidth: .infinity, alignment: .leading).background(.white.opacity(0.05), in: .rect(cornerRadius: 12))
            }
            Panel(title: "City feed") {
                if game.world.news.isEmpty { Text("News arrives monthly.").font(.caption).foregroundStyle(Theme.muted) }
                ForEach(game.world.news.reversed().prefix(30)) { n in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack { Text(n.kind == "chirp" ? (n.who ?? "") : (n.title ?? "")).font(.footnote.weight(.semibold)); Spacer(); Text(n.date).font(.caption2).foregroundStyle(Theme.muted) }
                        Text(n.body).font(.caption).foregroundStyle(.white.opacity(0.8))
                        if n.ai { Text("✦").font(.caption2).foregroundStyle(Theme.accent2) }
                    }
                    .padding(9).frame(maxWidth: .infinity, alignment: .leading)
                    .background(.white.opacity(0.04), in: .rect(cornerRadius: 10))
                    .overlay(alignment: .leading) { Rectangle().fill(n.kind == "chirp" ? Theme.accent2 : n.kind == "petition" ? Theme.warn : Theme.accent).frame(width: 3) }
                }
            }
        }
    }

    private func ask() async {
        thinking = true; summary = ""; priorities = []; aiUsed = false
        game.audio.play(.select)
        let ok = await game.intelligence.brief(CitySnapshot(sim: game.sim)) { s, p in summary = s; priorities = p }
        if ok { aiUsed = true } else {
            let s = game.sim.stats, net = s.income - s.expense
            summary = "\(game.world.name) has \(s.pop.formatted()) residents at \(s.happiness)% happiness. The treasury is \(net >= 0 ? "running a $\(net.formatted()) surplus" : "losing $\((-net).formatted())") a month, unemployment is \(Int(s.unemployment * 100))% and the average commute is \(s.avgCommute) minutes."
            priorities = game.sim.advice.prefix(3).map { $0.text }
        }
        thinking = false
    }
}

// MARK: - Map
struct MapPane: View {
    @Environment(GameModel.self) private var game
    @State private var designFlag = false
    @Environment(\.supportsImagePlayground) private var supportsImagePlayground

    var body: some View {
        @Bindable var game = game
        VStack(spacing: 10) {
            Minimap().aspectRatio(1, contentMode: .fit).frame(maxWidth: 420)
            Panel(title: "Layer") {
                Picker("Layer", selection: $game.overlay) { ForEach(Overlay.allCases, id: \.self) { Text($0.label).tag($0) } }.pickerStyle(.menu)
            }
            Panel(title: "Camera & time") {
                HStack {
                    Button { game.cameraAction("rotl") } label: { Image(systemName: "rotate.left") }
                    Button { game.cameraAction("rotr") } label: { Image(systemName: "rotate.right") }
                    Button("Recenter") { game.cameraAction("home") }
                    Button("Overview") { game.cameraAction("top") }
                }.buttonStyle(.bordered).controlSize(.small)
                Picker("Time", selection: $game.timeMode) { ForEach(TimeMode.allCases) { Text($0.rawValue.capitalized).tag($0) } }.pickerStyle(.segmented)
            }
            Panel(title: "City identity") {
                HStack(spacing: 12) {
                    CityEmblem(size: 64)
                    VStack(alignment: .leading, spacing: 6) {
                        Button { Task { await game.refreshEmblem() } } label: { Label("Generate flag", systemImage: "wand.and.stars") }
                        if supportsImagePlayground {
                            Button { designFlag = true } label: { Label("Design in Image Playground", systemImage: "paintpalette") }
                        }
                    }.buttonStyle(.bordered).controlSize(.small)
                }
            }
            Panel(title: "Experiences") {
                HStack {
                    Button { game.showAR = true } label: { Label("View in AR", systemImage: "arkit") }
                    Button { game.cloudSave() } label: { Label("iCloud save", systemImage: "icloud.and.arrow.up") }
                }.buttonStyle(.bordered).controlSize(.small)
            }
        }
        .imagePlaygroundSheet(isPresented: $designFlag, concept: "City flag for \(game.world.name), a seaside island city") { url in
            game.emblem = game.emblems.load(url: url)
        }
    }
}

struct Minimap: View {
    @Environment(GameModel.self) private var game
    var body: some View {
        let _ = game.hudTick
        let w = game.world
        Canvas { ctx, size in
            let s = size.width / CGFloat(MAP)
            for i in 0..<N {
                let x = i % MAP, z = i / MAP
                ctx.fill(Path(CGRect(x: CGFloat(x) * s, y: CGFloat(z) * s, width: s + 0.5, height: s + 0.5)), with: .color(color(w, i)))
            }
            let r = game.rig, cx = CGFloat(r.target.x + Float(MAP) / 2) * s, cz = CGFloat(r.target.z + Float(MAP) / 2) * s, rr = CGFloat(r.dist * 0.45) * s
            var c = ctx
            c.translateBy(x: cx, y: cz); c.rotate(by: .radians(Double(-r.yaw)))
            c.stroke(Path(CGRect(x: -rr, y: -rr * 0.7, width: rr * 2, height: rr * 1.4)), with: .color(.white), lineWidth: 2)
        }
        .clipShape(.rect(cornerRadius: 14))
        .overlay(GeometryReader { g in
            Color.clear.contentShape(Rectangle()).gesture(DragGesture(minimumDistance: 0).onChanged { v in
                let x = Float(v.location.x / g.size.width) * Float(MAP) - Float(MAP) / 2, z = Float(v.location.y / g.size.height) * Float(MAP) - Float(MAP) / 2
                game.rig.flyTo(x, z)
            })
        })
    }
    private func color(_ w: World, _ i: Int) -> Color {
        if w.terrain[i] != 0 { return Color(red: 0.12, green: 0.38, blue: 0.47) }
        let f = TileFlags(rawValue: w.flags[i])
        if f.contains(.rubble) { return Color(white: 0.22) }
        if f.contains(.burning) { return .orange }
        let L = Double(w.level[i])
        switch Kind(rawValue: w.kind[i]) ?? .empty {
        case .road: return Color(white: 0.29)
        case .res: return L > 0 ? Color(red: 0.37 - L * 0.04, green: 0.82 - L * 0.08, blue: 0.41 - L * 0.04) : Color(red: 0.59, green: 0.82, blue: 0.59)
        case .com: return L > 0 ? Color(red: 0.29 - L * 0.03, green: 0.66 - L * 0.06, blue: 1 - L * 0.08) : Color(red: 0.59, green: 0.75, blue: 0.94)
        case .ind: return L > 0 ? Color(red: 1 - L * 0.06, green: 0.77 - L * 0.08, blue: 0.28) : Color(red: 0.94, green: 0.86, blue: 0.59)
        case .service: return Color(white: 0.92)
        case .empty: return w.tree[i] != 0 ? Color(red: 0.24, green: 0.47, blue: 0.24) : Color(red: 0.41, green: 0.63, blue: 0.3)
        }
    }
}

/// City flag: Image Playground result when available, otherwise a procedural crest.
struct CityEmblem: View {
    @Environment(GameModel.self) private var game
    let size: CGFloat
    var body: some View {
        Group {
            if let img = game.emblem {
                Image(decorative: img, scale: 1).resizable().scaledToFill()
            } else {
                let h = Double(game.world.seed % 360) / 360
                ZStack {
                    LinearGradient(colors: [Color(hue: h, saturation: 0.6, brightness: 0.8), Color(hue: (h + 0.15).truncatingRemainder(dividingBy: 1), saturation: 0.7, brightness: 0.5)], startPoint: .top, endPoint: .bottom)
                    Image(systemName: "building.2.crop.circle.fill").font(.system(size: size * 0.5)).foregroundStyle(.white.opacity(0.9))
                }
            }
        }
        .frame(width: size, height: size).clipShape(.rect(cornerRadius: size * 0.24))
    }
}
