import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Eye, EyeOff, Sparkles, Shield, LogIn } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#020617] overflow-hidden px-4">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-900/5 rounded-full blur-[180px] pointer-events-none" />

      {/* Animated grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(6,182,212,0.8) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(6,182,212,0.8) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-violet-500 rounded-xl blur opacity-50 animate-pulse" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-600/30 border border-cyan-400/40">
                <Shield className="h-6 w-6 text-cyan-400" />
              </div>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-black text-white tracking-tight">Audit V</h1>
              <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-widest">
                Financial Intelligence
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-400">Sign in to your personal workspace</p>
        </div>

        {/* Glass card */}
        <div className="relative bg-slate-900/60 border border-white/10 rounded-3xl p-8 shadow-[0_0_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          {/* Top shimmer line */}
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm animate-in slide-in-from-top-1 duration-200">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="login-username" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Username
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="your_username"
                className="w-full rounded-xl border border-slate-700/70 bg-slate-800/60 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-cyan-400/60 focus:bg-slate-800/80 focus:ring-1 focus:ring-cyan-400/20"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-800/60 px-4 py-3 pr-11 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-cyan-400/60 focus:bg-slate-800/80 focus:ring-1 focus:ring-cyan-400/20"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-blue-500 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign In
                </>
              )}
            </button>

            {/* Quick Demo Sign-In */}
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setUsername("testuser1");
                setPassword("PassWord123@");
                setError(null);
                setLoading(true);
                try {
                  await login("testuser1", "PassWord123@");
                  navigate("/dashboard", { replace: true });
                } catch (err: any) {
                  setError(err?.message || "Demo login failed");
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 font-semibold text-xs hover:bg-cyan-500/20 transition-all"
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              One-Click Demo Sign-In (testuser1)
            </button>
          </form>

          {/* Footer divider */}
          <div className="relative my-6 flex items-center">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="mx-3 text-xs text-slate-500">or</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Register link */}
          <p className="text-center text-sm text-slate-400">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Create one free
            </Link>
          </p>
        </div>

        {/* Bottom badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-cyan-500/60" />
          Powered by AI · End-to-end encrypted workspace
        </div>
      </div>
    </div>
  );
}
