import { useState, useEffect } from "react";
import FloatingPanel from "../../components/layout/FloatingPanel";
import {
  FileText,
  Upload,
  CheckCircle2,
  Search,
  Trash2,
  Info,
  FolderOpen,
} from "lucide-react";
import { apiGetDocuments, apiAddDocument, apiDeleteDocument } from "../../services/authApi";
import type { UserDocumentOut } from "../../services/authApi";

interface VaultDocument {
  id: string;
  backendId?: number;
  name: string;
  category: "Form 16" | "Tax Invoice" | "Section 80C Receipt" | "Rent Agreement" | "GST Return";
  uploadDate: string;
  size: string;
  status: "Verified Record" | "User Uploaded" | "Sample Demo";
  notes?: string;
  isUserUploaded?: boolean;
}

const SAMPLE_DEMO_DOCUMENTS: VaultDocument[] = [
  {
    id: "SAMPLE-01",
    name: "Form_16_Part_A_B_Sample.pdf",
    category: "Form 16",
    uploadDate: "2026-08-10",
    size: "1.4 MB",
    status: "Sample Demo",
    notes: "Demonstration salary tax deduction certificate",
  },
  {
    id: "SAMPLE-02",
    name: "HDFC_ELSS_Mutual_Fund_Receipt.pdf",
    category: "Section 80C Receipt",
    uploadDate: "2026-08-08",
    size: "820 KB",
    status: "Sample Demo",
    notes: "ELSS investment slip under Section 80C",
  },
  {
    id: "SAMPLE-03",
    name: "IT_Hardware_Tax_Invoice_INV98.pdf",
    category: "Tax Invoice",
    uploadDate: "2026-08-05",
    size: "2.1 MB",
    status: "Sample Demo",
    notes: "GST Tax Invoice (SAC 998314) with 18% CGST/SGST",
  },
];

export default function DocumentsVault() {
  const [userDocs, setUserDocs] = useState<VaultDocument[]>([]);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Manual document entry modal/form states
  const [docName, setDocName] = useState("");
  const [docCategory, setDocCategory] = useState<VaultDocument["category"]>("Form 16");
  const [docNotes, setDocNotes] = useState("");

  // Load user documents from backend
  const loadUserDocuments = async () => {
    try {
      const records: UserDocumentOut[] = await apiGetDocuments();
      const mapped: VaultDocument[] = records.map((ud) => ({
        id: `DOC-${ud.id.toString().padStart(4, "0")}`,
        backendId: ud.id,
        name: ud.filename,
        category: (ud.file_type as any) || "Tax Invoice",
        uploadDate: ud.created_at ? ud.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
        size: "Saved",
        status: "User Uploaded",
        notes: ud.notes || undefined,
        isUserUploaded: true,
      }));
      setUserDocs(mapped);
    } catch (err) {
      console.warn("Could not load user documents:", err);
    }
  };

  useEffect(() => {
    loadUserDocuments();
  }, []);

  const activeDocuments = isDemoMode && userDocs.length === 0 ? SAMPLE_DEMO_DOCUMENTS : userDocs;

  const handleManualAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) return;
    setIsUploading(true);
    try {
      await apiAddDocument({
        filename: docName.trim(),
        file_type: docCategory,
        notes: docNotes.trim() || undefined,
      });
      setNotification("Document recorded in vault ✓");
      setDocName("");
      setDocNotes("");
      loadUserDocuments();
      setTimeout(() => setNotification(null), 3000);
    } catch {
      setNotification("Failed to record document.");
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (backendId?: number, id?: string) => {
    if (!backendId) {
      setUserDocs((prev) => prev.filter((d) => d.id !== id));
      return;
    }
    try {
      await apiDeleteDocument(backendId);
      setUserDocs((prev) => prev.filter((d) => d.backendId !== backendId));
      setNotification("Document removed from vault ✓");
      setTimeout(() => setNotification(null), 2500);
    } catch {
      setNotification("Error removing document.");
      setTimeout(() => setNotification(null), 2500);
    }
  };

  const filteredDocs = activeDocuments.filter((d) => {
    if (selectedCategory !== "ALL" && d.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        (d.notes && d.notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <FloatingPanel className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
              Audit V Document Vault
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-400">
              Encrypted Local Storage
            </span>
            {isDemoMode && (
              <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 text-xs font-bold">
                Demo data
              </span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">
            Tax Documents & Invoices Vault
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Securely catalog Form 16, tax invoices, Section 80C receipts, and rental contracts.
          </p>
        </div>

        {/* Demo Mode Toggle */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
            <span>Demo Mode:</span>
            <input
              type="checkbox"
              checked={isDemoMode}
              onChange={(e) => setIsDemoMode(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
            />
          </label>
        </div>
      </FloatingPanel>

      {/* Parser & Storage Disclaimer */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 flex items-start gap-3">
        <Info className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
        <div className="leading-relaxed">
          <strong>OCR & Government Acknowledgement Notice:</strong> Audit V lists genuine user-saved documents. Extracted values are verified against user inputs. Audit V does not claim official portal sync or fabricate government acknowledgement numbers.
        </div>
      </div>

      {notification && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {notification}
        </div>
      )}

      {/* Add Document Workspace & Filter Bar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Record New Document (4 cols) */}
        <FloatingPanel className="lg:col-span-4 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="h-4 w-4 text-cyan-400" />
              Save Document to Vault
            </h3>
            <p className="text-xs text-slate-400">Log file name, classification category, and audit notes.</p>
          </div>

          <form onSubmit={handleManualAddDoc} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Document / File Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Form_16_TCS_2026.pdf"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Statutory Category</label>
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value as any)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
              >
                <option value="Form 16">Form 16 (Salary TDS Certificate)</option>
                <option value="Tax Invoice">Tax Invoice / GST Bill</option>
                <option value="Section 80C Receipt">Section 80C Receipt (ELSS, PPF, Insurance)</option>
                <option value="Rent Agreement">Rent Agreement (HRA Proof)</option>
                <option value="GST Return">GST Return (GSTR-1 / 3B Copy)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Audit Notes / Comments</label>
              <textarea
                rows={2}
                placeholder="Optional notes (e.g. Employer TAN, deductible amount)"
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <button
              type="submit"
              disabled={isUploading}
              className="w-full rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-500/20 hover:bg-cyan-400 transition"
            >
              {isUploading ? "Recording..." : "Add to Document Vault"}
            </button>
          </form>
        </FloatingPanel>

        {/* Right Column: Documents List & Filter (8 cols) */}
        <FloatingPanel className="lg:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {["ALL", "Form 16", "Tax Invoice", "Section 80C Receipt", "Rent Agreement", "GST Return"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    selectedCategory === cat
                      ? "bg-cyan-500 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search vault..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1 pl-8 pr-2.5 text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-400 space-y-2">
              <FolderOpen className="h-8 w-8 mx-auto text-slate-600" />
              <p className="text-white font-bold">No documents recorded in this view.</p>
              <p>Add a document using the form on the left, or toggle Demo Mode to view sample records.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-xs text-white">{doc.name}</strong>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-cyan-300 font-semibold border border-slate-700">
                          {doc.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Recorded on: {doc.uploadDate} {doc.notes && `• ${doc.notes}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] text-slate-300 border border-slate-700">
                      {doc.status}
                    </span>
                    {!isDemoMode && (
                      <button
                        onClick={() => handleDelete(doc.backendId, doc.id)}
                        className="text-slate-500 hover:text-rose-400 transition"
                        title="Delete document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </FloatingPanel>
      </div>
    </div>
  );
}
