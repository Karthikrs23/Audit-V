import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Eye, EyeOff, Sparkles, Shield, UserPlus, CheckCircle2 } from "lucide-react";

const PASSWORD_RULES = [
  { label: "At least 6 characters", test: (p: string) => p.length >= 6 },
  { label: "Contains a number", test: (p: string) => /\d/.test(p) },
  { label: "Contains a letter", test: (p: string) => /[a-zA-Z]/.test(p) },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({ username, email, full_name: fullName || undefined, password });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#020617] overflow-hidden px-4 py-8">
      {/* Ambient glows */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-violet-500/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-cyan-600/8 rounded-full blur-[120px] pointer-events-none" />

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(139,92,246,0.8) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(139,92,246,0.8) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-400 to-cyan-500 rounded-xl blur opacity-50 animate-pulse" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-600/30 border border-violet-400/40">
                <Shield className="h-6 w-6 text-violet-400" />
              </div>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-black text-white tracking-tight">Audit V</h1>
              <p className="text-[11px] font-semibold text-violet-400 uppercase tracking-widest">
                Create Your Account
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-400">
            Your personal financial intelligence workspace
          </p>
        </div>

        {/* Card */}
        <div className="relative bg-slate-900/60 border border-white/10 rounded-3xl p-8 shadow-[0_0_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm animate-in slide-in-from-top-1 duration-200">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Full Name */}
            <div className="space-y-1.5">
              <label htmlFor="reg-fullname" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Full Name <span className="text-slate-600 normal-case">(optional)</span>
              </label>
              <input
                id="reg-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full rounded-xl border border-slate-700/70 bg-slate-800/60 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-violet-400/60 focus:bg-slate-800/80 focus:ring-1 focus:ring-violet-400/20"
              />
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="reg-username" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Username
              </label>
              <input
                id="reg-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                placeholder="jane_smith"
                className="w-full rounded-xl border border-slate-700/70 bg-slate-800/60 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-violet-400/60 focus:bg-slate-800/80 focus:ring-1 focus:ring-violet-400/20"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="reg-email" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Email
              </label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="jane@company.com"
                className="w-full rounded-xl border border-slate-700/70 bg-slate-800/60 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-violet-400/60 focus:bg-slate-800/80 focus:ring-1 focus:ring-violet-400/20"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="reg-password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPass ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-700/70 bg-slate-800/60 px-4 py-3 pr-11 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-violet-400/60 focus:bg-slate-800/80 focus:ring-1 focus:ring-violet-400/20"
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

              {/* Password strength indicators */}
              {password.length > 0 && (
                <div className="grid grid-cols-1 gap-1 pt-1">
                  {PASSWORD_RULES.map((rule) => (
                    <div key={rule.label} className="flex items-center gap-1.5 text-[11px]">
                      <CheckCircle2
                        className={`h-3.5 w-3.5 flex-shrink-0 transition-colors ${
                          rule.test(password) ? "text-emerald-400" : "text-slate-600"
                        }`}
                      />
                      <span className={rule.test(password) ? "text-emerald-400" : "text-slate-500"}>
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 mt-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/25 hover:from-violet-400 hover:to-cyan-500 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Create Account
                </>
              )}
            </button>
          </form>

          <div className="relative my-6 flex items-center">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="mx-3 text-xs text-slate-500">or</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <p className="text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-violet-400 hover:text-violet-300 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-violet-500/60" />
          Your data is stored privately and securely per account
        </div>
      </div>
    </div>
  );
}
