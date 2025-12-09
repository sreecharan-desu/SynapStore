import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import RequireAuth from "../../routes/RequireAuth";
import DashboardNavigationGuard from "../DashboardNavigationGuard";

export const DashboardLayout = () => {
    return (
        <RequireAuth>
            <DashboardNavigationGuard />
            <div className="flex bg-slate-50 min-h-screen">
                <Sidebar />
                <main className="flex-1 ml-64 p-8">
                    <Outlet />
                </main>
            </div>
        </RequireAuth>
    );
};
