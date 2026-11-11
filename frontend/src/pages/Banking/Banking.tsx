import { useState, useEffect } from "react";
import FloatingPanel from "../../components/layout/FloatingPanel";
import {
  Landmark,
  Calculator,
  Trash2,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Save,
  CheckCircle2,
  Info,
} from "lucide-react";
import {
  fetchBankingRecords,
  saveBankingRecords,
  type BankAccount,
  type BankTransaction,
} from "../../services/financialApi";

const DEMO_ACCOUNTS: BankAccount[] = [
  {
    id: "ACC-01",
    bankName: "HDFC Bank",
    accountType: "Salary",
    accountNumberMasked: "•••• 4892",
    balance: 145000,
    lastUpdated: "2026-10-25",
  },
  {
    id: "ACC-02",
    bankName: "State Bank of India",
    accountType: "Savings",
    accountNumberMasked: "•••• 9104",
    balance: 230000,
    lastUpdated: "2026-10-20",
  },
  {
    id: "ACC-03",
    bankName: "ICICI Bank",
    accountType: "Fixed Deposit",
    accountNumberMasked: "•••• 1150",
    balance: 500000,
    lastUpdated: "2026-10-01",
  },
];

const DEMO_TRANSACTIONS: BankTransaction[] = [
  { id: "TX-01", date: "2026-10-28", type: "income", category: "Salary", description: "Monthly Consulting / Professional Remittance", amount: 125000 },
  { id: "TX-02", date: "2026-10-25", type: "expense", category: "Housing", description: "Residential Apartment Rent", amount: 35000 },
  { id: "TX-03", date: "2026-10-22", type: "expense", category: "Utilities", description: "Electricity & High-Speed Broadband", amount: 4800 },
  { id: "TX-04", date: "2026-10-18", type: "expense", category: "Groceries", description: "Supermarket & Household Provisions", amount: 12400 },
  { id: "TX-05", date: "2026-10-12", type: "income", category: "Dividends", description: "Equity Portfolio Dividend Credit", amount: 8200 },
];

export default function Banking() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Form states for adding account
  const [newBankName, setNewBankName] = useState("");
  const [newAccType, setNewAccType] = useState<"Savings" | "Current" | "Fixed Deposit" | "Salary">("Savings");
  const [newAccNumber, setNewAccNumber] = useState("");
  const [newBalance, setNewBalance] = useState("");

  // Form states for adding transaction
  const [newTxDate, setNewTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [newTxType, setNewTxType] = useState<"income" | "expense">("expense");
  const [newTxCat, setNewTxCat] = useState("General");
  const [newTxDesc, setNewTxDesc] = useState("");
  const [newTxAmount, setNewTxAmount] = useState("");

  // FD Calculator State
  const [fdPrincipal, setFdPrincipal] = useState<number>(100000);
  const [fdRate, setFdRate] = useState<number>(7.2);
  const [fdTenure, setFdTenure] = useState<number>(3); // years

  const interest = Math.round((fdPrincipal * fdRate * fdTenure) / 100);
  const maturity = fdPrincipal + interest;

  // Load saved banking records
  useEffect(() => {
    let active = true;
    fetchBankingRecords().then((res) => {
      if (active) {
        if (res.accounts.length > 0 || res.transactions.length > 0) {
          setAccounts(res.accounts);
          setTransactions(res.transactions);
        }
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const activeAccounts = isDemoMode && accounts.length === 0 ? DEMO_ACCOUNTS : accounts;
  const activeTransactions = isDemoMode && transactions.length === 0 ? DEMO_TRANSACTIONS : transactions;

  // Computed Financial Summaries
  const totalBalance = activeAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalIncome = activeTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = activeTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const netCashFlow = totalIncome - totalExpense;

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim() || !newBalance) return;
    const bal = parseFloat(newBalance);
    if (isNaN(bal) || bal < 0) return;

    const acc: BankAccount = {
      id: `ACC-${Date.now().toString().slice(-4)}`,
      bankName: newBankName.trim(),
      accountType: newAccType,
      accountNumberMasked: newAccNumber ? `•••• ${newAccNumber.slice(-4)}` : "•••• ----",
      balance: bal,
      lastUpdated: new Date().toISOString().split("T")[0],
    };

    const updated = [acc, ...accounts];
    setAccounts(updated);
    setNewBankName("");
    setNewAccNumber("");
    setNewBalance("");
    saveBankingRecords(updated, transactions);
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTxDesc.trim() || !newTxAmount) return;
    const amt = parseFloat(newTxAmount);
    if (isNaN(amt) || amt <= 0) return;

    const tx: BankTransaction = {
      id: `TX-${Date.now().toString().slice(-4)}`,
      date: newTxDate,
      type: newTxType,
      category: newTxCat,
      description: newTxDesc.trim(),
      amount: amt,
    };

    const updated = [tx, ...transactions];
    setTransactions(updated);
    setNewTxDesc("");
    setNewTxAmount("");
    saveBankingRecords(accounts, updated);
  };

  const handleDeleteAccount = (id: string) => {
    const updated = accounts.filter((a) => a.id !== id);
    setAccounts(updated);
    saveBankingRecords(updated, transactions);
  };

  const handleDeleteTransaction = (id: string) => {
    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);
    saveBankingRecords(accounts, updated);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await saveBankingRecords(accounts, transactions);
      setSaveStatus("Records saved to personal storage ✓");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch {
      setSaveStatus("Failed to save records.");
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Account Aggregator Notice */}
      <FloatingPanel className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
              Audit V Banking & Treasury
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-400">
              User-Managed Ledger
            </span>
            {isDemoMode && (
              <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 text-xs font-bold">
                Demo data
              </span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">
            Banking, Accounts & Cash Flow
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Track bank account balances, cash inflows, and recorded expenses with deterministic totals.
          </p>
        </div>

        {/* Demo Mode Toggle & Save Button */}
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
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-cyan-500/20 hover:bg-cyan-400 transition"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Ledger"}
          </button>
        </div>
      </FloatingPanel>

      {/* Integration Disclaimer Banner */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 flex items-start gap-3">
        <Info className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Direct Bank Connectivity Notice:</strong> Direct automated bank account syncing via RBI Account Aggregator (AA) framework requires an RBI NBFC-AA license and certified Open Banking APIs. Audit V currently uses this verified manual ledger to safeguard privacy without requiring bank credentials.
        </div>
      </div>

      {saveStatus && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {saveStatus}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Total Liquid Balance</p>
              <h3 className="mt-1 text-2xl font-bold text-white font-mono">
                ₹{totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="mt-1 text-[11px] text-cyan-300">{activeAccounts.length} Connected Accounts</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              <Wallet className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Recorded Inflow</p>
              <h3 className="mt-1 text-2xl font-bold text-emerald-400 font-mono">
                +₹{totalIncome.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">Income & Credits</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
              <ArrowUpRight className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Recorded Outflow</p>
              <h3 className="mt-1 text-2xl font-bold text-rose-400 font-mono">
                -₹{totalExpense.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">Expenses & Debits</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-400/10 text-rose-400">
              <ArrowDownRight className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Net Cash Flow</p>
              <h3 className={`mt-1 text-2xl font-bold font-mono ${netCashFlow >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {netCashFlow >= 0 ? "+" : ""}₹{netCashFlow.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">
                {netCashFlow >= 0 ? "Net Positive Surplus" : "Deficit (Expenses exceed income)"}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </FloatingPanel>
      </div>

      {/* Main Content: Accounts Ledger & Transaction History */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Bank Accounts (5 cols) */}
        <FloatingPanel className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Landmark className="h-4 w-4 text-cyan-400" />
              Bank Accounts & Deposits
            </h3>
            <span className="text-xs text-slate-400">{activeAccounts.length} Accounts</span>
          </div>

          {/* Add Account Inline Form */}
          <form onSubmit={handleAddAccount} className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
            <span className="font-bold text-slate-300">Add Account</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Bank Name (e.g. HDFC)"
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
              />
              <select
                value={newAccType}
                onChange={(e) => setNewAccType(e.target.value as any)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
              >
                <option value="Savings">Savings Account</option>
                <option value="Salary">Salary Account</option>
                <option value="Current">Current Account</option>
                <option value="Fixed Deposit">Fixed Deposit (FD)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Last 4 Digits"
                maxLength={4}
                value={newAccNumber}
                onChange={(e) => setNewAccNumber(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
              />
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Balance (₹)"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-cyan-500 py-1.5 text-xs font-bold text-white hover:bg-cyan-400 transition"
            >
              Add Account
            </button>
          </form>

          {/* Account Cards List */}
          {activeAccounts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-400">
              No bank accounts recorded. Add an account above or toggle Demo Mode to view sample balances.
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-3 transition hover:border-slate-700"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-white text-xs">{acc.bankName}</strong>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                        {acc.accountType}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{acc.accountNumberMasked}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-white">
                      ₹{acc.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                    {!isDemoMode && (
                      <button
                        onClick={() => handleDeleteAccount(acc.id)}
                        className="text-slate-500 hover:text-rose-400 transition"
                        title="Delete account"
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

        {/* Right Column: Transactions & FD Calculator (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Transactions Ledger */}
          <FloatingPanel className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wallet className="h-4 w-4 text-cyan-400" />
                Transaction Cash Flow Ledger
              </h3>
              <span className="text-xs text-slate-400">{activeTransactions.length} Entries</span>
            </div>

            {/* Add Transaction Inline Form */}
            <form onSubmit={handleAddTransaction} className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
              <span className="font-bold text-slate-300">Record Transaction</span>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="date"
                  value={newTxDate}
                  onChange={(e) => setNewTxDate(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
                />
                <select
                  value={newTxType}
                  onChange={(e) => setNewTxType(e.target.value as any)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
                >
                  <option value="expense">Expense (Debit)</option>
                  <option value="income">Income (Credit)</option>
                </select>
                <select
                  value={newTxCat}
                  onChange={(e) => setNewTxCat(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
                >
                  <option value="Salary">Salary</option>
                  <option value="Housing">Housing / Rent</option>
                  <option value="Groceries">Groceries & Food</option>
                  <option value="Utilities">Utilities & Bills</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Investments">Investments</option>
                  <option value="General">General / Other</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Description (e.g. Monthly Rent)"
                  value={newTxDesc}
                  onChange={(e) => setNewTxDesc(e.target.value)}
                  className="col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Amount (₹)"
                  value={newTxAmount}
                  onChange={(e) => setNewTxAmount(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white outline-none focus:border-cyan-400"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-cyan-500 py-1.5 text-xs font-bold text-white hover:bg-cyan-400 transition"
              >
                Record Entry
              </button>
            </form>

            {/* Transactions Table */}
            {activeTransactions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-400">
                No transactions recorded yet. Record an expense or income entry above.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="border-b border-slate-800 bg-slate-800/40 font-bold uppercase text-slate-400">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      {!isDemoMode && <th className="py-2.5 px-3 text-center">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {activeTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/20 transition">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{tx.date}</td>
                        <td className="py-2.5 px-3">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                            {tx.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-white">{tx.description}</td>
                        <td className={`py-2.5 px-3 text-right font-mono font-bold ${
                          tx.type === "income" ? "text-emerald-400" : "text-rose-400"
                        }`}>
                          {tx.type === "income" ? "+" : "-"}₹{tx.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        {!isDemoMode && (
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="text-slate-500 hover:text-rose-400 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5 mx-auto" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FloatingPanel>

          {/* Interactive Fixed Deposit Calculator Workspace */}
          <FloatingPanel className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-cyan-400" />
                  Fixed Deposit (FD) Compound Maturity Calculator
                </h3>
                <p className="text-xs text-slate-400">Deterministic calculation based on principal, rate, and tenure.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Deposit Principal (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={fdPrincipal}
                  onChange={(e) => setFdPrincipal(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Interest Rate (% p.a.)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={fdRate}
                  onChange={(e) => setFdRate(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tenure (Years)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={fdTenure}
                  onChange={(e) => setFdTenure(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center">
                <span className="text-[11px] text-slate-400">Principal Amount</span>
                <p className="mt-1 font-mono text-sm font-bold text-white">₹{fdPrincipal.toLocaleString("en-IN")}</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center">
                <span className="text-[11px] text-slate-400">Total Interest</span>
                <p className="mt-1 font-mono text-sm font-bold text-emerald-400">+₹{interest.toLocaleString("en-IN")}</p>
              </div>

              <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-center">
                <span className="text-[11px] text-cyan-300 font-semibold">Maturity Value</span>
                <p className="mt-1 font-mono text-base font-black text-white">₹{maturity.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </FloatingPanel>
        </div>
      </div>
    </div>
  );
}
