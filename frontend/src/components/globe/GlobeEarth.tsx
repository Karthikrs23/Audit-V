import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function GlobeEarth() {
  const globeGroupRef = useRef<THREE.Group>(null);
  const orbit1Ref = useRef<THREE.Mesh>(null);
  const orbit2Ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (globeGroupRef.current) {
      // Continuous smooth automatic rotation on Y axis
      globeGroupRef.current.rotation.y += delta * 0.1;
    }

    if (orbit1Ref.current) {
      orbit1Ref.current.rotation.z += delta * 0.04;
    }

    if (orbit2Ref.current) {
      orbit2Ref.current.rotation.z -= delta * 0.03;
    }
  });

  return (
    <group ref={globeGroupRef}>
      {/* 1. Semi-Transparent Dark Inner Earth Core */}
      <mesh>
        <sphereGeometry args={[2.8, 48, 48]} />
        <meshStandardMaterial
          color="#061226"
          emissive="#03182e"
          emissiveIntensity={0.5}
          roughness={0.8}
          metalness={0.4}
          transparent
          opacity={0.28}
        />
      </mesh>

      {/* 2. Technical Latitude & Longitude Wireframe Grid */}
      <mesh>
        <sphereGeometry args={[2.808, 40, 24]} />
        <meshBasicMaterial
          color="#00e5ff"
          wireframe
          transparent
          opacity={0.14}
        />
      </mesh>

      {/* 3. Secondary Violet Grid Accents */}
      <mesh>
        <sphereGeometry args={[2.814, 20, 12]} />
        <meshBasicMaterial
          color="#8b5cf6"
          wireframe
          transparent
          opacity={0.09}
        />
      </mesh>

      {/* 4. Outer Cyan Atmospheric Glow Shell */}
      <mesh scale={1.06}>
        <sphereGeometry args={[2.8, 48, 48]} />
        <meshBasicMaterial
          color="#00e5ff"
          transparent
          opacity={0.07}
          side={THREE.BackSide}
        />
      </mesh>

      {/* 5. Outer Violet Atmospheric Glow Shell */}
      <mesh scale={1.12}>
        <sphereGeometry args={[2.8, 48, 48]} />
        <meshBasicMaterial
          color="#8b5cf6"
          transparent
          opacity={0.04}
          side={THREE.BackSide}
        />
      </mesh>

      {/* 6. Orbital Ring 1 (Cyan) */}
      <mesh ref={orbit1Ref} rotation={[Math.PI / 2.5, Math.PI / 6, 0]}>
        <torusGeometry args={[3.35, 0.007, 16, 128]} />
        <meshBasicMaterial
          color="#00e5ff"
          transparent
          opacity={0.32}
        />
      </mesh>

      {/* 7. Orbital Ring 2 (Violet) */}
      <mesh ref={orbit2Ref} rotation={[Math.PI / 3, -Math.PI / 4, 0]}>
        <torusGeometry args={[3.65, 0.005, 16, 128]} />
        <meshBasicMaterial
          color="#8b5cf6"
          transparent
          opacity={0.24}
        />
      </mesh>
    </group>
  );
}
