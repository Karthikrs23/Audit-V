import { Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "../pages/Dashboard/Dashboard";
import Market from "../pages/Market/Market";
import Banking from "../pages/Banking/Banking";
import Investment from "../pages/Investment/Investment";
import SalaryPlanner from "../pages/SalaryPlanner/SalaryPlanner";
import AIAssistant from "../pages/AIAssistant/AIAssistant";
import RiskFraud from "../pages/RiskFraud/RiskFraud";
import Tax from "../pages/Tax/Tax";
import FinancialAnalysis from "../pages/Financial/FinancialAnalysis";
import DocumentsVault from "../pages/Documents/DocumentsVault";
import Reports from "../pages/Reports/Reports";
import Settings from "../pages/Settings/Settings";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/ai-assistant" element={<AIAssistant />} />
      <Route path="/market" element={<Market />} />
      <Route path="/banking" element={<Banking />} />
      <Route path="/investments" element={<Investment />} />
      <Route path="/salary-tax" element={<SalaryPlanner />} />
      <Route path="/tax" element={<Tax />} />
      <Route path="/financial-analysis" element={<FinancialAnalysis />} />
      <Route path="/risk-fraud" element={<RiskFraud />} />
      <Route path="/documents" element={<DocumentsVault />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/settings" element={<Settings />} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}