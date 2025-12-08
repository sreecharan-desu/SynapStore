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

createRoot(document.getElementById("root")!).render(
  <RecoilRoot>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
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
