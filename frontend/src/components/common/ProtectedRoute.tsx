/**
 * ProtectedRoute — redirects unauthenticated users to /login.
 * Shows a loading spinner while the auth state is being resolved from localStorage.
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ErrorBoundary from "./ErrorBoundary";

interface Props {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#020617]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            <div className="absolute inset-0 rounded-full bg-cyan-500/5 blur-sm" />
          </div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest animate-pulse">
            Verifying session…
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <ErrorBoundary>{children}</ErrorBoundary>;
}
