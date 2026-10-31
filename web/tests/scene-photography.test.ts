import { describe, expect, it, vi } from "vitest";
import { Group, PerspectiveCamera, Scene, type WebGLRenderer } from "three";
import { renderPhoto } from "@/components/studio/scene-photography";

describe("촬영 렌더러 상태 보존", () => {
  it("Muvi를 사진에서 제외하고 렌더링 실패 후에도 원래 표시 상태를 복구한다", () => {
    const scene = new Scene();
    const mascot = new Group();
    mascot.userData.photographyExclude = true;
    scene.add(mascot);
    const camera = new PerspectiveCamera();
    const render = vi.fn(() => {
      expect(mascot.visible).toBe(false);
      throw new Error("GPU failed");
    });
    const renderer = { render } as unknown as WebGLRenderer;
    expect(() => renderPhoto(scene, camera, renderer)).toThrow("GPU failed");
    expect(mascot.visible).toBe(true);
    expect(render).toHaveBeenCalledOnce();
  });
  it("촬영 직후 이미지를 읽고 원래 숨겨진 장식을 표시하지 않는다", () => {
    const scene = new Scene();
    const mascot = new Group();
    mascot.visible = false;
    mascot.userData.photographyExclude = true;
    scene.add(mascot);
    const order: string[] = [];
    const renderer = {
      render: () => { order.push("render"); },
      domElement: { toDataURL: () => { order.push("capture"); return "data:image/jpeg;base64,cGhvdG8="; } },
    } as unknown as WebGLRenderer;
    expect(renderPhoto(scene, new PerspectiveCamera(), renderer)).toMatch(/^data:image\/jpeg/);
    expect(order).toEqual(["render", "capture"]);
    expect(mascot.visible).toBe(false);
  });
});
