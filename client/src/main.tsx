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
import { DashboardLayout } from "./components/layout/DashboardLayout";
import InventoryPage from "./pages/inventory/InventoryPage";
import SalesPage from "./pages/sales/SalesPage";
import SuppliersPage from "./pages/suppliers/SuppliersPage";

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

          {/* Dashboard Routes with Layout */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="inventory" element={<InventoryPage />} />
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
