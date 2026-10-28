"use client";

import { Component, Suspense, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MathUtils } from "three";
import { MuviModel, type MuviModelProps } from "./muvi-model";


function Fallback() {
  // A native image remains usable when WebGL or the model request is unavailable.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/mascot/muvi-face.svg" alt="Muvi" className="mx-auto h-full max-h-64 w-auto p-6"/>;
}
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <Fallback/> : this.props.children; }
}

export default function MuviCanvas(props: MuviModelProps) {
  const { compact, paused, onTarget } = props;
  return <Boundary><Canvas
    shadows={!compact} dpr={[1, 1.5]} frameloop={paused ? "demand" : "always"}
    camera={{ position: compact ? [0, 1.4, 5.1] : [2.4, 2.0, 5.4], fov: compact ? 30 : 36 }}
    onCreated={({ camera }) => { camera.lookAt(0, 1.05, 0); }}
    fallback={<Fallback/>}
  >
    <ambientLight intensity={0.9}/>
    <hemisphereLight args={["#f4f1ff", "#b8adc9", 0.7]}/>
    <directionalLight position={[-3, 6, 5]} intensity={2.4} castShadow={!compact} shadow-mapSize={[1024, 1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-normalBias={0.03}/>
    <directionalLight position={[4, 3, -2]} intensity={1.8}/>
    <Suspense fallback={null}><MuviModel {...props}/></Suspense>
    {!compact && <>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.005} receiveShadow onClick={event => {
        if (event.delta > 5 || paused) return;
        event.stopPropagation();
        onTarget?.([MathUtils.clamp(event.point.x, -2.8, 2.8), 0, MathUtils.clamp(event.point.z, -2.8, 2.8)]);
      }}><circleGeometry args={[5, 80]}/><meshStandardMaterial color="#f2eee9" roughness={1}/></mesh>
      <OrbitControls makeDefault target={[0, 1, 0]} minDistance={3.5} maxDistance={12} maxPolarAngle={Math.PI / 2 - 0.03} enablePan={false}/>
    </>}
  </Canvas></Boundary>;
}
