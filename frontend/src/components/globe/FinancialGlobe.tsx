import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import GlobeEarth from "./GlobeEarth";
import CountryNode from "./CountryNode";
import FinancialArcs from "./FinancialArcs";
import GlobeInfoCard from "./GlobeInfoCard";
import { COUNTRIES, type CountryData } from "./types";

interface FinancialGlobeProps {
  onCountrySelect?: (country: CountryData) => void;
}

export default function FinancialGlobe({ onCountrySelect }: FinancialGlobeProps) {
  const [hoveredCountry, setHoveredCountry] = useState<CountryData | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);

  const activeCountry = hoveredCountry || selectedCountry;

  const handleSelectCountry = (country: CountryData) => {
    setSelectedCountry((prev) => (prev?.id === country.id ? null : country));
    if (onCountrySelect) {
      onCountrySelect(country);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      {/* Three.js Interactive 3D Canvas */}
      <Canvas
        camera={{
          position: [0, 0, 7.2],
          fov: 44,
        }}
        dpr={[1, 1.5]}
        onPointerMissed={() => setSelectedCountry(null)}
      >
        {/* Background color matching dark dashboard theme */}
        <color attach="background" args={["#030712"]} />

        {/* Ambient & Point Lighting */}
        <ambientLight intensity={0.6} />
        <pointLight position={[5, 4, 5]} intensity={7} color="#00e5ff" />
        <pointLight position={[-5, -3, 3]} intensity={4.5} color="#8b5cf6" />
        <directionalLight position={[0, 5, 5]} intensity={0.5} />

        {/* Starfield Background */}
        <Stars
          radius={70}
          depth={30}
          count={900}
          factor={2.2}
          saturation={0}
          fade
          speed={0.3}
        />

        {/* Transparent Wireframe Earth */}
        <GlobeEarth />

        {/* Financial Network Connection Arcs */}
        <FinancialArcs selectedCountryId={selectedCountry?.id || null} />

        {/* Interactive Global Country Nodes */}
        {COUNTRIES.map((country) => (
          <CountryNode
            key={country.id}
            country={country}
            isHovered={hoveredCountry?.id === country.id}
            isSelected={selectedCountry?.id === country.id}
            onHover={setHoveredCountry}
            onSelect={handleSelectCountry}
          />
        ))}
      </Canvas>

      {/* Floating Glassmorphism Country Info Card */}
      {activeCountry && (
        <GlobeInfoCard
          country={activeCountry}
          isPinned={Boolean(selectedCountry && selectedCountry.id === activeCountry.id)}
          onClose={() => setSelectedCountry(null)}
        />
      )}
    </div>
  );
}