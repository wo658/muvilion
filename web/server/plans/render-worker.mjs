/** Request-scoped document rasterization. No OCR, model calls or application state. */
import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

class DocumentInputError extends Error {}

const MAX_SIDE = 2400;
const MAX_PIXELS = 30_000_000;
const MAX_PREVIEW = 12_000_000;
const require = createRequire(import.meta.url);
const { bytes, name, page, allPages } = workerData;
const data = Buffer.from(bytes);

function result(format, image, width, height, page = 1, pages = 1, warnings = []) {
  const preview = `data:image/png;base64,${image.toString('base64')}`;
  if (preview.length > MAX_PREVIEW) throw new DocumentInputError('This page is too detailed. Export a smaller region.');
  return { source: { name, format, width, height, page, pages }, preview, warnings };
}

async function imagePage() {
  if (page !== 1) throw new DocumentInputError('Images contain one page; select page 1.');
  const input = sharp(data, { limitInputPixels: MAX_PIXELS, failOn: 'warning' });
  const metadata = await input.metadata();
  if (!['png', 'jpeg'].includes(metadata.format)) throw new DocumentInputError('Only PNG and JPEG images are supported.');
  const output = await input.rotate().flatten({ background: '#ffffff' })
    .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
  return [result('image', output.data, output.info.width, output.info.height)];
}

async function pdfPages() {
  if (!data.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new DocumentInputError('Upload a valid PDF file.');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const assets = dirname(require.resolve('pdfjs-dist/package.json'));
  const task = getDocument({ data: new Uint8Array(data), verbosity: 0,
    cMapUrl: join(assets, 'cmaps/'), standardFontDataUrl: join(assets, 'standard_fonts/'), wasmUrl: join(assets, 'wasm/'),
    useWorkerFetch: false, stopAtErrors: true,
  });
  try {
    const pdf = await task.promise;
    if (page > pdf.numPages) throw new DocumentInputError(`Select a page between 1 and ${pdf.numPages}.`);
    if (allPages && pdf.numPages > 12) throw new DocumentInputError('Planning PDFs support up to 12 pages. Split this document first.');
    const outputs = [];
    let total = 0;
    for (let number = allPages ? 1 : page; number <= (allPages ? pdf.numPages : page); number++) {
      const pdfPage = await pdf.getPage(number);
      const initial = pdfPage.getViewport({ scale: 1 });
      if (!(initial.width > 0 && initial.height > 0 && Number.isFinite(initial.width + initial.height))) throw new DocumentInputError('PDF page has invalid dimensions.');
      const viewport = pdfPage.getViewport({ scale: Math.min(3, MAX_SIDE / Math.max(initial.width, initial.height)) });
      const canvasFactory = pdf.canvasFactory;
      const target = canvasFactory.create(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
      try {
        await pdfPage.render({ canvas: target.canvas, viewport }).promise;
        const image = target.canvas.toBuffer('image/png');
        const output = result('pdf', image, target.canvas.width, target.canvas.height, number, pdf.numPages);
        total += output.preview.length;
        if (allPages && total > 24_000_000) throw new DocumentInputError('This PDF is too large to preview. Split it into smaller documents.');
        outputs.push(output);
      } finally { canvasFactory.destroy(target); pdfPage.cleanup(); }
    }
    return outputs;
  } finally { await task.destroy(); }
}

async function dxfPage() {
  if (page !== 1) throw new DocumentInputError('DXF model space has one preview; select page 1.');
  if (data.subarray(0, 18).toString().startsWith('AutoCAD Binary DXF')) throw new DocumentInputError('Binary DXF is not supported. Export an ASCII DXF or PDF.');
  const { Helper } = require('dxf');
  const helper = new Helper(new TextDecoder('utf-8', { fatal: true }).decode(data).replace(/^\uFEFF/, ''));
  const parsed = helper.parsed;
  // Bound recursive INSERT expansion before the library clones block entities.
  const blocks = new Map(parsed.blocks.map(block => [block.name, block]));
  const counts = new Map();
  function count(entities, ancestors = new Set()) {
    let total = 0;
    for (const entity of entities) {
      if (entity.type !== 'INSERT') total++;
      else {
        const block = blocks.get(entity.block);
        if (!block || ancestors.has(entity.block) || ancestors.size >= 32) throw new DocumentInputError('DXF contains missing or recursive blocks. Export a flattened PDF.');
        if (!counts.has(entity.block)) counts.set(entity.block, count(block.entities, new Set([...ancestors, entity.block])));
        const rows = entity.rowCount ?? 1, columns = entity.columnCount ?? 1;
        if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1) throw new DocumentInputError('DXF contains an invalid insert array.');
        total += rows * columns * counts.get(entity.block);
      }
      if (total > 100_000) throw new DocumentInputError('DXF exceeds the rendering limit. Export a smaller region.');
    }
    return total;
  }
  count(parsed.entities);
  let svg = helper.toSVG();
  if (svg.length > 16_000_000) throw new DocumentInputError('DXF exceeds the rendering limit. Export a smaller region.');
  const view = svg.match(/viewBox="([^"]+)"/)?.[1].trim().split(/\s+/).map(Number);
  if (!view || view.length !== 4 || !view.every(Number.isFinite) || view[2] <= 0 || view[3] <= 0) throw new DocumentInputError('No supported model-space area in this DXF. Export a PDF.');
  const width = Math.max(1, Math.round(1600 * view[2] / Math.max(view[2], view[3])));
  const height = Math.max(1, Math.round(1600 * view[3] / Math.max(view[2], view[3])));
  svg = svg.replace(/<svg\b[^>]*>/, tag => tag.replace(/\s(?:width|height)="[^"]*"/g, "").replace("<svg", `<svg width="${width}" height="${height}"`)).replace(/stroke="[^"]*"/g, 'stroke="#444444"');
  const image = await sharp(Buffer.from(svg), { limitInputPixels: MAX_PIXELS }).flatten({ background: '#ffffff' }).png().toBuffer();
  return [result('dxf', image, width, height, 1, 1, [
    'DXF geometry-only preview: text, dimensions, hatches and unsupported entities are not rendered. Export a PDF to preserve all drawing evidence. Units and scale require manual confirmation.',
  ])];
}

try {
  const pages = /\.pdf$/i.test(name) ? await pdfPages() : /\.dxf$/i.test(name) ? await dxfPage() : await imagePage();
  parentPort.postMessage({ pages });
} catch (error) {
  // Only return document diagnostics, never source bytes or worker internals.
  parentPort.postMessage({ error: error instanceof DocumentInputError ? error.message : 'Could not render this file. Check its format, password protection and integrity.' });
}
