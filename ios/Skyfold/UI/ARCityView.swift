import SwiftUI
import RealityKit
import ARKit
import SkyfoldCore

/// ARKit + RealityKit: place a live diorama of your city on a real table.
struct ARCityScreen: View {
    @Environment(GameModel.self) private var game
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .topTrailing) {
            ARCityContainer(world: game.world).ignoresSafeArea()
            Button { dismiss() } label: { Image(systemName: "xmark").font(.headline).frame(width: 44, height: 44) }
                .glassPanel(22, interactive: true).padding(20)
            VStack {
                Spacer()
                Text("Point at a table to place \(game.world.name)").font(.footnote.weight(.semibold))
                    .padding(.horizontal, 14).padding(.vertical, 9).glassPanel(14).padding(.bottom, 30)
            }.frame(maxWidth: .infinity)
        }
    }
}

struct ARCityContainer: UIViewRepresentable {
    let world: World

    func makeUIView(context: Context) -> ARView {
        let view = ARView(frame: .zero)
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = [.horizontal]
        config.environmentTexturing = .automatic
        view.session.run(config)
        let coaching = ARCoachingOverlayView()
        coaching.session = view.session
        coaching.goal = .horizontalPlane
        coaching.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(coaching)
        let anchor = AnchorEntity(.plane(.horizontal, classification: .any, minimumBounds: [0.25, 0.25]))
        if let diorama = CityDiorama.make(world) { anchor.addChild(diorama) }
        view.scene.addAnchor(anchor)
        return view
    }

    func updateUIView(_ uiView: ARView, context: Context) {}

    static func dismantleUIView(_ uiView: ARView, coordinator: ()) { uiView.session.pause() }
}

/// Builds a 64 cm tabletop model: one merged mesh per material for speed.
enum CityDiorama {
    private struct Part { var pos: [SIMD3<Float>] = []; var nrm: [SIMD3<Float>] = []; var idx: [UInt32] = [] }

    private static func addBox(_ p: inout Part, _ c: SIMD3<Float>, _ s: SIMD3<Float>) {
        let h = s / 2
        let faces: [(SIMD3<Float>, SIMD3<Float>, SIMD3<Float>)] = [
            (SIMD3(0, 1, 0), SIMD3(1, 0, 0), SIMD3(0, 0, -1)), (SIMD3(0, 0, 1), SIMD3(1, 0, 0), SIMD3(0, 1, 0)),
            (SIMD3(0, 0, -1), SIMD3(-1, 0, 0), SIMD3(0, 1, 0)), (SIMD3(1, 0, 0), SIMD3(0, 0, -1), SIMD3(0, 1, 0)),
            (SIMD3(-1, 0, 0), SIMD3(0, 0, 1), SIMD3(0, 1, 0)),
        ]
        for (n, u, v) in faces {
            let base = UInt32(p.pos.count)
            let center = c + n * h
            let du = u * h, dv = v * h
            for (a, b) in [(-1, -1), (1, -1), (1, 1), (-1, 1)] as [(Float, Float)] {
                p.pos.append(center + du * a + dv * b); p.nrm.append(n)
            }
            p.idx += [base, base + 1, base + 2, base, base + 2, base + 3]
        }
    }

    static func make(_ w: World) -> Entity? {
        let scale: Float = 0.01
        var parts: [String: Part] = [:]
        let half = Float(MAP) / 2
        for i in 0..<N {
            let x = i % MAP, z = i / MAP
            let cx = (Float(x) - half + 0.5) * scale, cz = (Float(z) - half + 0.5) * scale
            if w.terrain[i] != 0 { addBox(&parts["water", default: Part()], SIMD3(cx, -0.002, cz), SIMD3(scale, 0.002, scale)); continue }
            addBox(&parts["ground", default: Part()], SIMD3(cx, -0.003, cz), SIMD3(scale, 0.006, scale))
            let L = Float(w.level[i])
            switch Kind(rawValue: w.kind[i]) ?? .empty {
            case .road: addBox(&parts["road", default: Part()], SIMD3(cx, 0.0005, cz), SIMD3(scale, 0.001, scale))
            case .res where L > 0: addBox(&parts["res", default: Part()], SIMD3(cx, L * L * 0.004 / 2, cz), SIMD3(scale * 0.7, L * L * 0.004, scale * 0.7))
            case .com where L > 0: addBox(&parts["com", default: Part()], SIMD3(cx, L * L * 0.005 / 2, cz), SIMD3(scale * 0.75, L * L * 0.005, scale * 0.75))
            case .ind where L > 0: addBox(&parts["ind", default: Part()], SIMD3(cx, L * 0.003 / 2, cz), SIMD3(scale * 0.85, L * 0.003, scale * 0.85))
            case .service where Int(w.root[i]) == i: addBox(&parts["svc", default: Part()], SIMD3(cx, 0.004, cz), SIMD3(scale * 0.8, 0.008, scale * 0.8))
            default: if w.tree[i] != 0 { addBox(&parts["tree", default: Part()], SIMD3(cx, 0.003, cz), SIMD3(scale * 0.4, 0.006, scale * 0.4)) }
            }
        }
        let colors: [String: UIColor] = [
            "water": UIColor(red: 0.1, green: 0.45, blue: 0.58, alpha: 1), "ground": UIColor(red: 0.37, green: 0.6, blue: 0.26, alpha: 1),
            "road": UIColor(white: 0.25, alpha: 1), "res": UIColor(red: 0.95, green: 0.92, blue: 0.85, alpha: 1),
            "com": UIColor(red: 0.55, green: 0.72, blue: 0.95, alpha: 1), "ind": UIColor(red: 0.85, green: 0.8, blue: 0.68, alpha: 1),
            "svc": UIColor(white: 0.95, alpha: 1), "tree": UIColor(red: 0.2, green: 0.45, blue: 0.22, alpha: 1),
        ]
        let root = Entity()
        for (key, p) in parts where !p.idx.isEmpty {
            var d = MeshDescriptor(name: key)
            d.positions = MeshBuffers.Positions(p.pos)
            d.normals = MeshBuffers.Normals(p.nrm)
            d.primitives = .triangles(p.idx)
            guard let mesh = try? MeshResource.generate(from: [d]) else { continue }
            let mat = SimpleMaterial(color: colors[key] ?? .white, roughness: key == "water" ? 0.1 : 0.8, isMetallic: false)
            root.addChild(ModelEntity(mesh: mesh, materials: [mat]))
        }
        return root
    }
}
