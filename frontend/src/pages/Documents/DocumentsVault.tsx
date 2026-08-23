import { useState } from "react";
import FloatingPanel from "../../components/layout/FloatingPanel";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Search,
  Tag,
  Eye,
  Download,
  Sparkles,
  FileCheck,
} from "lucide-react";

interface VaultDocument {
  id: string;
  name: string;
  category: "Form 16" | "Tax Invoice" | "Section 80C Receipt" | "Rent Agreement" | "GST Return";
  uploadDate: string;
  size: string;
  status: "Verified" | "Processing" | "Needs Review";
  confidence: number;
}

const INITIAL_DOCUMENTS: VaultDocument[] = [
  {
    id: "DOC-2026-001",
    name: "Form_16_Part_A_B_FY2526.pdf",
    category: "Form 16",
    uploadDate: "2026-08-10",
    size: "1.4 MB",
    status: "Verified",
    confidence: 99,
  },
  {
    id: "DOC-2026-002",
    name: "HDFC_ELSS_Mutual_Fund_Statement.pdf",
    category: "Section 80C Receipt",
    uploadDate: "2026-08-08",
    size: "820 KB",
    status: "Verified",
    confidence: 96,
  },
  {
    id: "DOC-2026-003",
    name: "Vendor_Tax_Invoice_INV98231.pdf",
    category: "Tax Invoice",
    uploadDate: "2026-08-05",
    size: "2.1 MB",
    status: "Verified",
    confidence: 94,
  },
  {
    id: "DOC-2026-004",
    name: "Residential_Rent_Agreement_2026.pdf",
    category: "Rent Agreement",
    uploadDate: "2026-07-28",
    size: "3.5 MB",
    status: "Needs Review",
    confidence: 78,
  },
  {
    id: "DOC-2026-005",
    name: "GSTR3B_Filing_Acknowledgement_July.pdf",
    category: "GST Return",
    uploadDate: "2026-08-11",
    size: "450 KB",
    status: "Verified",
    confidence: 100,
  },
];

export default function DocumentsVault() {
  const [documents, setDocuments] = useState<VaultDocument[]>(INITIAL_DOCUMENTS);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      const newDoc: VaultDocument = {
        id: `DOC-2026-00${documents.length + 1}`,
        name: "Uploaded_Tax_Proof_Receipt.pdf",
        category: "Section 80C Receipt",
        uploadDate: new Date().toISOString().split("T")[0],
        size: "1.1 MB",
        status: "Verified",
        confidence: 95,
      };
      setDocuments([newDoc, ...documents]);
      setIsUploading(false);
    }, 1200);
  };

  const filteredDocs = documents.filter((doc) => {
    if (selectedCategory !== "ALL" && doc.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        doc.id.toLowerCase().includes(q) ||
        doc.name.toLowerCase().includes(q) ||
        doc.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <FloatingPanel className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
              Audit V Vault Engine
            </span>
            <span className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              OCR Extract Active
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">
            Tax Documents & Proof Vault
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Secure storage, OCR verification parsing, and proof of investment management for Form 16, 80C receipts, and tax invoices.
          </p>
        </div>

        <button
          onClick={handleFileUpload}
          disabled={isUploading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 hover:scale-105 active:scale-95 transition disabled:opacity-50"
        >
          <Upload className={`h-4 w-4 ${isUploading ? "animate-bounce" : ""}`} />
          {isUploading ? "OCR Parsing Document..." : "Upload Proof Document"}
        </button>
      </FloatingPanel>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Total Documents</p>
              <h3 className="mt-1 text-2xl font-bold text-white">{documents.length} Files</h3>
              <p className="mt-1 text-xs text-slate-400">Verified vault storage</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              <FileText className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">OCR Verified</p>
              <h3 className="mt-1 text-2xl font-bold text-emerald-400">
                {documents.filter((d) => d.status === "Verified").length} Files
              </h3>
              <p className="mt-1 text-xs text-emerald-300">High confidence parsing</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Needs Review</p>
              <h3 className="mt-1 text-2xl font-bold text-amber-400">
                {documents.filter((d) => d.status === "Needs Review").length} File
              </h3>
              <p className="mt-1 text-xs text-amber-300">Manual review suggested</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <AlertCircle className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Avg OCR Precision</p>
              <h3 className="mt-1 text-2xl font-bold text-cyan-300">95.4%</h3>
              <p className="mt-1 text-xs text-cyan-200">SentenceTransformer extraction</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              <FileCheck className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>
      </div>

      {/* Filter Tabs & Search Bar */}
      <FloatingPanel className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {["ALL", "Form 16", "Section 80C Receipt", "Tax Invoice", "Rent Agreement", "GST Return"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  selectedCategory === cat
                    ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/30"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search file name, ID, category..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-400 focus:border-cyan-400 outline-none"
            />
          </div>
        </div>

        {/* Documents Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-900/40">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-700/60 bg-slate-800/50 uppercase text-slate-400 font-bold">
              <tr>
                <th className="py-3 px-4">Doc ID</th>
                <th className="py-3 px-4">Document File Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Uploaded</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">OCR Confidence</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4 font-mono font-bold text-cyan-300">{doc.id}</td>
                  <td className="py-3 px-4 text-white font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span className="truncate max-w-xs">{doc.name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                      <Tag className="h-3 w-3 text-cyan-400" />
                      {doc.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{doc.uploadDate}</td>
                  <td className="py-3 px-4 text-slate-400">{doc.size}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        doc.status === "Verified"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      {doc.status === "Verified" ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      {doc.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-cyan-300">
                    {doc.confidence}%
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 text-slate-400">
                      <button className="p-1 hover:text-cyan-300 transition" title="Preview Document">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-1 hover:text-cyan-300 transition" title="Download Document">
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FloatingPanel>
    </div>
  );
}
