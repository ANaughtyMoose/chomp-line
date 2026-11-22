import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count >= 4 else {
    fputs("Usage: swift chroma_cutout.swift src dst mode [maxSize]\n", stderr)
    exit(1)
}

let srcPath = CommandLine.arguments[1]
let dstPath = CommandLine.arguments[2]
let mode = CommandLine.arguments[3]
let maxSize = CommandLine.arguments.count >= 5 ? (Int(CommandLine.arguments[4]) ?? 512) : 512

let srcUrl = URL(fileURLWithPath: srcPath)
guard let src = CGImageSourceCreateWithURL(srcUrl as CFURL, nil),
      let cgImg = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
    fputs("Failed to load image: \(srcPath)\n", stderr)
    exit(1)
}

let w = cgImg.width
let h = cgImg.height
var pixels = [UInt8](repeating: 0, count: w * h * 4)
let colorSpace = CGColorSpaceCreateDeviceRGB()

guard let ctx = CGContext(
    data: &pixels,
    width: w,
    height: h,
    bitsPerComponent: 8,
    bytesPerRow: w * 4,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
    fputs("Failed to create CGContext\n", stderr)
    exit(1)
}

ctx.draw(cgImg, in: CGRect(x: 0, y: 0, width: w, height: h))

@inline(__always)
func isKey(_ r: Int, _ g: Int, _ b: Int) -> Bool {
    if mode == "green" {
        return g > 105 && (g - max(r, b)) > 34
    } else {
        return r > 105 && b > 105 && (min(r, b) - g) > 34
    }
}

@inline(__always)
func keyStrength(_ r: Int, _ g: Int, _ b: Int) -> Double {
    if mode == "green" {
        return max(0.0, Double(g - max(r, b)) / 255.0)
    } else {
        return max(0.0, Double(min(r, b) - g) / 255.0)
    }
}

var bgMask = [Bool](repeating: false, count: w * h)
var queue = [Int]()
queue.reserveCapacity(w * h / 2)

func trySeed(_ x: Int, _ y: Int) {
    let idx = y * w + x
    if bgMask[idx] { return }
    let o = idx * 4
    if isKey(Int(pixels[o]), Int(pixels[o+1]), Int(pixels[o+2])) {
        bgMask[idx] = true
        queue.append(idx)
    }
}

for x in 0..<w { trySeed(x, 0); trySeed(x, h - 1) }
for y in 0..<h { trySeed(0, y); trySeed(w - 1, y) }

var head = 0
while head < queue.count {
    let idx = queue[head]
    head += 1
    let cx = idx % w
    let cy = idx / w
    if cx + 1 < w { trySeed(cx + 1, cy) }
    if cx - 1 >= 0 { trySeed(cx - 1, cy) }
    if cy + 1 < h { trySeed(cx, cy + 1) }
    if cy - 1 >= 0 { trySeed(cx, cy - 1) }
}

// Clear obvious interior chroma holes (between legs, branches, lift struts)
for idx in 0..<(w * h) {
    if !bgMask[idx] {
        let o = idx * 4
        let r = Int(pixels[o]), g = Int(pixels[o+1]), b = Int(pixels[o+2])
        if mode == "green" && g > 165 && (g - max(r, b)) > 78 {
            bgMask[idx] = true
        } else if mode == "magenta" && r > 165 && b > 165 && (min(r, b) - g) > 78 {
            bgMask[idx] = true
        }
    }
}

// Apply alpha + 2px soft edge despill so ZERO green/magenta fringe remains!
var minX = w, minY = h, maxX = 0, maxY = 0
for y in 0..<h {
    for x in 0..<w {
        let idx = y * w + x
        let o = idx * 4
        if bgMask[idx] {
            pixels[o] = 0; pixels[o+1] = 0; pixels[o+2] = 0; pixels[o+3] = 0
        } else {
            var nearBg = false
            outer: for dy in -2...2 {
                let ny = y + dy
                if ny < 0 || ny >= h { continue }
                for dx in -2...2 {
                    let nx = x + dx
                    if nx < 0 || nx >= w { continue }
                    if bgMask[ny * w + nx] { nearBg = true; break outer }
                }
            }
            var r = Int(pixels[o]), g = Int(pixels[o+1]), b = Int(pixels[o+2]), a = 255
            if nearBg {
                let ks = keyStrength(r, g, b)
                if mode == "green" {
                    g = min(g, max(r, b))
                } else {
                    let avg = (r + b) / 2
                    if avg > g + 14 {
                        r = min(r, g + 14)
                        b = min(b, g + 14)
                    }
                }
                let af = max(0.0, min(1.0, 1.0 - ks * 3.8))
                a = Int(af * 255.0)
                // Premultiply RGB by alpha for CGContext
                r = (r * a) / 255
                g = (g * a) / 255
                b = (b * a) / 255
            }
            pixels[o] = UInt8(r); pixels[o+1] = UInt8(g); pixels[o+2] = UInt8(b); pixels[o+3] = UInt8(a)
            if a > 20 {
                if x < minX { minX = x }
                if y < minY { minY = y }
                if x > maxX { maxX = x }
                if y > maxY { maxY = y }
            }
        }
    }
}

guard let cutImg = ctx.makeImage() else { exit(1) }

let pad = 6
let cropX = max(0, minX - pad)
let cropY = max(0, minY - pad)
let cropW = max(1, min(w - cropX, (maxX - minX + 1) + pad * 2))
let cropH = max(1, min(h - cropY, (maxY - minY + 1) + pad * 2))
let cropped = cutImg.cropping(to: CGRect(x: cropX, y: cropY, width: cropW, height: cropH)) ?? cutImg

// Resize preserving aspect ratio
let scale = min(1.0, Double(maxSize) / Double(max(cropped.width, cropped.height)))
let outW = max(1, Int(Double(cropped.width) * scale))
let outH = max(1, Int(Double(cropped.height) * scale))

guard let outCtx = CGContext(
    data: nil,
    width: outW,
    height: outH,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else { exit(1) }

outCtx.interpolationQuality = .high
outCtx.draw(cropped, in: CGRect(x: 0, y: 0, width: outW, height: outH))
guard let finalImg = outCtx.makeImage() else { exit(1) }

let dstUrl = URL(fileURLWithPath: dstPath)
try? FileManager.default.createDirectory(at: dstUrl.deletingLastPathComponent(), withIntermediateDirectories: true)
guard let dest = CGImageDestinationCreateWithURL(dstUrl as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    fputs("Failed to create PNG destination\n", stderr)
    exit(1)
}
CGImageDestinationAddImage(dest, finalImg, nil)
CGImageDestinationFinalize(dest)
print("Processed \(dstUrl.lastPathComponent): \(outW)x\(outH)")
