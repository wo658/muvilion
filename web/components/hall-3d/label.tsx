"use client";

/**
 * Billboard text label drawn into a CanvasTexture on a Sprite: no font download (drei Text would
 * fetch fonts from a CDN) and no extra DOM roots per label. Uses the page's font (Inter).
 * Drawn on top of geometry; callers keep the number of labels small to avoid clutter.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";

const PX = 44; // canvas font size; texture is rescaled to `height` meters

export function Label({
  text,
  position,
  color,
  background,
  border,
  height = 0.75,
  bold = false,
}: {
  text: string;
  position: [number, number, number];
  color: string;
  background: string;
  border?: string;
  /** World height of the label in meters. */
  height?: number;
  bold?: boolean;
}) {
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
    const font = `${bold ? 600 : 500} ${PX}px ${family}`;
    ctx.font = font;
    const padX = PX * 0.45;
    const w = Math.ceil(ctx.measureText(text).width + 2 * padX);
    const h = Math.ceil(PX * 1.5);
    canvas.width = w;
    canvas.height = h;
    ctx.font = font;
    ctx.fillStyle = background;
    const r = h * 0.22;
    ctx.beginPath();
    ctx.roundRect(1, 1, w - 2, h - 2, r);
    ctx.fill();
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.fillText(text, padX, h / 2 + PX * 0.04);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { texture: t, aspect: w / h };
  }, [text, color, background, border, bold]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}
