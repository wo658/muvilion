"""Render the actual PDF at video resolution, preserving the extraction crop."""
from pathlib import Path
import pypdfium2 as pdfium

root = Path(__file__).resolve().parents[2]
output = root / 'video/public/input-reveal'
with pdfium.PdfDocument(root / 'video/input-reveal/source/west-L3.pdf') as document:
    page = document[0]
    width, height = page.get_size()
    crop = (633/1224*width, (1584-486)/1584*height,
            (1224-837)/1224*width, 350/1584*height)
    bitmap = page.render(scale=1400/(204/1224*width), crop=crop)
    bitmap.to_pil().save(output / 'plan.png')
    bitmap = page.render(scale=1500/height)
    bitmap.to_pil().save(output / 'full-plan.png')
