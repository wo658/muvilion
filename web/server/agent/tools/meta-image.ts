import "server-only";
import sharp from "sharp";
import { z } from "zod";
import type { Env } from "@/lib/env";

export async function generateConceptImage(prompt: string, references: string[], signal: AbortSignal, env: Env = process.env) {
  if (!env.MODEL_API_KEY) throw new Error("Muse Image is not configured.");
  const response = await fetch(`${(env.META_BASE_URL ?? 'https://api.meta.ai/v1').replace(/\/$/, '')}/images/${references.length ? 'edits' : 'generations'}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.MODEL_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.any([signal, AbortSignal.timeout(45_000)]),
    body: JSON.stringify({ model: env.META_IMAGE_MODEL ?? 'muse-image-1.0', prompt, n: 1, response_format: 'b64_json', output_format: 'png', reasoning_strength: 'low',
      tool_enablement: { enable_web_search: false, enable_image_search: false, enable_shell: false },
      ...(references.length ? { images: references.slice(0, 10).map(image_url => ({ image_url })) } : {}),
    }),
  });
  if (!response.ok) throw new Error(`Muse Image request failed (${response.status}). Continue without a generated concept.`);
  // Bound downloads before JSON parsing; never fetch model-returned URLs.
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Muse Image returned no body.');
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const {done,value} = await reader.read(); if (done) break;
      length += value.length;
      if (length > 24_000_000) throw new Error('Muse Image response exceeds the size limit.');
      chunks.push(value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  const body = z.object({ data: z.array(z.object({ b64_json: z.string().max(22_000_000).regex(/^[A-Za-z0-9+/=]+$/) })).min(1).max(1) }).parse(JSON.parse(Buffer.concat(chunks).toString()));
  const image = await sharp(Buffer.from(body.data[0].b64_json, 'base64'), { limitInputPixels: 20_000_000 }).resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  if (image.length > 2_900_000) throw new Error('Concept image exceeds the size limit.');
  return `data:image/webp;base64,${image.toString('base64')}`;
}
