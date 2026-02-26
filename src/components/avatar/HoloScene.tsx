import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

/**
 * HoloScene — 3D holographic avatar
 *
 * Current: Advanced procedural holographic orb with DNA helix, pulse ring,
 * and orbiting particles. Designed to feel like a living health entity.
 *
 * Future: Replace core orb with Gaussian Splatting photorealistic avatar
 * using @react-three/drei's Splat component when .splat model is available.
 *
 * Usage: <Splat src="/avatar.splat" alphaTest={0.1} />
 */

interface HoloSceneProps {
  /** 0-1 health adherence for visual feedback */
  healthScore?: number;
  /** Whether the agent is "speaking" (TTS active) */
  speaking?: boolean;
}

export function HoloScene({ healthScore = 0.7, speaking = false }: HoloSceneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);

  // Color based on health score
  const coreColor = useMemo(() => {
    if (healthScore >= 0.8) return "#64ffb4"; // green — great
    if (healthScore >= 0.5) return "#78c8ff"; // blue — normal
    return "#b48cff"; // purple — needs attention
  }, [healthScore]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // Gentle floating rotation
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.15;
      meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.05;
      // Breathing scale when speaking
      if (speaking) {
        const breathe = 1 + Math.sin(t * 4) * 0.05;
        meshRef.current.scale.setScalar(breathe);
      } else {
        meshRef.current.scale.setScalar(1);
      }
    }

    // Primary ring rotation
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.2;
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.5) * 0.1;
    }

    // Pulse ring — expands and fades
    if (pulseRef.current) {
      const cycle = (t * 0.5) % 1;
      const scale = 1 + cycle * 0.8;
      pulseRef.current.scale.setScalar(scale);
      (pulseRef.current.material as THREE.MeshStandardMaterial).opacity = (1 - cycle) * 0.3;
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
            color={coreColor}
            emissive={coreColor}
            emissiveIntensity={0.4}
            roughness={0.1}
            metalness={0.8}
            distort={speaking ? 0.25 : 0.15}
            speed={speaking ? 4 : 2}
            transparent
            opacity={0.75}
          />
        </mesh>
      </Float>

      {/* Inner glow sphere */}
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={0.8}
          transparent
          opacity={0.2}
        />
      </mesh>

      {/* Primary ring */}
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

      {/* Secondary ring — offset */}
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

      {/* Pulse ring — health heartbeat effect */}
      <mesh ref={pulseRef} position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.9, 0.008, 8, 64]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={1}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* DNA Helix particles */}
      <DNAHelix />

      {/* Orbiting particles */}
      {Array.from({ length: 8 }).map((_, i) => (
        <OrbitingParticle key={i} index={i} total={8} />
      ))}
    </>
  );
}

/** Double helix of small particles — represents health/DNA */
function DNAHelix() {
  const groupRef = useRef<THREE.Group>(null);
  const points = useMemo(() => {
    const pts: { x: number; y: number; z: number; strand: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * Math.PI * 4;
      const y = (i / 24) * 2 - 1;
      pts.push({ x: Math.cos(t) * 0.25, y: y * 0.6 + 0.2, z: Math.sin(t) * 0.25, strand: 0 });
      pts.push({ x: Math.cos(t + Math.PI) * 0.25, y: y * 0.6 + 0.2, z: Math.sin(t + Math.PI) * 0.25, strand: 1 });
    }
    return pts;
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      {points.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshStandardMaterial
            color={p.strand === 0 ? "#78c8ff" : "#b48cff"}
            emissive={p.strand === 0 ? "#78c8ff" : "#b48cff"}
            emissiveIntensity={0.8}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}
    </group>
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
      // Pulse opacity
      (ref.current.material as THREE.MeshStandardMaterial).opacity =
        0.5 + Math.sin(t * 3 + index * 0.8) * 0.3;
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
