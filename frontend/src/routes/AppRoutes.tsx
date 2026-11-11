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
import Login from "../pages/Auth/Login";
import Register from "../pages/Auth/Register";
import ProtectedRoute from "../components/common/ProtectedRoute";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public auth routes (outside MainLayout) */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* All protected routes go through ProtectedRoute */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/ai-assistant" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
      <Route path="/market" element={<ProtectedRoute><Market /></ProtectedRoute>} />
      <Route path="/banking" element={<ProtectedRoute><Banking /></ProtectedRoute>} />
      <Route path="/investments" element={<ProtectedRoute><Investment /></ProtectedRoute>} />
      <Route path="/salary-tax" element={<ProtectedRoute><SalaryPlanner /></ProtectedRoute>} />
      <Route path="/tax" element={<ProtectedRoute><Tax /></ProtectedRoute>} />
      <Route path="/financial-analysis" element={<ProtectedRoute><FinancialAnalysis /></ProtectedRoute>} />
      <Route path="/risk-fraud" element={<ProtectedRoute><RiskFraud /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><DocumentsVault /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}