import { copyFile, cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
await mkdir(new URL("../public/", import.meta.url), { recursive: true });
await copyFile(require.resolve("pdfjs-dist/build/pdf.worker.min.mjs"), new URL("../public/pdf.worker.min.mjs", import.meta.url));
const root = dirname(require.resolve("pdfjs-dist/package.json"));
await Promise.all(["cmaps", "standard_fonts", "wasm"].map((directory) => cp(join(root, directory), new URL(`../public/pdf-assets/${directory}`, import.meta.url), { recursive: true })));
