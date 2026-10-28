"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { TOKENS } from "@/lib/ui/tokens";

/** Screen-sized, local canvas labels also remain visible in captured WebGL views. */
export function SceneLabel({ text, color, position, onSelect }: { text: string; color: string; position: [number, number, number]; onSelect?: () => void }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(0, 0, 512, 128, 48); ctx.fill();
    ctx.fillStyle = TOKENS.surface; ctx.font = "600 48px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 64, 460);
    const result = new CanvasTexture(canvas); result.colorSpace = SRGBColorSpace;
    return result;
  }, [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={position} scale={[0.16, 0.04, 1]} renderOrder={100} onClick={onSelect ? e => { e.stopPropagation(); onSelect(); } : undefined}><spriteMaterial map={texture} sizeAttenuation={false} depthTest={false} depthWrite={false} transparent /></sprite>;
}
