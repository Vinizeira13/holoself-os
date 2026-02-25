import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

/**
 * HoloScene — 3D holographic avatar placeholder
 *
 * Phase 1: Animated holographic orb representing the agent's presence.
 * Phase 2: Will be replaced with Gaussian Splatting photorealistic avatar
 * using @react-three/drei's Splat component.
 */
export function HoloScene() {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // Gentle floating rotation
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.15;
      meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.05;
    }

    // Ring rotation
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.2;
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.5) * 0.1;
    }
  });

  return (
    <>
      {/* Ambient lighting — soft, no harsh shadows */}
      <ambientLight intensity={0.3} color="#78c8ff" />
      <pointLight position={[2, 3, 4]} intensity={0.8} color="#78c8ff" />
      <pointLight position={[-2, -1, 3]} intensity={0.4} color="#b48cff" />

      {/* Core holographic orb */}
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
        <mesh ref={meshRef} position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.6, 64, 64]} />
          <MeshDistortMaterial
            color="#78c8ff"
            emissive="#78c8ff"
            emissiveIntensity={0.3}
            roughness={0.1}
            metalness={0.8}
            distort={0.15}
            speed={2}
            transparent
            opacity={0.7}
          />
        </mesh>
      </Float>

      {/* Holographic ring */}
      <mesh ref={ringRef} position={[0, 0.2, 0]}>
        <torusGeometry args={[0.9, 0.015, 16, 100]} />
        <meshStandardMaterial
          color="#64ffb4"
          emissive="#64ffb4"
          emissiveIntensity={0.5}
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Second ring — offset */}
      <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 3, 0, Math.PI / 6]}>
        <torusGeometry args={[1.05, 0.01, 16, 100]} />
        <meshStandardMaterial
          color="#b48cff"
          emissive="#b48cff"
          emissiveIntensity={0.4}
          transparent
          opacity={0.35}
        />
      </mesh>

      {/* Particle-like small spheres orbiting */}
      {Array.from({ length: 8 }).map((_, i) => (
        <OrbitingParticle key={i} index={i} total={8} />
      ))}
    </>
  );
}

function OrbitingParticle({ index, total }: { index: number; total: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const angle = (index / total) * Math.PI * 2;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const radius = 1.3;
    const speed = 0.4;
    const a = angle + t * speed;

    if (ref.current) {
      ref.current.position.x = Math.cos(a) * radius;
      ref.current.position.z = Math.sin(a) * radius;
      ref.current.position.y = 0.2 + Math.sin(t * 2 + index) * 0.15;
    }
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.025, 16, 16]} />
      <meshStandardMaterial
        color="#78c8ff"
        emissive="#78c8ff"
        emissiveIntensity={1}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}
