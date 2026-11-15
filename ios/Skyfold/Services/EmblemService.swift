import CoreGraphics
import Foundation
import ImagePlayground

/// Image Playground: generates a city flag/emblem on-device with ImageCreator.
/// Players can also design their own via `.imagePlaygroundSheet` (see DeskView).
final class EmblemService {
    private var cache: [String: CGImage] = [:]

    func emblem(for name: String, seed: UInt32) async -> CGImage? {
        let key = "\(name)-\(seed)"
        if let c = cache[key] { return c }
        do {
            let creator = try await ImageCreator()
            let style: ImagePlaygroundStyle = creator.availableStyles.contains(.illustration) ? .illustration : (creator.availableStyles.first ?? .illustration)
            let images = creator.images(for: [.text("A heraldic city flag emblem for \(name), a seaside island city with a modern skyline, bold flat colors, centered")], style: style, limit: 1)
            for try await image in images {
                cache[key] = image.cgImage
                return image.cgImage
            }
        } catch {
            // Image Playground unavailable on this device/region: the UI draws a procedural crest.
        }
        return nil
    }

    func load(url: URL) -> CGImage? {
        guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        return CGImageSourceCreateImageAtIndex(src, 0, nil)
    }
}
