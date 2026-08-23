import FinancialGlobe from "../globe/FinancialGlobe";

export default function GlobalBackground() {
  return (
    <div className="fixed inset-0 z-0 h-screen w-screen overflow-hidden bg-[#030712] select-none">
      {/* 1. Ambient Background Lighting Glows */}
      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
        <div className="absolute left-[15%] top-[10%] h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[180px]" />
        <div className="absolute right-[10%] top-[25%] h-[600px] w-[600px] rounded-full bg-violet-600/10 blur-[200px]" />
        <div className="absolute bottom-[10%] left-[30%] h-[400px] w-[400px] rounded-full bg-cyan-600/5 blur-[160px]" />
      </div>

      {/* 2. Full-Viewport Persistent 3D Globe Canvas */}
      <div className="absolute inset-0 z-[2]">
        <FinancialGlobe />
      </div>

      {/* 3. Global Atmospheric Vignette Overlay */}
      <div className="pointer-events-none absolute inset-0 z-[3] bg-radial from-transparent via-[#030712]/40 to-[#030712]/85" />
    </div>
  );
}
