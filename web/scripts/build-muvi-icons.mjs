import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const face = await readFile(new URL("../public/mascot/muvi-face.svg", import.meta.url));
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map(size => sharp(face).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
pngs.forEach((png, i) => {
  const entry = 6 + i * 16;
  header[entry] = sizes[i]; header[entry + 1] = sizes[i];
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(new URL("../app/favicon.ico", import.meta.url), Buffer.concat([header, ...pngs]));
await sharp(face).resize(156, 156).extend({ top: 12, bottom: 12, left: 12, right: 12, background: "#f5f3ff" }).png().toFile(new URL("../app/apple-icon.png", import.meta.url).pathname);
console.log("Muvi favicon (16/32/48px) and Apple icon (180px) rebuilt.");
