'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Environment, MeshDistortMaterial } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import { Suspense, useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';

/**
 * WebGL backdrop for the hero.
 *
 * Everything here is decorative. It sits behind the copy at low opacity, mounts
 * only after the page is interactive, and is skipped entirely when the device
 * cannot do WebGL or the user prefers reduced motion — the hero reads perfectly
 * well as flat gradients, so this never becomes a dependency for content.
 */

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    );
  } catch {
    return false;
  }
}

/** Slow-rotating distorted sphere — the main light source of the composition. */
function Orb() {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (!mesh.current) return;
    mesh.current.rotation.y += delta * 0.12;
    mesh.current.rotation.z += delta * 0.05;
    // Drift with the pointer, heavily damped so it never feels twitchy.
    const { x, y } = state.pointer;
    mesh.current.position.x = THREE.MathUtils.lerp(mesh.current.position.x, x * 0.4, 0.02);
    mesh.current.position.y = THREE.MathUtils.lerp(mesh.current.position.y, y * 0.25, 0.02);
  });

  return (
    <Float speed={1.2} rotationIntensity={0.35} floatIntensity={0.9}>
      <mesh ref={mesh} scale={2.35}>
        <icosahedronGeometry args={[1, 24]} />
        <MeshDistortMaterial
          color="#1f6bff"
          distort={0.42}
          speed={1.4}
          roughness={0.18}
          metalness={0.85}
          emissive="#0a2f8a"
          emissiveIntensity={0.5}
        />
      </mesh>
    </Float>
  );
}

/** Wireframe torus, counter-rotating against the orb to give the scene depth. */
function Ring({ radius, tube, speed, tilt }: { radius: number; tube: number; speed: number; tilt: number }) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    mesh.current.rotation.z += delta * speed;
    mesh.current.rotation.x += delta * speed * 0.35;
  });

  return (
    <mesh ref={mesh} rotation={[tilt, 0, 0]}>
      <torusGeometry args={[radius, tube, 12, 96]} />
      <meshStandardMaterial
        color="#38dcf5"
        wireframe
        transparent
        opacity={0.28}
        emissive="#12c2e9"
        emissiveIntensity={0.4}
      />
    </mesh>
  );
}

/** Drifting point field. Positions are generated once and never re-allocated. */
function Particles({ count = 420 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      // Spherical shell distribution — a cube would visibly stack at the corners.
      const radius = 4 + Math.random() * 5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      array[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      array[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      array[i * 3 + 2] = radius * Math.cos(phi);
    }
    return array;
  }, [count]);

  useFrame((_, delta) => {
    if (points.current) points.current.rotation.y += delta * 0.02;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color="#7db6ff"
        transparent
        opacity={0.65}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export function HeroScene({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (reduce) return;
    // Defer past first paint so the WebGL context never competes with LCP.
    const id = window.setTimeout(() => setReady(detectWebGL()), 400);
    return () => window.clearTimeout(id);
  }, [reduce]);

  if (reduce || !ready) return null;

  return (
    <div className={className} aria-hidden>
      <Canvas
        camera={{ position: [0, 0, 7.5], fov: 45 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        // Pointer events belong to the copy sitting on top of this canvas.
        style={{ pointerEvents: 'none' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={1.6} color="#7db6ff" />
          <pointLight position={[-6, -3, -4]} intensity={2.4} color="#12c2e9" />
          <Orb />
          <Ring radius={3.4} tube={0.012} speed={0.09} tilt={1.15} />
          <Ring radius={4.2} tube={0.01} speed={-0.06} tilt={-0.7} />
          <Particles />
          <Environment preset="night" />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default HeroScene;
