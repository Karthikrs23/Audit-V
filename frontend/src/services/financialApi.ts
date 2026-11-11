/**
 * financialApi.ts — Typed service for personal banking, investment holdings,
 * and financial analysis persistence.
 */

import {
  apiGetFinancialEntries,
  apiSaveFinancialEntry,
} from "./authApi";
import type { FinancialEntryOut } from "./authApi";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BankAccount {
  id: string;
  bankName: string;
  accountType: "Savings" | "Current" | "Fixed Deposit" | "Salary";
  accountNumberMasked: string;
  balance: number;
  lastUpdated: string;
}

export interface BankTransaction {
  id: string;
  date: string;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  accountId?: string;
}

export interface InvestmentHolding {
  id: string;
  symbol: string;
  name: string;
  assetType: "Equity" | "Mutual Fund" | "Debt / Fixed Income" | "Gold & Bullion" | "Sovereign Bonds" | "Crypto";
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  purchaseDate: string;
}

export interface PersonalBudgetCategory {
  category: string;
  budgeted: number;
  actual: number;
}

// ─── Banking Service ──────────────────────────────────────────────────────────

export async function fetchBankingRecords(): Promise<{
  accounts: BankAccount[];
  transactions: BankTransaction[];
}> {
  try {
    const entries = await apiGetFinancialEntries("banking_records");
    if (!entries || entries.length === 0) {
      return { accounts: [], transactions: [] };
    }
    const latest = entries[0].data as Record<string, unknown>;
    return {
      accounts: (latest.accounts as BankAccount[]) || [],
      transactions: (latest.transactions as BankTransaction[]) || [],
    };
  } catch (err) {
    console.warn("Could not fetch banking records:", err);
    return { accounts: [], transactions: [] };
  }
}

export async function saveBankingRecords(
  accounts: BankAccount[],
  transactions: BankTransaction[]
): Promise<FinancialEntryOut> {
  return apiSaveFinancialEntry("banking_records", {
    accounts,
    transactions,
    savedAt: new Date().toISOString(),
  });
}

// ─── Investment Portfolio Service ─────────────────────────────────────────────

export async function fetchInvestmentHoldings(): Promise<InvestmentHolding[]> {
  try {
    const entries = await apiGetFinancialEntries("investment_holdings");
    if (!entries || entries.length === 0) {
      return [];
    }
    const latest = entries[0].data as Record<string, unknown>;
    return (latest.holdings as InvestmentHolding[]) || [];
  } catch (err) {
    console.warn("Could not fetch investment holdings:", err);
    return [];
  }
}

export async function saveInvestmentHoldings(
  holdings: InvestmentHolding[]
): Promise<FinancialEntryOut> {
  return apiSaveFinancialEntry("investment_holdings", {
    holdings,
    savedAt: new Date().toISOString(),
  });
}

// ─── Personal Financial Analysis Service ──────────────────────────────────────

export async function fetchFinancialAnalysisData(): Promise<{
  monthlyIncome: number;
  monthlyExpense: number;
  categories: PersonalBudgetCategory[];
}> {
  try {
    const entries = await apiGetFinancialEntries("financial_analysis");
    if (!entries || entries.length === 0) {
      return { monthlyIncome: 0, monthlyExpense: 0, categories: [] };
    }
    const latest = entries[0].data as Record<string, unknown>;
    return {
      monthlyIncome: Number(latest.monthlyIncome) || 0,
      monthlyExpense: Number(latest.monthlyExpense) || 0,
      categories: (latest.categories as PersonalBudgetCategory[]) || [],
    };
  } catch (err) {
    console.warn("Could not fetch financial analysis data:", err);
    return { monthlyIncome: 0, monthlyExpense: 0, categories: [] };
  }
}

export async function saveFinancialAnalysisData(data: {
  monthlyIncome: number;
  monthlyExpense: number;
  categories: PersonalBudgetCategory[];
}): Promise<FinancialEntryOut> {
  return apiSaveFinancialEntry("financial_analysis", {
    ...data,
    savedAt: new Date().toISOString(),
  });
}
