import type { ReactNode } from "react";

interface FloatingPanelProps {
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export default function FloatingPanel({ children, className = "", onClick }: FloatingPanelProps) {
  return (
    <div
      onClick={onClick}
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
