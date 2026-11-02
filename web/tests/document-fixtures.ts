/** Repository-authored PDFs, with no external assets or PDF-writing dependency. */
export function pdfFile(pages = 2, rotation = 0, crop = false) {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pages} >>`];
  for (let index = 0; index < pages; index++) {
    const drawing = "0 0 0 RG 2 w 20 20 160 60 re S";
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] ${crop ? '/CropBox [10 10 190 90]' : ''} /Rotate ${rotation} /Resources << >> /Contents ${4 + index * 2} 0 R >>`);
    objects.push(`<< /Length ${drawing.length} >>\nstream\n${drawing}\nendstream`);
  }
  let content = "%PDF-1.7\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(content)); content += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(content);
  content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new File([content], "fixture.pdf", { type: "application/pdf" });
}
