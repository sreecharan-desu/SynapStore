import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RecoilRoot } from "recoil";
import "./index.css";
import App from "./App.tsx";
import Login from "./pages/login.tsx";
import { Toaster } from "react-hot-toast";
// Dashboard removed
import StoreCreate from "./pages/StoreCreate";
import RequireAuth from "./components/guards/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
import LoginGuard from "./components/guards/LoginGuard";
import RoleGuard from "./components/guards/RoleGuard";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { ChatbotWidget } from "./components/ChatbotWidget";
import SuppliersPage from "./pages/suppliers/SuppliersPage";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SupplierDashboard from "./pages/SupplierDashboard";
import StoreOwnerDashboard from "./pages/StoreOwnerDashboard";

createRoot(document.getElementById("root")!).render(
  <RecoilRoot>
    <AuthProvider>
      <Toaster position="top-center" reverseOrder={false} />
      <ChatbotWidget />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route
            path="/login"
            element={
              <LoginGuard>
                <Login />
              </LoginGuard>
            }
          />

          {/* Role-Specific Dashboards */}
          <Route
            path="/admin/dashboard"
            element={
              <RequireAuth>
                <RoleGuard allowedRoles={["SUPERADMIN"]}>
                  <SuperAdminDashboard />
                </RoleGuard>
              </RequireAuth>
            }
          />

          <Route
            path="/supplier/dashboard"
            element={
              <RequireAuth>
                <RoleGuard allowedRoles={["SUPPLIER"]}>
                  <SupplierDashboard />
                </RoleGuard>
              </RequireAuth>
            }
          />

          <Route
            path="/store/dashboard"
            element={
              <RequireAuth>
                <RoleGuard allowedRoles={["STORE_OWNER", "USER", "MANAGER", "READ_ONLY"]}>
                  <StoreOwnerDashboard />
                </RoleGuard>
              </RequireAuth>
            }
          />

          {/* Legacy Layout Routes (for sub-pages like suppliers) */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <RoleGuard allowedRoles={["STORE_OWNER", "USER", "MANAGER", "READ_ONLY"]}>
                  <DashboardLayout />
                </RoleGuard>
              </RequireAuth>
            }
          >
            {/* Index is now redirected at App level, or we can redirect explicit /dashboard access */}
            <Route index element={<Navigate to="/store/dashboard" replace />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="store/create" element={<StoreCreate />} />
          </Route>

          <Route
            path="/store/create"
            element={
              <RequireAuth>
                <StoreCreate />
              </RequireAuth>
            }
          />


        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </RecoilRoot>
);
