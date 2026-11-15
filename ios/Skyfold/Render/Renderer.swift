import MetalKit
#if canImport(MetalFX)
import MetalFX
#endif
import MetalPerformanceShaders
import simd
import SkyfoldCore

enum Quality: String, CaseIterable, Codable, Identifiable {
    case battery, balanced, ultra
    var id: String { rawValue }
    var label: String { ["battery": "Battery", "balanced": "Balanced", "ultra": "Ultra"][rawValue]! }
    /// Fraction of native resolution rendered; MetalFX upscales the rest.
    var renderScale: Float { switch self { case .battery: 0.5; case .balanced: 0.67; case .ultra: 1.0 } }
    var shadowSize: Int { switch self { case .battery: 1024; case .balanced: 2048; case .ultra: 4096 } }
    var bloom: Bool { self != .battery }
    var tiltShift: Bool { self == .ultra }
}

/// Metal renderer: shadow pass → MSAA HDR scene → bloom (MPS) → ACES composite
/// → MetalFX spatial upscale to the native 1878 × 2670 panel at up to 120 Hz.
final class Renderer: NSObject, MTKViewDelegate {
    let device: MTLDevice
    private let queue: MTLCommandQueue
    private weak var game: GameModel?

    private var opaquePSO: MTLRenderPipelineState!
    private var transparentPSO: MTLRenderPipelineState!
    private var shadowPSO: MTLRenderPipelineState!
    private var skyPSO: MTLRenderPipelineState!
    private var particlePSO: MTLRenderPipelineState!
    private var brightPSO: MTLRenderPipelineState!
    private var compositePSO: MTLRenderPipelineState!
    private var depthWrite: MTLDepthStencilState!
    private var depthRead: MTLDepthStencilState!
    private var depthAlways: MTLDepthStencilState!

    private let sampleCount = 4
    private let inflight = DispatchSemaphore(value: 3)
    private var instanceBuffers: [MTLBuffer?] = [nil, nil, nil]
    private var particleBuffers: [MTLBuffer?] = [nil, nil, nil]
    private var frame = 0

    private var msaaColor: MTLTexture?, msaaDepth: MTLTexture?, hdr: MTLTexture?
    private var bloomA: MTLTexture?, bloomB: MTLTexture?, ldr: MTLTexture?, upscaled: MTLTexture?
    private var shadowMap: MTLTexture?
    private var black: MTLTexture!
    private(set) var overlayTexture: MTLTexture!
    #if canImport(MetalFX)
    private var scaler: (any MTLFXSpatialScaler)?
    #else
    private var scaler: AnyObject?
    #endif
    private var blur: MPSImageGaussianBlur?
    private var renderSize = SIMD2<Int>(1, 1), drawableSize = SIMD2<Int>(1, 1)
    private var builtFor: (Quality, SIMD2<Int>)?
    private var lastTime = CACurrentMediaTime()
    private(set) var frameTime: Double = 1.0 / 60

    init?(view: MTKView, game: GameModel) {
        guard let device = view.device ?? MTLCreateSystemDefaultDevice(), let queue = device.makeCommandQueue() else { return nil }
        self.device = device
        self.queue = queue
        self.game = game
        super.init()
        view.device = device
        view.colorPixelFormat = .bgra8Unorm_srgb
        view.depthStencilPixelFormat = .invalid
        view.framebufferOnly = false
        view.preferredFramesPerSecond = 120
        view.autoResizeDrawable = true
        view.isPaused = false
        view.enableSetNeedsDisplay = false
        do { try buildPipelines(colorFormat: view.colorPixelFormat) } catch { print("Pipeline error: \(error)"); return nil }
        black = makeTexture(.rgba16Float, 1, 1, [.shaderRead], storage: .shared)
        overlayTexture = makeTexture(.rgba8Unorm, MAP, MAP, [.shaderRead], storage: .shared)
        if MPSSupportsMTLDevice(device) { blur = MPSImageGaussianBlur(device: device, sigma: 6) }
    }

    // MARK: setup
    private func buildPipelines(colorFormat: MTLPixelFormat) throws {
        guard let lib = device.makeDefaultLibrary() else { throw NSError(domain: "Skyfold", code: 1) }
        func pso(_ v: String, _ f: String?, color: MTLPixelFormat?, depth: MTLPixelFormat?, samples: Int, blend: Bool) throws -> MTLRenderPipelineState {
            let d = MTLRenderPipelineDescriptor()
            d.vertexFunction = lib.makeFunction(name: v)
            d.fragmentFunction = f.flatMap { lib.makeFunction(name: $0) }
            if let color {
                d.colorAttachments[0].pixelFormat = color
                if blend {
                    let a = d.colorAttachments[0]!
                    a.isBlendingEnabled = true
                    a.rgbBlendOperation = .add; a.alphaBlendOperation = .add
                    a.sourceRGBBlendFactor = .one; a.destinationRGBBlendFactor = .oneMinusSourceAlpha
                    a.sourceAlphaBlendFactor = .one; a.destinationAlphaBlendFactor = .oneMinusSourceAlpha
                }
            }
            if let depth { d.depthAttachmentPixelFormat = depth }
            d.rasterSampleCount = samples
            return try device.makeRenderPipelineState(descriptor: d)
        }
        opaquePSO = try pso("meshVertex", "meshFragment", color: .rgba16Float, depth: .depth32Float, samples: sampleCount, blend: false)
        transparentPSO = try pso("meshVertex", "transparentFragment", color: .rgba16Float, depth: .depth32Float, samples: sampleCount, blend: true)
        skyPSO = try pso("fullscreenVertex", "skyFragment", color: .rgba16Float, depth: .depth32Float, samples: sampleCount, blend: false)
        particlePSO = try pso("particleVertex", "particleFragment", color: .rgba16Float, depth: .depth32Float, samples: sampleCount, blend: true)
        shadowPSO = try pso("shadowVertex", nil, color: nil, depth: .depth32Float, samples: 1, blend: false)
        brightPSO = try pso("fullscreenVertex", "brightPassFragment", color: .rgba16Float, depth: nil, samples: 1, blend: false)
        compositePSO = try pso("fullscreenVertex", "compositeFragment", color: colorFormat, depth: nil, samples: 1, blend: false)

        let ds = MTLDepthStencilDescriptor()
        ds.depthCompareFunction = .less; ds.isDepthWriteEnabled = true
        depthWrite = device.makeDepthStencilState(descriptor: ds)
        ds.depthCompareFunction = .lessEqual; ds.isDepthWriteEnabled = false
        depthRead = device.makeDepthStencilState(descriptor: ds)
        ds.depthCompareFunction = .always; ds.isDepthWriteEnabled = false
        depthAlways = device.makeDepthStencilState(descriptor: ds)
    }

    private func makeTexture(_ fmt: MTLPixelFormat, _ w: Int, _ h: Int, _ usage: MTLTextureUsage, samples: Int = 1, storage: MTLStorageMode = .private) -> MTLTexture {
        let d = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: fmt, width: max(1, w), height: max(1, h), mipmapped: false)
        d.usage = usage
        d.storageMode = storage
        if samples > 1 { d.textureType = .type2DMultisample; d.sampleCount = samples }
        return device.makeTexture(descriptor: d)!
    }

    private func rebuildTargets(quality: Quality, drawable: SIMD2<Int>) {
        drawableSize = drawable
        let s = quality.renderScale
        renderSize = SIMD2(max(1, Int(Float(drawable.x) * s)), max(1, Int(Float(drawable.y) * s)))
        let w = renderSize.x, h = renderSize.y
        msaaColor = makeTexture(.rgba16Float, w, h, [.renderTarget], samples: sampleCount)
        msaaDepth = makeTexture(.depth32Float, w, h, [.renderTarget], samples: sampleCount)
        hdr = makeTexture(.rgba16Float, w, h, [.renderTarget, .shaderRead])
        bloomA = makeTexture(.rgba16Float, w / 2, h / 2, [.renderTarget, .shaderRead, .shaderWrite])
        bloomB = makeTexture(.rgba16Float, w / 2, h / 2, [.renderTarget, .shaderRead, .shaderWrite])
        shadowMap = makeTexture(.depth32Float, quality.shadowSize, quality.shadowSize, [.renderTarget, .shaderRead])
        scaler = nil; ldr = nil; upscaled = nil
#if canImport(MetalFX)
        if s < 0.99 && MTLFXSpatialScalerDescriptor.supportsDevice(device) {
            let d = MTLFXSpatialScalerDescriptor()
            d.inputWidth = w; d.inputHeight = h
            d.outputWidth = drawable.x; d.outputHeight = drawable.y
            d.colorTextureFormat = .bgra8Unorm_srgb
            d.outputTextureFormat = .bgra8Unorm_srgb
            d.colorProcessingMode = .perceptual
            if let sc = d.makeSpatialScaler(device: device) {
                scaler = sc
                ldr = makeTexture(.bgra8Unorm_srgb, w, h, [.renderTarget, .shaderRead].union(sc.colorTextureUsage))
                upscaled = makeTexture(.bgra8Unorm_srgb, drawable.x, drawable.y, sc.outputTextureUsage)
            }
        }
#endif
        builtFor = (quality, drawable)
    }

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
        builtFor = nil
        game?.rig.aspect = Float(size.width / max(1, size.height))
    }

    // MARK: buffers
    private func buffer(_ ring: inout [MTLBuffer?], _ bytes: Int) -> MTLBuffer {
        if let b = ring[frame], b.length >= bytes { return b }
        let b = device.makeBuffer(length: max(bytes * 3 / 2, 4096), options: .storageModeShared)!
        ring[frame] = b
        return b
    }

    // MARK: draw
    func draw(in view: MTKView) {
        guard let game else { return }
        let now = CACurrentMediaTime()
        let dt = min(0.1, now - lastTime)
        lastTime = now
        frameTime = frameTime * 0.95 + dt * 0.05
        view.preferredFramesPerSecond = game.settings.fps

        game.update(dt: Float(dt))

        let ds = view.drawableSize
        let dsz = SIMD2(Int(ds.width), Int(ds.height))
        if dsz.x < 2 || dsz.y < 2 { return }
        if builtFor == nil || builtFor!.0 != game.settings.quality || builtFor!.1 != dsz { rebuildTargets(quality: game.settings.quality, drawable: dsz) }
        game.rig.aspect = Float(ds.width / ds.height)

        inflight.wait()
        guard let cb = queue.makeCommandBuffer() else { inflight.signal(); return }
        cb.addCompletedHandler { [weak self, weak game] buf in
            self?.inflight.signal()
            let gpu = (buf.gpuEndTime - buf.gpuStartTime) * 1000
            if gpu > 0 { DispatchQueue.main.async { game?.perf.gpuMs = (game?.perf.gpuMs ?? 0) * 0.9 + gpu * 0.1 } }
        }

        let scene = game.scene
        let L = game.lighting
        var U = makeUniforms(game: game, lighting: L)

        if game.overlayDirty {
            game.overlayBytes.withUnsafeBytes { raw in
                overlayTexture.replace(region: MTLRegionMake2D(0, 0, MAP, MAP), mipmapLevel: 0, withBytes: raw.baseAddress!, bytesPerRow: MAP * 4)
            }
            game.overlayDirty = false
        }

        // ---- gather & upload instances
        struct Draw { let mesh: Mesh; let offset: Int; let count: Int; let shadow: Bool }
        var opaque: [Draw] = [], transparent: [Draw] = []
        let identity = [InstanceData(model: .identity, tint: SIMD4(1, 1, 1, 0), extra: .zero)]
        var lists: [([InstanceData], Mesh, Bool, Bool)] = []   // instances, mesh, transparent, shadow
        lists.append((identity, scene.terrain, false, false))
        lists.append((identity, scene.seabed, false, false))
        for b in scene.opaque { lists.append((b.instances, b.mesh, false, b.shadow)) }
        for b in scene.transparent { lists.append((b.instances, b.mesh, true, false)) }
        lists.append((identity, scene.water, true, false))
        if game.overlay != .none {
            let nearest: Float = [.traffic, .power, .water, .happy].contains(game.overlay) ? 1 : 0
            lists.append(([InstanceData(model: .identity, tint: SIMD4(1, 1, 1, 0), extra: SIMD4(nearest, 0, 0, 0))], scene.overlayPlane, true, false))
        }
        if L.night > 0.02 && !scene.lightPools.instances.isEmpty { lists.append((scene.lightPools.instances, scene.lightPools.mesh, true, false)) }
        if !scene.previewBatch.instances.isEmpty { lists.append((scene.previewBatch.instances, scene.previewBatch.mesh, true, false)) }
        if !scene.cursorBatch.instances.isEmpty { lists.append((scene.cursorBatch.instances, scene.cursorBatch.mesh, true, false)) }
        if let g = scene.ghost { lists.append((g.instances, g.mesh, true, false)) }

        let stride = MemoryLayout<InstanceData>.stride
        let total = lists.reduce(0) { $0 + $1.0.count }
        let ib = buffer(&instanceBuffers, total * stride)
        var off = 0
        for (inst, mesh, isT, sh) in lists where !inst.isEmpty {
            inst.withUnsafeBytes { raw in (ib.contents() + off).copyMemory(from: raw.baseAddress!, byteCount: raw.count) }
            let d = Draw(mesh: mesh, offset: off, count: inst.count, shadow: sh)
            if isT { transparent.append(d) } else { opaque.append(d) }
            off += inst.count * stride
        }
        game.perf.frameMs = frameTime * 1000
        game.perf.draws = opaque.count + transparent.count + opaque.filter { $0.shadow }.count + 3
        game.perf.instances = total
        game.perf.renderSize = "\(renderSize.x)×\(renderSize.y)→\(drawableSize.x)×\(drawableSize.y)\(scaler != nil ? " MetalFX" : "")"
        let parts = scene.particleData(night: L.night)
        let pb = buffer(&particleBuffers, max(1, parts.count) * MemoryLayout<ParticleData>.stride)
        if !parts.isEmpty { parts.withUnsafeBytes { raw in pb.contents().copyMemory(from: raw.baseAddress!, byteCount: raw.count) } }

        let uLen = MemoryLayout<FrameUniforms>.stride
        let iVerts = Int(BufVertices.rawValue), iInst = Int(BufInstances.rawValue), iFrame = Int(BufFrame.rawValue)

        // ---- shadow pass
        let sp = MTLRenderPassDescriptor()
        sp.depthAttachment.texture = shadowMap
        sp.depthAttachment.loadAction = .clear; sp.depthAttachment.clearDepth = 1; sp.depthAttachment.storeAction = .store
        if let enc = cb.makeRenderCommandEncoder(descriptor: sp) {
            enc.label = "Shadow"
            enc.setRenderPipelineState(shadowPSO)
            enc.setDepthStencilState(depthWrite)
            enc.setDepthBias(0.0015, slopeScale: 2.0, clamp: 0.01)
            enc.setCullMode(.none)
            enc.setVertexBytes(&U, length: uLen, index: iFrame)
            enc.setVertexBuffer(ib, offset: 0, index: iInst)
            for d in opaque where d.shadow {
                enc.setVertexBuffer(d.mesh.buffer, offset: 0, index: iVerts)
                enc.setVertexBufferOffset(d.offset, index: iInst)
                enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: d.mesh.count, instanceCount: d.count)
            }
            enc.endEncoding()
        }

        // ---- main HDR pass
        let mp = MTLRenderPassDescriptor()
        mp.colorAttachments[0].texture = msaaColor
        mp.colorAttachments[0].resolveTexture = hdr
        mp.colorAttachments[0].loadAction = .clear
        mp.colorAttachments[0].clearColor = MTLClearColor(red: Double(L.fog.x), green: Double(L.fog.y), blue: Double(L.fog.z), alpha: 1)
        mp.colorAttachments[0].storeAction = .multisampleResolve
        mp.depthAttachment.texture = msaaDepth
        mp.depthAttachment.loadAction = .clear; mp.depthAttachment.clearDepth = 1; mp.depthAttachment.storeAction = .dontCare
        if let enc = cb.makeRenderCommandEncoder(descriptor: mp) {
            enc.label = "Scene"
            enc.setVertexBytes(&U, length: uLen, index: iFrame)
            enc.setFragmentBytes(&U, length: uLen, index: iFrame)
            // sky
            enc.setRenderPipelineState(skyPSO)
            enc.setDepthStencilState(depthAlways)
            enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
            // opaque
            enc.setRenderPipelineState(opaquePSO)
            enc.setDepthStencilState(depthWrite)
            enc.setCullMode(.back)
            enc.setFrontFacing(.counterClockwise)
            enc.setFragmentTexture(shadowMap, index: Int(TexShadow.rawValue))
            enc.setVertexBuffer(ib, offset: 0, index: iInst)
            for d in opaque {
                enc.setVertexBuffer(d.mesh.buffer, offset: 0, index: iVerts)
                enc.setVertexBufferOffset(d.offset, index: iInst)
                enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: d.mesh.count, instanceCount: d.count)
            }
            // transparent
            enc.setRenderPipelineState(transparentPSO)
            enc.setDepthStencilState(depthRead)
            enc.setCullMode(.none)
            enc.setFragmentTexture(overlayTexture, index: Int(TexOverlay.rawValue))
            for d in transparent {
                enc.setVertexBuffer(d.mesh.buffer, offset: 0, index: iVerts)
                enc.setVertexBufferOffset(d.offset, index: iInst)
                enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: d.mesh.count, instanceCount: d.count)
            }
            // particles
            if !parts.isEmpty {
                enc.setRenderPipelineState(particlePSO)
                enc.setVertexBuffer(pb, offset: 0, index: iInst)
                enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 6, instanceCount: parts.count)
            }
            enc.endEncoding()
        }

        // ---- bloom
        var bloomTex: MTLTexture = black
        if game.settings.quality.bloom, let blur, let bloomA, let bloomB {
            let bp = MTLRenderPassDescriptor()
            bp.colorAttachments[0].texture = bloomA
            bp.colorAttachments[0].loadAction = .dontCare; bp.colorAttachments[0].storeAction = .store
            if let enc = cb.makeRenderCommandEncoder(descriptor: bp) {
                enc.setRenderPipelineState(brightPSO)
                enc.setFragmentTexture(hdr, index: Int(TexHDR.rawValue))
                enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
                enc.endEncoding()
            }
            blur.encode(commandBuffer: cb, sourceTexture: bloomA, destinationTexture: bloomB)
            bloomTex = bloomB
        }

        // ---- composite (+ MetalFX upscale)
        guard let drawable = view.currentDrawable else { cb.commit(); return }
        let target: MTLTexture = (scaler != nil ? ldr : nil) ?? drawable.texture
        let cp = MTLRenderPassDescriptor()
        cp.colorAttachments[0].texture = target
        cp.colorAttachments[0].loadAction = .dontCare; cp.colorAttachments[0].storeAction = .store
        if let enc = cb.makeRenderCommandEncoder(descriptor: cp) {
            enc.label = "Composite"
            enc.setRenderPipelineState(compositePSO)
            enc.setFragmentBytes(&U, length: uLen, index: iFrame)
            enc.setFragmentTexture(hdr, index: Int(TexHDR.rawValue))
            enc.setFragmentTexture(bloomTex, index: Int(TexBloom.rawValue))
            enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
            enc.endEncoding()
        }
#if canImport(MetalFX)
        if let scaler, let ldr, let upscaled {
            scaler.colorTexture = ldr
            scaler.outputTexture = upscaled
            scaler.encode(commandBuffer: cb)
            if let blit = cb.makeBlitCommandEncoder() {
                blit.copy(from: upscaled, to: drawable.texture)
                blit.endEncoding()
            }
        }
#endif
        cb.present(drawable)
        cb.commit()
        frame = (frame + 1) % 3
    }

    private func makeUniforms(game: GameModel, lighting L: Lighting) -> FrameUniforms {
        let rig = game.rig
        var U = FrameUniforms()
        let vp = rig.viewProj
        U.viewProj = vp
        U.invViewProj = vp.inverse
        // shadow camera follows the view, snapped to texels to avoid shimmer
        let S = max(8, min(46, rig.dist * 0.85))
        let size = Float(game.settings.quality.shadowSize)
        let texel = 2 * S / size
        let tx = (rig.target.x / texel).rounded() * texel, tz = (rig.target.z / texel).rounded() * texel
        let center = SIMD3<Float>(tx, 0, tz)
        let up: SIMD3<Float> = abs(L.lightDir.y) > 0.98 ? SIMD3(0, 0, 1) : SIMD3(0, 1, 0)
        let lv = simd_float4x4.lookAt(eye: center + L.lightDir * 100, target: center, up: up)
        U.lightViewProj = simd_float4x4.orthographic(left: -S, right: S, bottom: -S, top: S, near: 1, far: 220) * lv
        U.cameraPos = SIMD4(rig.position, Float(game.scene.time))
        U.sunDir = SIMD4(L.lightDir, L.sunIntensity)
        U.sunColor = SIMD4(L.sunColor, 1)
        U.skyTop = SIMD4(L.skyTop, 1)
        U.skyHorizon = SIMD4(L.skyHorizon, 1)
        U.hemiSky = SIMD4(L.hemiSky, L.hemiIntensity)
        U.hemiGround = SIMD4(L.hemiGround, 1)
        U.fogColor = SIMD4(L.fog, 1)
        U.fogParams = SIMD4(rig.dist * 1.6, rig.dist * 5 + 60, L.night, L.night)
        U.viewport = SIMD4(Float(renderSize.x), Float(renderSize.y), 1 / Float(renderSize.x), 1 / Float(renderSize.y))
        let q = game.settings.quality
        U.post = SIMD4(q.bloom ? 0.18 + L.night * 0.75 : 0, 1.15, q.tiltShift ? max(1.5, min(7, 11 - rig.dist * 0.12)) * Float(renderSize.y) / 900 : 0, 0.9)
        let fires = game.scene.fires
        func light(_ k: Int) -> SIMD4<Float> {
            guard k < fires.count else { return .zero }
            let f = fires[k], t = Float(game.scene.time)
            return SIMD4(f.x, 0.6, f.y, (2.2 + sin(t * 23 + Float(k)) * 0.5 + sin(t * 37) * 0.4) * (0.5 + L.night))
        }
        U.lights = (light(0), light(1))
        return U
    }
}
