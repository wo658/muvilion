"use client";

import { Component, Suspense, useEffect, useLayoutEffect, useMemo, type ReactNode } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import { Box3, Light, Mesh, NoColorSpace, SkinnedMesh, SRGBColorSpace } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { getMaterialAsset, getModelAsset } from "@/lib/assets/catalog";
import { fitAssetBounds } from "@/lib/assets/fit";
import type { DesignObject } from "@/lib/plans/schema";
import { TOKENS } from "@/lib/ui/tokens";
import { useI18n } from "@/lib/i18n/provider";
import { SceneLabel } from "./scene-label";

class AssetBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function AssetFallback({ object, failed = false }: { object: DesignObject; failed?: boolean }) {
  const { t } = useI18n();
  return <>
    <mesh position={[0, object.height / 2, 0]} castShadow receiveShadow userData={{ navigationObstacle: true, assetLoadState: failed ? "failed" : "loading" }}>
      <boxGeometry args={[object.width, object.height, object.depth]} />
      <meshStandardMaterial color={object.color} roughness={0.85} />
    </mesh>
    {failed && <SceneLabel position={[0, object.height + 0.3, 0]} text={t("Asset unavailable · basic shape")} color={TOKENS.accent} />}
  </>;
}

function ModelAsset({ object }: { object: DesignObject }) {
  const asset = object.modelAssetId ? getModelAsset(object.modelAssetId) : undefined;
  if (!asset) throw new Error("Unknown model asset");
  return <LoadedModel url={asset.url} object={object} />;
}

function LoadedModel({ url, object }: { url: string; object: DesignObject }) {
  // Bundled glTFs are uncompressed; do not attach external decoder endpoints.
  const { scene } = useGLTF(url, false, false);
  const { instance, authoredBounds } = useMemo(() => {
    const copy = clone(scene);
    copy.traverse(node => {
      if (node instanceof Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.userData = { ...node.userData, navigationObstacle: true };
      }
      // A fixture's appearance does not establish a calibrated light source.
      if (node instanceof Light) node.visible = false;
    });
    copy.updateMatrixWorld(true);
    // Measure before mounting: a parent may later rotate, elevate or scale this
    // instance. Resizing must always fit the original authored bounds.
    return { instance: copy, authoredBounds: new Box3().setFromObject(copy, true) };
  }, [scene]);
  const fit = useMemo(() => {
    return fitAssetBounds(authoredBounds.min.toArray(), authoredBounds.max.toArray(), [object.width, object.height, object.depth]);
  }, [authoredBounds, object.width, object.height, object.depth]);
  useEffect(() => () => {
    instance.traverse(node => { if (node instanceof SkinnedMesh) node.skeleton.dispose(); });
  }, [instance]);
  // Meshes/materials/textures remain cache-owned; each placement owns its transform and skeleton.
  return <group scale={fit.scale} dispose={null}><group position={fit.offset}><primitive object={instance} dispose={null} /></group></group>;
}

function MaterialAsset({ object }: { object: DesignObject }) {
  const asset = object.materialAssetId ? getMaterialAsset(object.materialAssetId) : undefined;
  if (!asset) throw new Error("Unknown material asset");
  return <TexturedBox object={object} maps={asset.maps} />;
}

function TexturedBox({ object, maps }: { object: DesignObject; maps: { color: string; normal: string; roughness: string; metalness?: string } }) {
  const urls = useMemo(() => ({ map: maps.color, normalMap: maps.normal, roughnessMap: maps.roughness, ...(maps.metalness ? { metalnessMap: maps.metalness } : {}) }), [maps.color, maps.normal, maps.roughness, maps.metalness]);
  const loaded = useTexture(urls);
  // The catalog fixes each URL's map role. Reuse cache-owned textures across placements;
  // only their canonical color-space metadata changes, never per-object transforms.
  useLayoutEffect(() => {
    for (const [key, texture] of Object.entries(loaded)) {
      const colorSpace = key === "map" ? SRGBColorSpace : NoColorSpace;
      if (texture.colorSpace !== colorSpace) {
        texture.colorSpace = colorSpace;
        texture.needsUpdate = true;
      }
    }
  }, [loaded]);
  return <mesh position={[0, object.height / 2, 0]} castShadow receiveShadow userData={{ navigationObstacle: true }}>
    <boxGeometry args={[object.width, object.height, object.depth]} />
    <meshStandardMaterial {...loaded} roughness={1} metalness={maps.metalness ? 1 : 0} />
  </mesh>;
}

export function AssetObject({ object, selected }: { object: DesignObject; selected: boolean }) {
  return <>
    <AssetBoundary key={`${object.modelAssetId ?? ""}:${object.materialAssetId ?? ""}`} fallback={<AssetFallback object={object} failed />}>
      <Suspense fallback={<AssetFallback object={object} />}>
        {object.modelAssetId ? <ModelAsset object={object} /> : <MaterialAsset object={object} />}
      </Suspense>
    </AssetBoundary>
    {selected && <mesh position={[0, object.height / 2, 0]}>
      <boxGeometry args={[object.width + 0.01, object.height + 0.01, object.depth + 0.01]} />
      <meshBasicMaterial color={TOKENS.accent} wireframe transparent opacity={0.7} depthWrite={false} />
    </mesh>}
  </>;
}
