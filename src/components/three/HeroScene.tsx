'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import { Suspense, useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';

/**
 * WebGL ornament for the hero.
 *
 * A small cluster of glossy shapes lit like a product shot: one big azure
 * sphere, two satellites and a thin ring, drifting on the pointer. It reads as
 * daylight rather than as a nightclub, which is the whole point of a party that
 * starts at noon.
 *
 * Everything here is decorative. It mounts only after first paint, is skipped
 * entirely without WebGL or under reduced motion, and retires itself on a lost
 * context. The hero is complete without it.
 */

function detectWebGL(): boolean {
  try {
    if (!window.WebGLRenderingContext) return false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!context) return false;
    // Release the probe context immediately. Browsers cap the number of live
    // contexts (~16), and leaking one here can starve the real renderer.
    (context.getExtension('WEBGL_lose_context') as { loseContext(): void } | null)?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** The hero shape. Heavy damping on the pointer so it drifts rather than tracks. */
function Sphere({
  radius,
  color,
  position,
  roughness,
  drift,
}: {
  radius: number;
  color: string;
  position: [number, number, number];
  roughness: number;
  drift: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const home = useMemo(() => new THREE.Vector3(...position), [position]);

  useFrame((state, delta) => {
    if (!mesh.current) return;
    mesh.current.rotation.y += delta * 0.08;
    const { x, y } = state.pointer;
    mesh.current.position.x = THREE.MathUtils.lerp(
      mesh.current.position.x,
      home.x + x * drift,
      0.025,
    );
    mesh.current.position.y = THREE.MathUtils.lerp(
      mesh.current.position.y,
      home.y + y * drift * 0.6,
      0.025,
    );
  });

  return (
    <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.7}>
      <mesh ref={mesh} position={position} castShadow>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshPhysicalMaterial
          color={color}
          roughness={roughness}
          metalness={0.1}
          clearcoat={0.9}
          clearcoatRoughness={0.15}
          reflectivity={0.6}
        />
      </mesh>
    </Float>
  );
}

/** Thin ring, counter-rotating against the spheres to give the cluster depth. */
function Ring({ radius, speed, tilt }: { radius: number; speed: number; tilt: number }) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    mesh.current.rotation.z += delta * speed;
    mesh.current.rotation.x += delta * speed * 0.3;
  });

  return (
    <mesh ref={mesh} rotation={[tilt, 0, 0]}>
      <torusGeometry args={[radius, 0.026, 16, 128]} />
      <meshStandardMaterial color="#5a9ae8" roughness={0.3} metalness={0.55} />
    </mesh>
  );
}

export function HeroScene({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (reduce) return;
    // Defer past first paint so the WebGL context never competes with LCP.
    const id = window.setTimeout(() => setReady(detectWebGL()), 450);
    return () => window.clearTimeout(id);
  }, [reduce]);

  if (reduce || !ready) return null;

  return (
    <div className={className} aria-hidden>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 42 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        // Pointer events belong to the copy sitting over this canvas.
        style={{ pointerEvents: 'none' }}
        onCreated={({ gl }) => {
          // A GPU reset or tab-memory eviction fires this. Swallow the default
          // (which would throw on the next frame) and retire the scene quietly.
          gl.domElement.addEventListener(
            'webglcontextlost',
            (event) => {
              event.preventDefault();
              console.warn('[hero-webgl] context lost — scene retired');
              setReady(false);
            },
            { once: true },
          );
        }}
      >
        <Suspense fallback={null}>
          {/* Lit entirely with lights rather than drei's <Environment>: that
              helper fetches an HDR from a CDN at runtime, which the site's CSP
              blocks — and correctly so, an ornament has no business making a
              cross-origin request. A hemisphere fill plus two keys gets the
              same soft product-shot look with nothing to download. */}
          <hemisphereLight args={['#ffffff', '#7fa8d8', 0.7]} />
          <ambientLight intensity={0.25} />
          {/* One hard key does the modelling; everything else is fill. Lighting a
              sphere evenly from all sides is how you get a flat disc. */}
          <directionalLight position={[5, 7, 4]} intensity={3.4} color="#ffffff" />
          <directionalLight position={[-7, -1, 2]} intensity={0.7} color="#6f9fd8" />
          <pointLight position={[-2, -3, 5]} intensity={26} color="#c9b0ff" />
          <pointLight position={[4, 2, 6]} intensity={18} color="#ffffff" />

          <Sphere radius={1.65} color="#1268cd" position={[0.4, 0.1, 0]} roughness={0.16} drift={0.5} />
          <Sphere radius={0.62} color="#f0f7ff" position={[-2.3, 1.2, 1.4]} roughness={0.1} drift={0.9} />
          <Sphere radius={0.44} color="#3fcbe0" position={[2.5, -1.3, 0.9]} roughness={0.14} drift={1.2} />
          <Sphere radius={0.32} color="#8b5cf0" position={[-1.9, -1.7, 1.9]} roughness={0.2} drift={1.5} />
          <Sphere radius={0.24} color="#e1303c" position={[2.1, 1.9, 1.6]} roughness={0.22} drift={1.7} />

          <Ring radius={3.1} speed={0.07} tilt={1.2} />
          <Ring radius={3.9} speed={-0.05} tilt={-0.6} />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default HeroScene;
