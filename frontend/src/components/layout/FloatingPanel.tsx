import type { ReactNode } from "react";

interface FloatingPanelProps {
  children: ReactNode;
  className?: string;
}

export default function FloatingPanel({ children, className = "" }: FloatingPanelProps) {
  return (
    <div
      className={`
        relative rounded-3xl border border-white/10
        bg-[#030712]/75 backdrop-blur-2xl
        shadow-[0_20px_50px_rgba(0,0,0,0.5)]
        p-6 sm:p-8 lg:p-10
        transition-all duration-300
        ${className}
      `}
    >
      {children}
    </div>
  );
}
