"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Center, Environment, Float, Lightformer, useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = "/models/flying-island.glb";
useGLTF.preload(MODEL_URL);

/**
 * Landing hero backdrop: the flying island sits centred at the origin while the
 * camera revolves around it on scroll. Motion is buttery because the camera is
 * NEVER bound to raw scroll — a target is derived from scroll and the actual
 * camera spherical coords are exponentially damped toward it every frame
 * (frame-rate independent), on top of Lenis-smoothed page scrolling.
 */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function IslandModel({ reducedMotion }: { reducedMotion: boolean }) {
  const { scene } = useGLTF(MODEL_URL);
  const spin = useRef<THREE.Group>(null);

  // Fit the model to a consistent size regardless of its authored scale.
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    return 6.2 / maxDim;
  }, [scene]);

  useFrame((_, dt) => {
    if (spin.current && !reducedMotion) spin.current.rotation.y += dt * 0.05;
  });

  return (
    <Float
      speed={reducedMotion ? 0 : 1.1}
      rotationIntensity={reducedMotion ? 0 : 0.12}
      floatIntensity={reducedMotion ? 0 : 0.55}
    >
      <group ref={spin}>
        <Center>
          <primitive object={scene} scale={fit} />
        </Center>
      </group>
    </Float>
  );
}

function CameraRig({
  scroll,
  reducedMotion,
}: {
  scroll: MutableRefObject<number>;
  reducedMotion: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const cur = useRef({ theta: 0.35, y: 1.7, r: 8.4 });

  useFrame((_, dt) => {
    const p = reducedMotion ? 0.08 : THREE.MathUtils.clamp(scroll.current, 0, 1);
    // One smooth full revolution across the whole landing scroll, plus a gentle
    // vertical arc and a subtle mid-scroll dolly-in.
    const targetTheta = 0.35 + p * Math.PI * 2;
    const targetY = 1.7 - p * 2.4;
    const targetR = 8.4 - Math.sin(p * Math.PI) * 1.2;

    const lambda = 3.5;
    const d = Math.min(dt, 0.05); // clamp dt to avoid jumps after tab-switch
    cur.current.theta = THREE.MathUtils.damp(cur.current.theta, targetTheta, lambda, d);
    cur.current.y = THREE.MathUtils.damp(cur.current.y, targetY, lambda, d);
    cur.current.r = THREE.MathUtils.damp(cur.current.r, targetR, lambda, d);

    const { theta, y, r } = cur.current;
    camera.position.set(Math.sin(theta) * r, y, Math.cos(theta) * r);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Dust({ scroll }: { scroll: MutableRefObject<number> }) {
  const ref = useRef<THREE.Points>(null);
  const count = 420;
  const positions = useMemo(() => {
    const rand = mulberry32(90210);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 3 + rand() * 6;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.02;
    (ref.current.material as THREE.PointsMaterial).opacity = 0.35 - scroll.current * 0.2;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#24bfa9" transparent opacity={0.35} sizeAttenuation depthWrite={false} />
    </points>
  );
}

export default function IslandScene({
  scroll,
  reducedMotion = false,
  maxDpr = 1.75,
}: {
  scroll: MutableRefObject<number>;
  reducedMotion?: boolean;
  maxDpr?: number;
}) {
  return (
    <Canvas
      camera={{ position: [2.9, 1.7, 7.9], fov: 42 }}
      dpr={[1, maxDpr]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#dff3ee", "#e7d9c2", 0.6]} />
      <directionalLight position={[5, 8, 5]} intensity={1.25} color="#ffffff" />
      <pointLight position={[-6, 2, -4]} intensity={35} color="#24bfa9" />
      <pointLight position={[6, 3, 3]} intensity={22} color="#ecb457" />

      {/* Baked once, no external HDR — subtle reflections, offline/CSP safe. */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.2} position={[0, 6, -6]} scale={12} color="#ffffff" />
        <Lightformer intensity={1.1} position={[-6, 1, 2]} scale={8} color="#24bfa9" />
        <Lightformer intensity={0.9} position={[6, 2, 3]} scale={8} color="#ecb457" />
      </Environment>

      <IslandModel reducedMotion={reducedMotion} />
      <Dust scroll={scroll} />
      <CameraRig scroll={scroll} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
