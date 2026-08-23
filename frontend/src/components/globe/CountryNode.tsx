import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Line } from "@react-three/drei";
import * as THREE from "three";
import type { CountryData } from "./types";

interface CountryNodeProps {
  country: CountryData;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (country: CountryData | null) => void;
  onSelect: (country: CountryData) => void;
}

export default function CountryNode({
  country,
  isHovered,
  isSelected,
  onHover,
  onSelect,
}: CountryNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const pulseRef = useRef<THREE.Mesh>(null);

  const activeColor = isSelected ? "#00ffff" : isHovered ? "#38bdf8" : country.color;
  const scaleMultiplier = isSelected ? 1.6 : isHovered ? 1.3 : 1.0;

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    if (groupRef.current) {
      // Subtle float animation
      groupRef.current.position.y =
        country.position[1] + Math.sin(time * 1.8 + country.position[0]) * 0.015;
    }

    if (pulseRef.current) {
      const pulseScale = (1 + Math.sin(time * 3.5 + country.position[0]) * 0.3) * scaleMultiplier;
      pulseRef.current.scale.set(pulseScale, pulseScale, pulseScale);
    }
  });

  // Calculate outward vector for light beam ray
  const positionVec = new THREE.Vector3(...country.position);
  const normalVec = positionVec.clone().normalize();
  const beamEndPos = positionVec.clone().add(normalVec.clone().multiplyScalar(0.22));

  const beamPoints = [
    [positionVec.x, positionVec.y, positionVec.z] as [number, number, number],
    [beamEndPos.x, beamEndPos.y, beamEndPos.z] as [number, number, number],
  ];

  return (
    <group
      ref={groupRef}
      position={country.position}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(country);
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(country);
      }}
    >
      {/* 1. Outer Pulse Aura Sphere */}
      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshBasicMaterial
          color={activeColor}
          transparent
          opacity={isSelected ? 0.45 : isHovered ? 0.35 : 0.22}
        />
      </mesh>

      {/* 2. Core Solid Node Point */}
      <mesh>
        <sphereGeometry args={[0.04 * scaleMultiplier, 20, 20]} />
        <meshBasicMaterial color={activeColor} />
      </mesh>

      {/* 3. Outward Light Ray Beam Line */}
      <Line
        points={beamPoints}
        color={activeColor}
        transparent
        opacity={isSelected ? 0.8 : isHovered ? 0.6 : 0.3}
        lineWidth={1.5}
      />

      {/* 4. Highlighted Selection Ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.09, 0.11, 24]} />
          <meshBasicMaterial color="#00e5ff" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* 5. Currency Symbol Label */}
      <Text
        position={[0.1, 0.08, 0]}
        fontSize={0.11}
        color={activeColor}
        anchorX="left"
        anchorY="middle"
        outlineWidth={0.015}
        outlineColor="#030712"
      >
        {country.currencySymbol}
      </Text>

      {/* 6. Country Code Label */}
      <Text
        position={[0.1, -0.06, 0]}
        fontSize={0.065}
        color={isSelected || isHovered ? "#ffffff" : "#cbd5e1"}
        anchorX="left"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#030712"
      >
        {country.code}
      </Text>
    </group>
  );
}
