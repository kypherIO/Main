import SwiftUI
import MetalKit
import simd

/// Hosts the Metal renderer and translates UIKit gestures into game input.
struct MetalCityView: UIViewRepresentable {
    @Environment(GameModel.self) private var game

    func makeCoordinator() -> Coordinator { Coordinator(game: game) }

    func makeUIView(context: Context) -> MTKView {
        let device = MTLCreateSystemDefaultDevice()
        let v = MTKView(frame: .zero, device: device)
        if let device { game.attach(device: device) }
        context.coordinator.renderer = Renderer(view: v, game: game)
        v.delegate = context.coordinator.renderer
        v.isMultipleTouchEnabled = true
        context.coordinator.install(on: v)
        return v
    }

    func updateUIView(_ uiView: MTKView, context: Context) {}

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        let game: GameModel
        var renderer: Renderer?
        private var last: CGPoint = .zero
        private var dragging = false
        private var pan1: UIPanGestureRecognizer!
        private var pan2: UIPanGestureRecognizer!

        init(game: GameModel) { self.game = game }

        func install(on v: UIView) {
            let tap = UITapGestureRecognizer(target: self, action: #selector(onTap(_:)))
            pan1 = UIPanGestureRecognizer(target: self, action: #selector(onPan1(_:)))
            pan1.maximumNumberOfTouches = 1
            pan2 = UIPanGestureRecognizer(target: self, action: #selector(onPan2(_:)))
            pan2.minimumNumberOfTouches = 2
            let pinch = UIPinchGestureRecognizer(target: self, action: #selector(onPinch(_:)))
            let rot = UIRotationGestureRecognizer(target: self, action: #selector(onRotate(_:)))
            let hover = UIHoverGestureRecognizer(target: self, action: #selector(onHover(_:)))
            let scroll = UIPanGestureRecognizer(target: self, action: #selector(onScroll(_:)))
            scroll.allowedScrollTypesMask = [.continuous, .discrete]
            scroll.maximumNumberOfTouches = 0
            for g in [tap, pan1!, pan2!, pinch, rot, hover, scroll] as [UIGestureRecognizer] { g.delegate = self; v.addGestureRecognizer(g) }
            tap.require(toFail: pan1)
        }

        func gestureRecognizer(_ a: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith b: UIGestureRecognizer) -> Bool {
            !(a == pan1 || b == pan1)
        }

        @objc func onTap(_ g: UITapGestureRecognizer) {
            guard let v = g.view else { return }
            if !game.playing { game.rig.orbit = 0; return }
            game.tap(at: g.location(in: v), in: v.bounds.size)
        }

        @objc func onPan1(_ g: UIPanGestureRecognizer) {
            guard let v = g.view else { return }
            let p = g.location(in: v), size = v.bounds.size
            switch g.state {
            case .began:
                game.rig.vel = .zero
                dragging = game.playing && game.isDragTool
                if dragging { game.beginDrag(at: p, in: size) }
                last = p
            case .changed:
                if dragging { game.moveDrag(to: p, in: size) } else { game.panCamera(from: last, to: p, in: size) }
                last = p
            case .ended:
                if dragging { game.endDrag() }
                else {
                    let vel = g.velocity(in: v)
                    let ahead = CGPoint(x: p.x - vel.x * 0.016, y: p.y - vel.y * 0.016)
                    if let a = game.rig.ground(at: p, in: size), let b = game.rig.ground(at: ahead, in: size) {
                        game.fling(SIMD2((b.x - a.x) / 0.016, (b.z - a.z) / 0.016) * 0.5)
                    }
                }
                dragging = false
            case .cancelled, .failed:
                if dragging { game.cancelDrag() }
                dragging = false
            default: break
            }
        }

        @objc func onPan2(_ g: UIPanGestureRecognizer) {
            guard let v = g.view else { return }
            let p = g.location(in: v)
            if g.state == .began { last = p; game.cancelDrag() }
            if g.state == .changed { game.panCamera(from: last, to: p, in: v.bounds.size); last = p }
        }

        @objc func onPinch(_ g: UIPinchGestureRecognizer) {
            guard let v = g.view, g.state == .changed else { return }
            game.pinch(Float(g.scale), at: g.location(in: v), in: v.bounds.size)
            g.scale = 1
        }

        @objc func onRotate(_ g: UIRotationGestureRecognizer) {
            guard g.state == .changed else { return }
            game.rotate(Float(g.rotation))
            g.rotation = 0
        }

        @objc func onHover(_ g: UIHoverGestureRecognizer) {
            guard let v = g.view else { return }
            game.hover(at: g.state == .ended ? nil : g.location(in: v), in: v.bounds.size)
        }

        @objc func onScroll(_ g: UIPanGestureRecognizer) {
            guard let v = g.view, g.state == .changed else { return }
            let t = g.translation(in: v)
            game.rig.zoom(by: exp(Float(t.y) * 0.004), at: g.location(in: v), in: v.bounds.size)
            g.setTranslation(.zero, in: v)
        }
    }
}
