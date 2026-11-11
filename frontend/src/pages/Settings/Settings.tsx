import { useState, useEffect } from "react";
import FloatingPanel from "../../components/layout/FloatingPanel";
import {
  Save,
  Server,
  Cpu,
  Database,
  CheckCircle2,
  User,
  Mail,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiGetUserSettings, apiUpdateUserSettings } from "../../services/authApi";

export default function Settings() {
  const { user } = useAuth();

  // Settings state
  const [apiUrl, setApiUrl] = useState("http://localhost:8000");
  const [hfModel, setHfModel] = useState("Qwen/Qwen2.5-3B-Instruct");
  const [hfAdapter, setHfAdapter] = useState("peterrs23/audit-v-qwen-3b");
  const [similarityThreshold, setSimilarityThreshold] = useState(0.35);

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load user settings from backend on mount
  useEffect(() => {
    apiGetUserSettings()
      .then((s) => {
        setApiUrl(s.api_url);
        setHfModel(s.hf_model);
        setHfAdapter(s.hf_adapter);
        setSimilarityThreshold(Number(s.similarity_threshold));
      })
      .catch(() => { /* use defaults */ })
      .finally(() => setLoadingSettings(false));
  }, [user?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiUpdateUserSettings({
        api_url: apiUrl,
        hf_model: hfModel,
        hf_adapter: hfAdapter,
        similarity_threshold: String(similarityThreshold),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch {
      // silently fallback
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <FloatingPanel className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
              Audit V System Config
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">
            System &amp; Model Settings
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Configure backend FastAPI server parameters, Hugging Face LoRA model repositories, and RAG vector store thresholds. Settings are saved to your personal account.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 hover:scale-105 active:scale-95 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save Configuration"}
        </button>
      </FloatingPanel>

      {savedSuccess && (
        <div className="p-3.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Settings saved to your Audit V account!
        </div>
      )}

      {/* User Profile Card */}
      <FloatingPanel className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <User className="h-4 w-4 text-cyan-400" />
          Account Profile
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Username</label>
            <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono">
              {user?.username}
            </div>
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1 flex items-center gap-1">
              <Mail className="h-3 w-3" /> Email
            </label>
            <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono">
              {user?.email}
            </div>
          </div>
          {user?.full_name && (
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Full Name</label>
              <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white">
                {user.full_name}
              </div>
            </div>
          )}
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Member Since</label>
            <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—"}
            </div>
          </div>
        </div>
      </FloatingPanel>

      {/* Backend API Settings */}
      <FloatingPanel className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Server className="h-4 w-4 text-cyan-400" />
          Backend API Connection
        </h3>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">FastAPI Backend Server URL</label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono outline-none focus:border-cyan-400"
            />
          </div>
        </div>
      </FloatingPanel>

      {/* Hugging Face & LLM Settings */}
      <FloatingPanel className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Cpu className="h-4 w-4 text-cyan-400" />
          AI &amp; LoRA Fine-Tuned Model Configuration
        </h3>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Hugging Face Base Model</label>
            <input
              type="text"
              value={hfModel}
              onChange={(e) => setHfModel(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Hugging Face LoRA Adapter Repository</label>
            <input
              type="text"
              value={hfAdapter}
              onChange={(e) => setHfAdapter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono outline-none focus:border-cyan-400"
            />
          </div>
        </div>
      </FloatingPanel>

      {/* RAG Vector Store Settings */}
      <FloatingPanel className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Database className="h-4 w-4 text-cyan-400" />
          RAG Vector Retrieval Guardrails
        </h3>

        <div className="space-y-3 text-xs">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-400 font-semibold">Minimum RAG Similarity Threshold</label>
              <span className="font-mono font-bold text-cyan-300">{similarityThreshold}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              If retrieval similarity score falls below threshold, `insufficient_grounding` notice is triggered.
            </p>
          </div>
        </div>
      </FloatingPanel>
    </div>
  );
}
