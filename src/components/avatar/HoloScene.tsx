import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

/**
 * HoloScene — Jarvis-style holographic avatar
 *
 * Intense neon aesthetic with multiple light sources, double helix DNA,
 * expanding pulse rings, and orbiting data particles.
 *
 * Future: Replace core orb with Gaussian Splatting
 * via @react-three/drei's Splat component
 */

interface HoloSceneProps {
  healthScore?: number;
  speaking?: boolean;
}

export function HoloScene({ healthScore = 0.7, speaking = false }: HoloSceneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
  const pulse1Ref = useRef<THREE.Mesh>(null);
  const pulse2Ref = useRef<THREE.Mesh>(null);

  const coreColor = useMemo(() => {
    if (healthScore >= 0.8) return "#64ffb4";
    if (healthScore >= 0.5) return "#78c8ff";
    return "#b48cff";
  }, [healthScore]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // Core orb rotation + breathing
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.12;
      meshRef.current.rotation.x = Math.sin(t * 0.25) * 0.08;
      const breatheBase = speaking ? 0.08 : 0.02;
      const breatheSpeed = speaking ? 5 : 1.5;
      meshRef.current.scale.setScalar(1 + Math.sin(t * breatheSpeed) * breatheBase);
    }

    // Three rings at different speeds and angles
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = t * 0.25;
      ring1Ref.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.4) * 0.12;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -t * 0.15;
      ring2Ref.current.rotation.y = t * 0.1;
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.x = t * 0.18;
      ring3Ref.current.rotation.z = Math.sin(t * 0.3) * 0.2;
    }

    // Dual pulse rings
    [pulse1Ref, pulse2Ref].forEach((ref, i) => {
      if (ref.current) {
        const offset = i * 0.5;
        const cycle = ((t * 0.4 + offset) % 1);
        ref.current.scale.setScalar(1 + cycle * 1.2);
        (ref.current.material as THREE.MeshStandardMaterial).opacity = (1 - cycle) * 0.25;
      }
    });
  });

  return (
    <>
      {/* Lighting — multi-source for depth */}
      <ambientLight intensity={0.15} color="#78c8ff" />
      <pointLight position={[2, 3, 4]} intensity={1.2} color="#78c8ff" distance={10} decay={2} />
      <pointLight position={[-3, -1, 3]} intensity={0.6} color="#b48cff" distance={8} decay={2} />
      <pointLight position={[0, -2, 2]} intensity={0.4} color="#64ffb4" distance={6} decay={2} />
      {/* Rim light for edge glow */}
      <pointLight position={[0, 0, -3]} intensity={0.8} color="#78c8ff" distance={8} decay={2} />

      {/* Core holographic orb */}
      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.4}>
        <mesh ref={meshRef} position={[0, 0, 0]}>
          <sphereGeometry args={[0.55, 64, 64]} />
          <MeshDistortMaterial
            color={coreColor}
            emissive={coreColor}
            emissiveIntensity={0.6}
            roughness={0.05}
            metalness={0.9}
            distort={speaking ? 0.3 : 0.18}
            speed={speaking ? 5 : 2.5}
            transparent
            opacity={0.8}
          />
        </mesh>
      </Float>

      {/* Inner glow core */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={1.2}
          transparent
          opacity={0.15}
        />
      </mesh>

      {/* Outer glow (large, faint) */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={0.4}
          transparent
          opacity={0.06}
        />
      </mesh>

      {/* Ring 1 — Primary equatorial */}
      <mesh ref={ring1Ref} position={[0, 0, 0]}>
        <torusGeometry args={[0.85, 0.012, 16, 128]} />
        <meshStandardMaterial
          color="#64ffb4"
          emissive="#64ffb4"
          emissiveIntensity={0.8}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Ring 2 — Tilted secondary */}
      <mesh ref={ring2Ref} position={[0, 0, 0]} rotation={[Math.PI / 3, 0, Math.PI / 6]}>
        <torusGeometry args={[1.0, 0.008, 16, 128]} />
        <meshStandardMaterial
          color="#b48cff"
          emissive="#b48cff"
          emissiveIntensity={0.7}
          transparent
          opacity={0.45}
        />
      </mesh>

      {/* Ring 3 — Perpendicular accent */}
      <mesh ref={ring3Ref} position={[0, 0, 0]} rotation={[Math.PI / 2, Math.PI / 4, 0]}>
        <torusGeometry args={[1.15, 0.006, 16, 128]} />
        <meshStandardMaterial
          color="#78c8ff"
          emissive="#78c8ff"
          emissiveIntensity={0.5}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Pulse ring 1 */}
      <mesh ref={pulse1Ref} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.85, 0.006, 8, 64]} />
        <meshStandardMaterial color={coreColor} emissive={coreColor} emissiveIntensity={1.5} transparent opacity={0.25} />
      </mesh>

      {/* Pulse ring 2 (offset phase) */}
      <mesh ref={pulse2Ref} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.85, 0.004, 8, 64]} />
        <meshStandardMaterial color={coreColor} emissive={coreColor} emissiveIntensity={1} transparent opacity={0.15} />
      </mesh>

      {/* DNA Helix */}
      <DNAHelix color1="#78c8ff" color2="#b48cff" />

      {/* Orbiting data particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <DataParticle key={i} index={i} total={12} />
      ))}

      {/* Floating micro particles (ambient dust) */}
      {Array.from({ length: 20 }).map((_, i) => (
        <MicroParticle key={`micro-${i}`} index={i} />
      ))}
    </>
  );
}

/** DNA double helix — rotating around the orb */
function DNAHelix({ color1, color2 }: { color1: string; color2: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const points = useMemo(() => {
    const pts: { x: number; y: number; z: number; strand: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const t = (i / 30) * Math.PI * 5;
      const y = (i / 30) * 1.4 - 0.7;
      const r = 0.22;
      pts.push({ x: Math.cos(t) * r, y, z: Math.sin(t) * r, strand: 0 });
      pts.push({ x: Math.cos(t + Math.PI) * r, y, z: Math.sin(t + Math.PI) * r, strand: 1 });
    }
    return pts;
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.4;
    }
  });

  return (
    <group ref={groupRef}>
      {points.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[0.01, 8, 8]} />
          <meshStandardMaterial
            color={p.strand === 0 ? color1 : color2}
            emissive={p.strand === 0 ? color1 : color2}
            emissiveIntensity={1.2}
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Orbiting data particles — larger, brighter */
function DataParticle({ index, total }: { index: number; total: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const angle = (index / total) * Math.PI * 2;
  const orbitRadius = 1.1 + (index % 3) * 0.2;
  const speed = 0.3 + (index % 2) * 0.15;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const a = angle + t * speed;

    if (ref.current) {
      ref.current.position.x = Math.cos(a) * orbitRadius;
      ref.current.position.z = Math.sin(a) * orbitRadius;
      ref.current.position.y = Math.sin(t * 1.5 + index * 0.7) * 0.2;
      // Pulse brightness
      (ref.current.material as THREE.MeshStandardMaterial).opacity =
        0.4 + Math.sin(t * 2.5 + index) * 0.35;
    }
  });

  const colors = ["#78c8ff", "#64ffb4", "#b48cff"];
  const color = colors[index % 3];

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.02, 12, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.5}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

/** Ambient floating micro particles */
function MicroParticle({ index }: { index: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const startPos = useMemo(() => ({
    x: (Math.random() - 0.5) * 4,
    y: (Math.random() - 0.5) * 3,
    z: (Math.random() - 0.5) * 3,
  }), []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ref.current) {
      ref.current.position.x = startPos.x + Math.sin(t * 0.2 + index) * 0.3;
      ref.current.position.y = startPos.y + Math.cos(t * 0.15 + index * 0.5) * 0.2;
      ref.current.position.z = startPos.z;
      (ref.current.material as THREE.MeshBasicMaterial).opacity =
        0.15 + Math.sin(t * 0.8 + index * 1.2) * 0.1;
    }
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.006, 6, 6]} />
      <meshBasicMaterial
        color="#78c8ff"
        transparent
        opacity={0.2}
      />
    </mesh>
  );
}
