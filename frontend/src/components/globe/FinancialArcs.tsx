import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { COUNTRIES, CONNECTIONS, type CountryData } from "./types";

interface ArcData {
  points: [number, number, number][];
  curve: THREE.QuadraticBezierCurve3;
  color: string;
  fromId: string;
  toId: string;
}

export default function FinancialArcs({
  selectedCountryId,
}: {
  selectedCountryId: string | null;
}) {
  const countryMap = useMemo(() => {
    const map = new Map<string, CountryData>();
    COUNTRIES.forEach((c) => map.set(c.id, c));
    return map;
  }, []);

  const arcs = useMemo<ArcData[]>(() => {
    const list: ArcData[] = [];

    CONNECTIONS.forEach((conn) => {
      const fromC = countryMap.get(conn.from);
      const toC = countryMap.get(conn.to);

      if (fromC && toC) {
        const start = new THREE.Vector3(...fromC.position);
        const end = new THREE.Vector3(...toC.position);

        // Calculate elevated midpoint along normal
        const middle = start.clone().add(end).multiplyScalar(0.5);
        const normal = middle.clone().normalize();
        middle.add(normal.multiplyScalar(0.45));

        const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
        const sampledPoints = curve.getPoints(36).map(
          (p) => [p.x, p.y, p.z] as [number, number, number]
        );

        list.push({
          points: sampledPoints,
          curve,
          color: conn.color || "#00e5ff",
          fromId: conn.from,
          toId: conn.to,
        });
      }
    });

    return list;
  }, [countryMap]);

  // Particle instances moving along curves
  const particleGroupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!particleGroupRef.current) return;
    const time = clock.getElapsedTime();

    particleGroupRef.current.children.forEach((mesh, index) => {
      const arc = arcs[index];
      if (arc) {
        const speed = 0.35 + (index % 3) * 0.08;
        const progress = (time * speed) % 1;
        const pt = arc.curve.getPoint(progress);
        mesh.position.set(pt.x, pt.y, pt.z);
      }
    });
  });

  return (
    <group>
      {/* 1. Base Static Curved Lines */}
      {arcs.map((arc, idx) => {
        const isHighlighted =
          selectedCountryId !== null &&
          (arc.fromId === selectedCountryId || arc.toId === selectedCountryId);

        return (
          <Line
            key={idx}
            points={arc.points}
            color={isHighlighted ? "#00ffff" : arc.color}
            transparent
            opacity={isHighlighted ? 0.75 : 0.28}
            lineWidth={isHighlighted ? 2 : 1}
          />
        );
      })}

      {/* 2. Traveling Pulse Light Particles */}
      <group ref={particleGroupRef}>
        {arcs.map((arc, idx) => (
          <mesh key={idx}>
            <sphereGeometry args={[0.025, 12, 12]} />
            <meshBasicMaterial
              color={arc.color}
              transparent
              opacity={0.85}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
