"use client";

/**
 * Billboard text label drawn into a CanvasTexture on a Sprite: no font download (drei Text would
 * fetch fonts from a CDN) and no extra DOM/React roots per label. Always drawn on top.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";

const PX = 48; // canvas font size; texture is rescaled to `height` meters

export function Label({
  text,
  position,
  color,
  background,
  height = 0.9,
  bold = false,
}: {
  text: string;
  position: [number, number, number];
  color: string;
  background: string;
  /** World height of the label in meters. */
  height?: number;
  bold?: boolean;
}) {
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const font = `${bold ? 700 : 500} ${PX}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.font = font;
    const padX = PX * 0.35;
    const w = Math.ceil(ctx.measureText(text).width + 2 * padX);
    const h = Math.ceil(PX * 1.35);
    canvas.width = w;
    canvas.height = h;
    ctx.font = font;
    ctx.fillStyle = background;
    const r = h * 0.25;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, r);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.fillText(text, padX, h / 2 + PX * 0.04);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { texture: t, aspect: w / h };
  }, [text, color, background, bold]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}
