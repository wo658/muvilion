// Rasterize every page of an exported planning PDF with macOS PDFKit: swift render-pdf-pages.swift <pdf> <out-prefix> <long-edge-px>
import PDFKit
import AppKit
let args=CommandLine.arguments
let doc=PDFDocument(url:URL(fileURLWithPath:args[1]))!
let outPrefix=args[2]; let target=CGFloat(Double(args[3])!)
for i in 0..<doc.pageCount {
  let page=doc.page(at:i)!; let b=page.bounds(for:.mediaBox)
  let s=target/max(b.width,b.height); let w=Int(b.width*s), h=Int(b.height*s)
  let rep=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:w,pixelsHigh:h,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
  NSGraphicsContext.saveGraphicsState(); let ctx=NSGraphicsContext(bitmapImageRep:rep)!; NSGraphicsContext.current=ctx
  let cg=ctx.cgContext; cg.setFillColor(CGColor(gray:1,alpha:1)); cg.fill(CGRect(x:0,y:0,width:w,height:h)); cg.scaleBy(x:s,y:s)
  page.draw(with:.mediaBox,to:cg); NSGraphicsContext.restoreGraphicsState()
  try! rep.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:"\(outPrefix)\(i+1).png"))
}
print(doc.pageCount)
