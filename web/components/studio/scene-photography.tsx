"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { CameraControlsImpl } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Color, Object3D, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import type { PhotoShot } from "@/lib/plans/photography";

export type PhotoSettings = Pick<PhotoShot, "cutaway" | "ceilingMode" | "showStructure" | "showOverhead">;
export type PhotoAdjustment = "left" | "right" | "up" | "down" | "truckLeft" | "truckRight" | "truckUp" | "truckDown" | "closer" | "farther" | "narrower" | "wider";
export type PhotoRenderer = {
  capture: (shot: PhotoShot, signal: AbortSignal) => Promise<{ shot: PhotoShot; image: string }>;
  restore: (shot: PhotoShot, signal?: AbortSignal) => Promise<void>;
  current: () => PhotoShot;
  adjust: (action: PhotoAdjustment) => Promise<void>;
};

/** A synchronous draw/read keeps the default framebuffer valid without preserving it. */
export function renderPhoto(scene: Scene, camera: PerspectiveCamera, renderer: WebGLRenderer): string {
  const excluded: { object: Object3D; visible: boolean }[] = [];
  scene.traverse(object => {
    if (object.userData.photographyExclude) {
      excluded.push({ object, visible: object.visible });
      object.visible = false;
    }
  });
  try {
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL("image/jpeg", 0.9);
  } finally {
    for (const { object, visible } of excluded) object.visible = visible;
  }
}

function waitTick(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 32);
    function abort() { window.clearTimeout(timer); reject(signal.reason); }
    signal.addEventListener("abort", abort, { once: true });
  });
}

const settingsMatch = (settings: PhotoSettings, shot: PhotoShot) =>
  settings.cutaway === shot.cutaway && settings.ceilingMode === shot.ceilingMode &&
  settings.showStructure === shot.showStructure && settings.showOverhead === shot.showOverhead;

/** Uses the mounted production scene; never copies scene JSX or changes the live camera to render candidates. */
export function ScenePhotography({ settings, onReady }: {
  settings: PhotoSettings;
  onReady: (renderer: PhotoRenderer | null) => void;
}) {
  const { gl, scene, camera, get, invalidate } = useThree();
  const settingsRef = useRef(settings);
  useLayoutEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const lifetime = new AbortController();
    let renderer: WebGLRenderer | null = null;
    let busy = false;
    let restoredId = "manual";
    const controls = () => {
      const value = get().controls;
      if (!(value instanceof CameraControlsImpl)) throw new Error("The camera is not ready. Try again.");
      return value;
    };
    const ready = async (shot: PhotoShot, signal: AbortSignal) => {
      const started = performance.now();
      let stable = 0;
      while (stable < 2) {
        signal.throwIfAborted();
        let loading = false;
        let failed = false;
        const inspect = (object: Object3D) => {
          if (object.userData.photographyExclude) return;
          loading ||= object.userData.assetLoadState === "loading";
          failed ||= object.userData.assetLoadState === "failed";
          object.children.forEach(inspect);
        };
        inspect(scene);
        if (failed) throw new Error("Some scene assets could not load. Retry before taking photos.");
        const matching = settingsMatch(settingsRef.current, shot);
        if (!matching && performance.now() - started > 5000) throw new Error("The photo view could not be prepared. Try again.");
        if (performance.now() - started > 20_000) throw new Error("Scene assets are still loading. Try again shortly.");
        stable = matching && !loading ? stable + 1 : 0;
        await waitTick(signal);
      }
    };
    const api: PhotoRenderer = {
      async capture(shot, signal) {
        if (busy) throw new Error("A photo is already being captured.");
        busy = true;
        try {
          const active = AbortSignal.any([signal, lifetime.signal]);
          await ready(shot, active);
          active.throwIfAborted();
          if (gl.getContext().isContextLost()) throw new Error("The 3D renderer is unavailable. Reload and try again.");
          if (!renderer) {
            renderer = new WebGLRenderer({ antialias: true, stencil: true, alpha: gl.getContext().getContextAttributes()?.alpha ?? false });
            renderer.setPixelRatio(1);
            renderer.setSize(1280, 720, false);
          }
          renderer.outputColorSpace = gl.outputColorSpace;
          renderer.toneMapping = gl.toneMapping;
          renderer.toneMappingExposure = gl.toneMappingExposure;
          renderer.shadowMap.enabled = gl.shadowMap.enabled;
          renderer.shadowMap.type = gl.shadowMap.type;
          renderer.setClearColor(gl.getClearColor(new Color()), gl.getClearAlpha());
          const photoCamera = camera.clone();
          photoCamera.position.fromArray(shot.eye);
          photoCamera.up.set(0, 1, 0);
          photoCamera.lookAt(...shot.target);
          photoCamera.fov = shot.fov;
          photoCamera.zoom = shot.zoom;
          photoCamera.aspect = shot.aspect;
          photoCamera.updateProjectionMatrix();
          photoCamera.updateMatrixWorld(true);
          scene.updateMatrixWorld(true);
          const image = renderPhoto(scene, photoCamera, renderer);
          active.throwIfAborted();
          if (!image.startsWith("data:image/jpeg;base64,")) throw new Error("The photo could not be captured. Try again.");
          return { shot, image };
        } finally {
          busy = false;
        }
      },
      async restore(shot, signal) {
        const active = signal ? AbortSignal.any([signal, lifetime.signal]) : lifetime.signal;
        await ready(shot, active);
        active.throwIfAborted();
        const control = controls();
        control.stop();
        camera.fov = shot.fov;
        camera.aspect = shot.aspect;
        camera.updateProjectionMatrix();
        await control.setLookAt(...shot.eye, ...shot.target, false);
        active.throwIfAborted();
        await control.zoomTo(shot.zoom, false);
        active.throwIfAborted();
        control.update(0);
        restoredId = shot.id;
        invalidate();
      },
      current() {
        lifetime.signal.throwIfAborted();
        const control = controls();
        return {
          id: restoredId, eye: control.getPosition(new Vector3()).toArray(),
          target: control.getTarget(new Vector3()).toArray(), fov: camera.fov,
          zoom: camera.zoom, aspect: 16 / 9, ...settingsRef.current,
        };
      },
      async adjust(action) {
        lifetime.signal.throwIfAborted();
        const control = controls();
        control.stop();
        const angle = Math.PI / 180;
        const pan = Math.max(0.02, control.distance * 0.005);
        switch (action) {
          case "left": await control.rotate(-angle, 0, false); break;
          case "right": await control.rotate(angle, 0, false); break;
          case "up": await control.rotate(0, -angle, false); break;
          case "down": await control.rotate(0, angle, false); break;
          case "truckLeft": await control.truck(-pan, 0, false); break;
          case "truckRight": await control.truck(pan, 0, false); break;
          case "truckUp": await control.truck(0, pan, false); break;
          case "truckDown": await control.truck(0, -pan, false); break;
          case "closer": await control.dolly(control.distance * 0.02, false); break;
          case "farther": await control.dolly(-control.distance * 0.02, false); break;
          case "narrower": camera.fov = Math.max(20, camera.fov - 1); break;
          case "wider": camera.fov = Math.min(65, camera.fov + 1); break;
        }
        camera.updateProjectionMatrix();
        control.update(0);
        invalidate();
      },
    };
    onReady(api);
    return () => {
      lifetime.abort();
      onReady(null);
      renderer?.dispose();
      renderer?.forceContextLoss();
    };
  }, [camera, gl, scene, get, invalidate, onReady]);
  return null;
}
