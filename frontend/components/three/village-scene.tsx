"use client";

import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer, useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = "/models/solarpunk_village.glb";
// draco off, meshopt on (drei supplies the local MeshoptDecoder — no CDN).
useGLTF.preload(MODEL_URL, false);

/**
 * Solarpunk-village hero: the camera flies THROUGH the village along a smooth
 * spline as the pinned hero scrolls. Buttery because the path progress is
 * exponentially damped each frame (dt-clamped) on top of Lenis, and the camera
 * looks along the path tangent (looks where it's going). Subtle mouse parallax,
 * narrative hotspots and ambient life add interactivity. All lighting is local
 * (no CDN HDR) so it stays offline/CSP-safe.
 */

// ---- fitted village (scaled + centred at the origin) --------------------- //
function useFittedVillage() {
  const { scene } = useGLTF(MODEL_URL, false);
  return useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 60 / maxDim;
    const offset = center.clone().multiplyScalar(-scale);
    const fitted = size.clone().multiplyScalar(scale);
    // emissive materials -> gentle solarpunk shimmer
    const emissive: { mat: THREE.MeshStandardMaterial; base: number }[] = [];
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && m.emissive && (m.emissiveIntensity ?? 0) > 0.05) {
        emissive.push({ mat: m, base: m.emissiveIntensity });
      }
    });
    return { scene, scale, offset, fitted, emissive };
  }, [scene]);
}

function VillageModel({
  data,
  reducedMotion,
}: {
  data: ReturnType<typeof useFittedVillage>;
  reducedMotion: boolean;
}) {
  useFrame((state) => {
    if (reducedMotion) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < data.emissive.length; i++) {
      const e = data.emissive[i];
      e.mat.emissiveIntensity = e.base * (1 + 0.16 * Math.sin(t * 1.4 + i));
    }
  });
  return (
    <group scale={data.scale} position={[data.offset.x, data.offset.y, data.offset.z]}>
      <primitive object={data.scene} />
    </group>
  );
}

// ---- fly-through camera + mouse parallax --------------------------------- //
function FlyThrough({
  scroll,
  fitted,
  reducedMotion,
}: {
  scroll: MutableRefObject<number>;
  fitted: THREE.Vector3;
  reducedMotion: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const pointer = useRef({ x: 0, y: 0 });
  const off = useRef({ x: 0, y: 0 });
  const cur = useRef(0);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const tan = useMemo(() => new THREE.Vector3(), []);

  const curve = useMemo(() => {
    const hx = fitted.x / 2, hy = fitted.y / 2, hz = fitted.z / 2;
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.25 * hx, 1.7 * hy, hz * 1.4),
      new THREE.Vector3(-0.2 * hx, 1.15 * hy, hz * 0.5),
      new THREE.Vector3(0.16 * hx, 0.55 * hy, 0),
      new THREE.Vector3(-0.16 * hx, 1.0 * hy, -hz * 0.55),
      new THREE.Vector3(0.2 * hx, 1.55 * hy, -hz * 1.4),
    ], false, "catmullrom", 0.5);
  }, [fitted]);

  useEffect(() => {
    if (reducedMotion) return;
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reducedMotion]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    const target = reducedMotion ? 0.14 : THREE.MathUtils.clamp(scroll.current, 0, 1);
    cur.current = THREE.MathUtils.damp(cur.current, target, 3.2, d);
    const t = THREE.MathUtils.clamp(cur.current, 0, 1);

    curve.getPointAt(t, tmp);
    curve.getTangentAt(t, tan);

    // damped mouse parallax
    off.current.x = THREE.MathUtils.damp(off.current.x, pointer.current.x * 2.2, 2.5, d);
    off.current.y = THREE.MathUtils.damp(off.current.y, -pointer.current.y * 1.4, 2.5, d);

    camera.position.set(tmp.x + off.current.x, tmp.y + off.current.y, tmp.z);
    look.copy(tmp).addScaledVector(tan, 9);
    look.x += off.current.x * 0.4;
    look.y += off.current.y * 0.4;
    camera.lookAt(look);
  });
  return null;
}

// ---- narrative hotspots -------------------------------------------------- //
const HOTSPOTS = [
  { label: "Solar microgrid", at: 0.26, p: [0.32, 0.95, 0.4] },
  { label: "Dairy SHG", at: 0.45, p: [-0.34, 0.45, 0.04] },
  { label: "Mandi prices", at: 0.62, p: [0.34, 0.55, -0.32] },
  { label: "UPI activity", at: 0.78, p: [-0.26, 0.72, -0.62] },
] as const;

function Hotspot({
  label, at, position, scroll,
}: {
  label: string; at: number; position: [number, number, number]; scroll: MutableRefObject<number>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFrame(() => {
    if (!ref.current) return;
    const o = THREE.MathUtils.clamp(1 - Math.abs(scroll.current - at) / 0.16, 0, 1);
    ref.current.style.opacity = String(o);
    ref.current.style.transform = `translateY(${(1 - o) * 10}px)`;
  });
  return (
    <Html position={position} center style={{ pointerEvents: "none" }} zIndexRange={[5, 0]}>
      <div
        ref={ref}
        style={{ opacity: 0 }}
        className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#24bfa9] opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#24bfa9]" />
        </span>
        {label}
      </div>
    </Html>
  );
}

function Dust() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    let s = 1337;
    const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const arr = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      arr[i * 3] = (rand() - 0.5) * 70;
      arr[i * 3 + 1] = rand() * 30;
      arr[i * 3 + 2] = (rand() - 0.5) * 80;
    }
    return arr;
  }, []);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.01;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.12} color="#ffe6a8" transparent opacity={0.5} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function SceneContents({ scroll, reducedMotion }: { scroll: MutableRefObject<number>; reducedMotion: boolean }) {
  const data = useFittedVillage();
  const hz = data.fitted.z / 2, hy = data.fitted.y / 2, hx = data.fitted.x / 2;
  return (
    <>
      <VillageModel data={data} reducedMotion={reducedMotion} />
      <FlyThrough scroll={scroll} fitted={data.fitted} reducedMotion={reducedMotion} />
      <Dust />
      {HOTSPOTS.map((h) => (
        <Hotspot
          key={h.label}
          label={h.label}
          at={h.at}
          position={[h.p[0] * hx, h.p[1] * hy, h.p[2] * hz]}
          scroll={scroll}
        />
      ))}
    </>
  );
}

export default function VillageScene({
  scroll,
  active = true,
  reducedMotion = false,
  maxDpr = 1.5,
}: {
  scroll: MutableRefObject<number>;
  active?: boolean;
  reducedMotion?: boolean;
  maxDpr?: number;
}) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      camera={{ position: [10, 12, 45], fov: 55, near: 0.1, far: 400 }}
      dpr={[1, maxDpr]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
      }}
    >
      <ambientLight intensity={0.65} />
      <hemisphereLight args={["#cdeef2", "#d8c39a", 0.75]} />
      <directionalLight position={[20, 30, 15]} intensity={2.4} color="#fff3d8" />
      <directionalLight position={[-15, 10, -10]} intensity={0.5} color="#24bfa9" />

      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.6} position={[0, 20, -10]} scale={40} color="#ffffff" />
        <Lightformer intensity={1.2} position={[-20, 5, 10]} scale={20} color="#7fe3d4" />
        <Lightformer intensity={1.0} position={[20, 8, 8]} scale={20} color="#ffce7a" />
      </Environment>

      <Suspense fallback={null}>
        <SceneContents scroll={scroll} reducedMotion={reducedMotion} />
      </Suspense>
    </Canvas>
  );
}
