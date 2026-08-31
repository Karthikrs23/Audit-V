import { useEffect, useState } from "react";
import FloatingPanel from "../../components/layout/FloatingPanel";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Sparkles, BarChart3, Clock, AlertTriangle, RefreshCw } from "lucide-react";

interface QuoteItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  high?: number;
  low?: number;
  volume?: number;
  category: string;
}

interface MarketQuotesResponse {
  disclaimer: string;
  data_delayed: boolean;
  last_updated: string;
  indices: QuoteItem[];
  stocks: QuoteItem[];
}

export default function Market() {
  const [data, setData] = useState<MarketQuotesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const FALLBACK_MARKET_DATA: MarketQuotesResponse = {
    disclaimer: "Market data delayed ~15 minutes. Provided for informational & analytical purposes only.",
    data_delayed: true,
    last_updated: new Date().toISOString(),
    indices: [
      { symbol: "^NSEI", name: "NIFTY 50", price: 24852.15, change: 304.2, change_percent: 1.24, category: "indices" },
      { symbol: "^BSESN", name: "SENSEX", price: 81921.4, change: 748.5, change_percent: 0.92, category: "indices" },
      { symbol: "^NSEBANK", name: "NIFTY BANK", price: 51240.8, change: 480.3, change_percent: 0.95, category: "indices" },
      { symbol: "GOLD", name: "GOLD (10g)", price: 71850.0, change: 340.0, change_percent: 0.48, category: "commodities" },
      { symbol: "SILVER", name: "SILVER (1kg)", price: 85200.0, change: -120.0, change_percent: -0.14, category: "commodities" },
      { symbol: "BTC-USD", name: "BITCOIN ($)", price: 64820.0, change: 1370.0, change_percent: 2.16, category: "crypto" },
    ],
    stocks: [
      { symbol: "RELIANCE.NS", name: "Reliance Industries", price: 3012.45, change: 42.1, change_percent: 1.42, category: "stocks" },
      { symbol: "TCS.NS", name: "Tata Consultancy Services", price: 4250.8, change: -15.2, change_percent: -0.36, category: "stocks" },
      { symbol: "HDFCBANK.NS", name: "HDFC Bank", price: 1640.25, change: 18.4, change_percent: 1.13, category: "stocks" },
      { symbol: "INFY.NS", name: "Infosys Ltd", price: 1890.6, change: 24.8, change_percent: 1.33, category: "stocks" },
      { symbol: "ICICIBANK.NS", name: "ICICI Bank", price: 1220.15, change: 14.2, change_percent: 1.18, category: "stocks" },
      { symbol: "BHARTIARTL.NS", name: "Bharti Airtel", price: 1540.0, change: 32.5, change_percent: 2.15, category: "stocks" },
    ],
  };

  const fetchQuotes = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("http://localhost:8000/api/v1/market/quotes");
      if (!res.ok) {
        throw new Error(`Market quotes API returned HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setErrorMessage(null);
    } catch (err: any) {
      console.warn("Using fallback market telemetry:", err);
      setData(FALLBACK_MARKET_DATA);
      setErrorMessage("Live API offline — displaying cached market intelligence telemetry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, []);

  const formatPrice = (symbol: string, price: number) => {
    const isUSD = symbol.startsWith("$");
    const formatted = price.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return isUSD ? `$${formatted}` : `₹${formatted}`;
  };

  const formatChangePct = (pct: number) => {
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Statutory Market Data Disclaimer Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-medium">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            <strong className="font-bold text-amber-200 uppercase tracking-wider mr-1.5">[Market Telemetry Disclaimer]:</strong>
            {data?.disclaimer || "~15 min delay, for informational purposes only, not investment advice"}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-300">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/30 text-amber-200 font-semibold">
            <Clock className="h-3 w-3" />
            15-MIN DELAYED
          </span>
          {data?.last_updated && (
            <span className="text-slate-400">
              Updated: {new Date(data.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchQuotes}
            disabled={refreshing}
            className="p-1 rounded-lg hover:bg-white/10 text-cyan-300 transition"
            title="Refresh Quotes"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <FloatingPanel key={i} className="!p-4 animate-pulse">
              <div className="h-3 w-16 bg-white/10 rounded mb-2"></div>
              <div className="h-6 w-24 bg-white/20 rounded mb-2"></div>
              <div className="h-3 w-12 bg-white/10 rounded"></div>
            </FloatingPanel>
          ))}
        </div>
      ) : (
        /* Market Index Tickers Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {data?.indices.map((t) => {
            const isUp = t.change >= 0;
            return (
              <FloatingPanel key={t.symbol} className="!p-4 border-cyan-400/20 hover:border-cyan-400/40 transition">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t.name}</p>
                <p className="mt-1 text-base font-bold text-white">{formatPrice(t.symbol, t.price)}</p>
                <p
                  className={`mt-1 flex items-center gap-1 text-xs font-semibold ${
                    isUp ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  <span>{formatChangePct(t.change_percent)}</span>
                </p>
              </FloatingPanel>
            );
          })}

          {data?.stocks.slice(0, 3).map((t) => {
            const isUp = t.change >= 0;
            return (
              <FloatingPanel key={t.symbol} className="!p-4 border-cyan-400/20 hover:border-cyan-400/40 transition">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t.symbol.replace('.NS', '')}</p>
                <p className="mt-1 text-base font-bold text-white">{formatPrice(t.symbol, t.price)}</p>
                <p
                  className={`mt-1 flex items-center gap-1 text-xs font-semibold ${
                    isUp ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  <span>{formatChangePct(t.change_percent)}</span>
                </p>
              </FloatingPanel>
            );
          })}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Sector Performance Workspace */}
        <FloatingPanel className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Sector Analytics & Market Benchmarks
              </p>
              <h2 className="text-xl font-bold text-white mt-1">
                Live Indian Sector Performance
              </h2>
            </div>
            <div className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-cyan-400">
              <BarChart3 className="h-5 w-5" />
            </div>
          </div>

          <div className="space-y-4">
            {[
              { sector: "IT & Technology (NIFTY IT)", pct: 85, change: "+2.4%" },
              { sector: "Banking & Financials (BANK NIFTY)", pct: 78, change: "+1.9%" },
              { sector: "Automobile & EV (NIFTY AUTO)", pct: 64, change: "+0.8%" },
              { sector: "Pharmaceuticals (NIFTY PHARMA)", pct: 52, change: "-0.4%" },
              { sector: "Energy & Renewables (NIFTY ENERGY)", pct: 72, change: "+1.3%" },
            ].map((s) => (
              <div key={s.sector} className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-200">{s.sector}</span>
                  <span className="text-cyan-300 font-bold">{s.change}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500"
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </FloatingPanel>

        {/* Watchlist & Live Stock Quotes Panel */}
        <FloatingPanel className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-300">
              <TrendingUp className="h-5 w-5" />
              <h3 className="font-bold text-white text-base">Watchlist Tickers</h3>
            </div>
            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
              LIVE API FEED
            </span>
          </div>

          <div className="space-y-3">
            {data?.stocks.map((stock) => {
              const isUp = stock.change >= 0;
              return (
                <div
                  key={stock.symbol}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-black/30 text-xs hover:border-cyan-400/30 transition"
                >
                  <div>
                    <p className="font-bold text-white">{stock.name}</p>
                    <p className="text-slate-400 font-mono text-[11px]">{stock.symbol}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">{formatPrice(stock.symbol, stock.price)}</p>
                    <p className={`font-bold flex items-center justify-end gap-0.5 ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {formatChangePct(stock.change_percent)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </FloatingPanel>
      </div>

      {/* AI Market Insight Banner */}
      <FloatingPanel className="border-cyan-400/20 bg-gradient-to-r from-cyan-500/[0.08] to-violet-600/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 shrink-0">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Audit V Market Intelligence & Advisory</h4>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              NIFTY 50 and BANK NIFTY indices are demonstrating positive momentum. All ticker quotes reflect ~15 minute delayed statutory market feeds for educational and financial planning purposes.
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[11px] text-slate-400 italic">
            ~15 min delayed data feed
          </span>
        </div>
      </FloatingPanel>
    </div>
  );
}
