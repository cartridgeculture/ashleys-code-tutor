// Draws ACT's first app icon ("Original" in Preferences > App icon): a blue-to-purple rounded square with "ACT" and a code caret, as a 1024x1024 PNG. Kept as Resources/OriginalIcon.png.
import AppKit

let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "icon.png"
let size: CGFloat = 1024
let img = NSImage(size: NSSize(width: size, height: size))
img.lockFocus()
let inset: CGFloat = 100
let rect = NSRect(x: inset, y: inset, width: size - inset * 2, height: size - inset * 2)
let path = NSBezierPath(roundedRect: rect, xRadius: 185, yRadius: 185)
NSGraphicsContext.current?.saveGraphicsState()
let shadow = NSShadow()
shadow.shadowColor = NSColor.black.withAlphaComponent(0.35)
shadow.shadowBlurRadius = 30
shadow.shadowOffset = NSSize(width: 0, height: -12)
shadow.set()
NSColor.black.setFill()
path.fill()
NSGraphicsContext.current?.restoreGraphicsState()
let gradient = NSGradient(colors: [NSColor(srgbRed: 0.0, green: 0.47, blue: 0.83, alpha: 1), NSColor(srgbRed: 0.42, green: 0.18, blue: 0.73, alpha: 1)])!
gradient.draw(in: path, angle: -45)

let para = NSMutableParagraphStyle()
para.alignment = .center
let big: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 250, weight: .heavy), .foregroundColor: NSColor.white, .paragraphStyle: para, .kern: 6]
NSAttributedString(string: "ACT", attributes: big).draw(in: NSRect(x: rect.minX, y: rect.midY - 120, width: rect.width, height: 320))
let mono: [NSAttributedString.Key: Any] = [.font: NSFont.monospacedSystemFont(ofSize: 120, weight: .bold), .foregroundColor: NSColor.white.withAlphaComponent(0.75), .paragraphStyle: para]
NSAttributedString(string: "{ ▸_ }", attributes: mono).draw(in: NSRect(x: rect.minX, y: rect.minY + 95, width: rect.width, height: 160))
img.unlockFocus()

let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
