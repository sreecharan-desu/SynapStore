import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RecoilRoot } from "recoil";
import "./index.css";
import App from "./App.tsx";
import Login from "./pages/login.tsx";
import Dashboard from "./pages/Dashboard";
import StoreCreate from "./pages/StoreCreate";
import Home from "./pages/Home";
import RequireAuth from "./routes/RequireAuth";
import { AuthProvider } from "./auth/AuthContext";
import LoginGuard from "./components/AuthRouteGuards/LoginGuard";
import RoleGuard from "./components/AuthRouteGuards/RoleGuard";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import SalesPage from "./pages/sales/SalesPage";
import SuppliersPage from "./pages/suppliers/SuppliersPage";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SupplierDashboard from "./pages/SupplierDashboard";
import StoreOwnerDashboard from "./pages/StoreOwnerDashboard";

createRoot(document.getElementById("root")!).render(
  <RecoilRoot>
    <AuthProvider>
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
                <RoleGuard allowedRoles={["STORE_OWNER"]}>
                  <StoreOwnerDashboard />
                </RoleGuard>
              </RequireAuth>
            }
          />

          {/* Dashboard Routes with Layout */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <RoleGuard allowedRoles={["STORE_OWNER", "USER", "MANAGER"]}>
                  <DashboardLayout />
                </RoleGuard>
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="store/create" element={<StoreCreate />} /> {/* Moved inside layout or separate? Store Create usually standalone */}
          </Route>

          <Route
            path="/store/create"
            element={
              <RequireAuth>
                <StoreCreate />
              </RequireAuth>
            }
          />

          <Route path="/home" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </RecoilRoot>
);
