// Assembles the Kairos demo video: still images + screen clips (with speed-ups) + voice tracks -> MP4 1920x1080.
// Usage: build <plan.json> <out.mp4>
import AVFoundation
import AppKit

struct Seg: Codable {
  let kind: String        // "image" | "video"
  let path: String
  let dur: Double         // output duration, seconds
  let from: Double?       // video: source start
  let to: Double?         // video: source end (played at speed (to-from)/dur)
  let crop: [Double]?     // video: [x, y, w, h] as fractions of the source frame
}
struct Audio: Codable { let path: String; let at: Double }
struct Plan: Codable { let segs: [Seg]; let audio: [Audio] }

let W = 1920, H = 1080
let args = CommandLine.arguments
let plan = try! JSONDecoder().decode(Plan.self, from: Data(contentsOf: URL(fileURLWithPath: args[1])))
let outURL = URL(fileURLWithPath: args[2])
let tmp = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("kvid")
try? FileManager.default.removeItem(at: tmp)
try! FileManager.default.createDirectory(at: tmp, withIntermediateDirectories: true)

func sec(_ s: Double) -> CMTime { CMTime(seconds: s, preferredTimescale: 600) }

/// Renders an image aspect-fit on a dark background into a still MP4 clip.
func stillClip(_ path: String, _ dur: Double, _ idx: Int) -> URL {
  let url = tmp.appendingPathComponent("still\(idx).mp4")
  let img = NSImage(contentsOfFile: path)!
  var rect = CGRect(x: 0, y: 0, width: img.size.width, height: img.size.height)
  let cg = img.cgImage(forProposedRect: &rect, context: nil, hints: nil)!
  var pb: CVPixelBuffer?
  CVPixelBufferCreate(nil, W, H, kCVPixelFormatType_32ARGB, [kCVPixelBufferCGImageCompatibilityKey: true, kCVPixelBufferCGBitmapContextCompatibilityKey: true] as CFDictionary, &pb)
  CVPixelBufferLockBaseAddress(pb!, [])
  let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb!), width: W, height: H, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pb!), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
  ctx.setFillColor(CGColor(red: 0.04, green: 0.06, blue: 0.14, alpha: 1))
  ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
  let iw = Double(cg.width), ih = Double(cg.height)
  let fit = (iw / ih > Double(W) / Double(H)) && iw / ih > 0 ? min(Double(W) * 0.94 / iw, Double(H) * 0.94 / ih) : min(Double(W) * 0.94 / iw, Double(H) * 0.94 / ih)
  let s = (iw == Double(W) && ih == Double(H)) ? 1.0 : fit
  let dw = iw * s, dh = ih * s
  ctx.interpolationQuality = .high
  ctx.draw(cg, in: CGRect(x: (Double(W) - dw) / 2, y: (Double(H) - dh) / 2, width: dw, height: dh))
  CVPixelBufferUnlockBaseAddress(pb!, [])

  let w = try! AVAssetWriter(outputURL: url, fileType: .mp4)
  let input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H])
  let ad = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: nil)
  w.add(input); w.startWriting(); w.startSession(atSourceTime: .zero)
  var t = 0.0
  while t < dur {
    while !input.isReadyForMoreMediaData { usleep(1000) }
    ad.append(pb!, withPresentationTime: sec(t)); t += 0.5
  }
  while !input.isReadyForMoreMediaData { usleep(1000) }
  ad.append(pb!, withPresentationTime: sec(dur))
  input.markAsFinished()
  w.endSession(atSourceTime: sec(dur))
  let sem = DispatchSemaphore(value: 0); w.finishWriting { sem.signal() }; sem.wait()
  return url
}

let comp = AVMutableComposition()
let vtrack = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
var instructions: [AVMutableVideoCompositionInstruction] = []
var cursor = 0.0
for (i, s) in plan.segs.enumerated() {
  let url = s.kind == "image" ? stillClip(s.path, s.dur, i) : URL(fileURLWithPath: s.path)
  let asset = AVURLAsset(url: url)
  let src = asset.tracks(withMediaType: .video)[0]
  let from = s.kind == "image" ? 0 : (s.from ?? 0)
  let to = s.kind == "image" ? s.dur : (s.to ?? CMTimeGetSeconds(asset.duration))
  let at = sec(cursor)
  try! vtrack.insertTimeRange(CMTimeRange(start: sec(from), end: sec(to)), of: src, at: at)
  let range = CMTimeRange(start: at, duration: sec(s.dur))
  if abs((to - from) - s.dur) > 0.01 {
    vtrack.scaleTimeRange(CMTimeRange(start: at, duration: sec(to - from)), toDuration: sec(s.dur))
  }
  // Fit the source into 1920x1080.
  let n = src.naturalSize.applying(src.preferredTransform)
  let fw = abs(n.width), fh = abs(n.height)
  let c = s.crop ?? [0, 0, 1, 1]
  let cx = c[0] * fw, cy = c[1] * fh, sw = c[2] * fw, sh = c[3] * fh
  let k = min(Double(W) / sw, Double(H) / sh)
  let tr = src.preferredTransform
    .concatenating(CGAffineTransform(translationX: -cx, y: -cy))
    .concatenating(CGAffineTransform(scaleX: k, y: k))
    .concatenating(CGAffineTransform(translationX: (Double(W) - sw * k) / 2, y: (Double(H) - sh * k) / 2))
  let li = AVMutableVideoCompositionLayerInstruction(assetTrack: vtrack)
  li.setTransform(tr, at: at)
  let ins = AVMutableVideoCompositionInstruction()
  ins.timeRange = range
  ins.backgroundColor = CGColor(red: 0.04, green: 0.06, blue: 0.14, alpha: 1)
  ins.layerInstructions = [li]
  instructions.append(ins)
  print(String(format: "%6.1fs  %@  %@", cursor, s.kind, (s.path as NSString).lastPathComponent))
  cursor += s.dur
}
for a in plan.audio {
  let asset = AVURLAsset(url: URL(fileURLWithPath: a.path))
  let src = asset.tracks(withMediaType: .audio)[0]
  let t = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
  try! t.insertTimeRange(CMTimeRange(start: .zero, duration: asset.duration), of: src, at: sec(a.at))
}
let vc = AVMutableVideoComposition()
vc.renderSize = CGSize(width: W, height: H)
vc.frameDuration = CMTime(value: 1, timescale: 30)
vc.instructions = instructions

try? FileManager.default.removeItem(at: outURL)
let ex = AVAssetExportSession(asset: comp, presetName: AVAssetExportPreset1920x1080)!
ex.outputURL = outURL; ex.outputFileType = .mp4; ex.videoComposition = vc
let sem = DispatchSemaphore(value: 0)
ex.exportAsynchronously { sem.signal() }
sem.wait()
print("export:", ex.status == .completed ? "ok" : "FAILED \(String(describing: ex.error))", String(format: "total %.1fs", cursor))
