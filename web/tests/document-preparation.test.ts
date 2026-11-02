import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { preparePages } from "@/server/plans/prepare";
import { previewPdf } from "@/server/plans/pdf";
import { pdfFile } from "./document-fixtures";

const pixels = (preview: string) => sharp(Buffer.from(preview.split(',')[1], 'base64'));

describe("Node document preparation without a Python service", () => {
  it("renders the requested PDF page with its page count and rotation, without interpreting lines or text", async () => {
    const [page] = await preparePages(pdfFile(2, 90), 2);
    expect(page.source).toMatchObject({ page: 2, pages: 2, width: 300, height: 600 });
    expect(page).toMatchObject({ method: 'preview', lines: [], texts: [], widthMeters: null, heightMeters: null, scaleConfirmed: false });
    const stats = await pixels(page.preview).stats();
    expect(stats.channels[0].min).toBeLessThan(50);
    expect(stats.channels[0].max).toBe(255);
  });
  it("uses the visible PDF crop as the image coordinate frame", async () => {
    const [page] = await preparePages(pdfFile(1, 0, true));
    expect(page.source).toMatchObject({ width: 540, height: 240 });
  });
  it("previews every reference PDF page without OCR and rejects excessive page counts before rendering", async () => {
    const result = await previewPdf(pdfFile(2), new AbortController().signal);
    expect(result.previews).toHaveLength(2);
    expect(result.text).toBe('');
    await expect(previewPdf(pdfFile(13), new AbortController().signal)).rejects.toThrow('12 pages');
    await expect(preparePages(pdfFile(), 3)).rejects.toThrow('between 1 and 2');
  });
  it("orients images and composites transparent pixels onto paper", async () => {
    const bytes = await sharp({ create: { width: 16, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const [page] = await preparePages(new File([new Uint8Array(bytes)], 'transparent.png'));
    expect(page.source).toMatchObject({ width: 16, height: 8 });
    expect((await pixels(page.preview).stats()).channels.every(channel => channel.min === 255)).toBe(true);
    const rotated = await sharp({ create: { width: 16, height: 8, channels: 3, background: '#ffffff' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    expect((await preparePages(new File([new Uint8Array(rotated)], 'rotated.jpg')))[0].source).toMatchObject({ width: 8, height: 16 });
  });
  it("rejects new DXF uploads before attempting conversion", async () => {
    await expect(preparePages(new File(['0\nEOF\n'], 'hall.DXF'))).rejects.toMatchObject({ status: 415 });
  });
  it("rejects invalid files and terminates document work when the request is cancelled", async () => {
    await expect(preparePages(new File(['bad'], 'bad.pdf'))).rejects.toThrow('valid PDF');
    await expect(preparePages(new File(['bad'], 'bad.png'))).rejects.toThrow();
    await expect(preparePages(pdfFile(), 0)).rejects.toMatchObject({ status: 400 });
    const controller = new AbortController();
    const pending = preparePages(pdfFile(12), 1, { allPages: true, signal: controller.signal });
    setTimeout(() => controller.abort(), 20);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
