"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Icosahedron, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

/**
 * Scroll-reactive hero scene. A distorted "pulse" core (the living rural
 * economy) wrapped in a wireframe shell, orbited by a field of signal points
 * (UPI / market / climate data). All lighting is explicit — no CDN HDRs — so it
 * renders offline and passes strict CSP.
 */

function SignalField({ scroll }: { scroll: MutableRefObject<number> }) {
  const ref = useRef<THREE.Points>(null);
  const count = 1100;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2.4 + Math.random() * 3.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.04;
    ref.current.rotation.x += delta * 0.015;
    const s = 1 + scroll.current * 0.5;
    ref.current.scale.setScalar(s);
    (ref.current.material as THREE.PointsMaterial).opacity = 0.55 - scroll.current * 0.3;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color="#24bfa9"
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function Core({ scroll }: { scroll: MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.18;
    const s = 1 - scroll.current * 0.35;
    group.current.scale.setScalar(THREE.MathUtils.clamp(s, 0.4, 1));
    group.current.position.y = -scroll.current * 1.2;
    group.current.rotation.z = scroll.current * 0.6;
  });

  return (
    <group ref={group}>
      <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.7}>
        <Icosahedron args={[1.5, 6]}>
          <MeshDistortMaterial
            color="#0f8074"
            emissive="#0a5a51"
            emissiveIntensity={0.35}
            roughness={0.18}
            metalness={0.45}
            distort={0.38}
            speed={1.6}
          />
        </Icosahedron>
        <Icosahedron args={[1.85, 2]}>
          <meshBasicMaterial color="#24bfa9" wireframe transparent opacity={0.14} />
        </Icosahedron>
      </Float>
    </group>
  );
}

export default function HeroScene({ scroll }: { scroll: MutableRefObject<number> }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 6.5], fov: 45 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 5]} intensity={1.4} color="#ffffff" />
      <pointLight position={[-5, -2, -3]} intensity={40} color="#24bfa9" />
      <pointLight position={[5, 3, 2]} intensity={30} color="#ecb457" />
      <Core scroll={scroll} />
      <SignalField scroll={scroll} />
    </Canvas>
  );
}
