import { useRecoilState, useRecoilValue } from "recoil";
import { authState, authStatus, clearAuthState } from "../state/auth";
import { useNavigate } from "react-router-dom";
import RequireAuth from "../routes/RequireAuth";
import { useDashboardData } from "../hooks/useDashboardData";
import { StatCard } from "../components/dashboard/StatCard";
import { TrendSparkline } from "../components/dashboard/TrendSparkline";
import ThreeBackdrop from "../components/dashboard/ThreeBackdrop";
import { useBlockBackNavigation } from "../hooks/useBlockBackNavigation";
import ChatbotIcon from "../components/chat/ChatbotIcon";
import ChatbotOverlay from "../components/chat/ChatbotOverlay";
import DashboardNavigationGuard from "../components/DashboardNavigationGuard";
import { useState, useRef } from "react";

const formatNumber = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString();

const EmptyState = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="flex flex-col items-center justify-center text-center text-slate-600 py-8">
    <p className="text-lg font-semibold text-slate-900">{title}</p>
    {subtitle && <p className="text-sm mt-1 text-slate-600">{subtitle}</p>}
  </div>
);

const Dashboard = () => {
  const [auth, setAuth] = useRecoilState(authState);
  const status = useRecoilValue(authStatus);
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useDashboardData();
  const [chatOpen, setChatOpen] = useState(false);
  const chatIconRef = useRef<HTMLButtonElement>(null);

  useBlockBackNavigation(status.isAuthenticated);

  const handleLogout = () => {
    setAuth(clearAuthState());
    navigate("/login");
  }

  const overview = data?.overview;
  const charts = data?.charts;
  const store = data?.store;

  const salesByDay =
    charts?.salesByDay?.map((d: any, i: number) => ({
      x: i,
      y: Number(d.revenue ?? 0),
      label: d.date,
    })) ?? [];

  return (
    <RequireAuth>
      <DashboardNavigationGuard />
      <div className="relative min-h-screen bg-background-page text-brand-text overflow-hidden">
        <ThreeBackdrop />
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-brand-primary uppercase tracking-wide font-medium">
                Dashboard
              </p>
              <h1 className="text-3xl font-semibold text-brand-text">
                Welcome back, {auth.user?.username ?? "there"}
              </h1>
              {store && (
                <p className="text-slate-600 text-sm">
                  Store: {store.name} ({store.slug}) • {store.currency}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={refresh}
                className="px-4 py-2 bg-brand-primary-light text-brand-text-900 border border-brand-primary/20 rounded-lg hover:bg-brand-primary-light/80 font-medium"
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>

              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white border border-red-600 rounded-lg hover:bg-red-600 font-medium"
              >
                Logout
              </button>
            </div>
          </div>

          {auth.needsStoreSetup && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900">
              No store detected. Finish setup to continue.
              <button
                className="ml-3 underline text-brand-primary hover:text-brand-primary-dark"
                onClick={() => navigate("/store/create")}
              >
                Create now
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Revenue (period)"
              value={`₹${formatNumber(overview?.recentRevenue ?? 0)}`}
              hint={`${formatNumber(overview?.recentSalesCount ?? 0)} sales`}
              accent="emerald"
            />
            <StatCard
              title="Medicines"
              value={formatNumber(overview?.totalMedicines)}
              hint={`${formatNumber(overview?.totalBatches)} batches`}
              accent="blue"
            />
            <StatCard
              title="Active alerts"
              value={formatNumber(overview?.totalActiveAlerts)}
              hint={`${formatNumber(overview?.unreadNotifications)} queued notifications`}
              accent="amber"
            />
            <StatCard
              title="Reorders pending"
              value={formatNumber(overview?.totalPendingReorders)}
              hint={`Webhook failures: ${formatNumber(overview?.webhookFailures)}`}
              accent="pink"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 p-4 rounded-2xl border border-brand-border bg-background-card shadow-lg shadow-slate-200/50">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-brand-text">Revenue trend</h2>
                <span className="text-xs text-brand-text-muted">
                  Last {charts?.salesByDay?.length ?? 0} days
                </span>
              </div>
              {salesByDay.length ? (
                <TrendSparkline points={salesByDay} color="#3AA18A" width={720} height={200} />
              ) : (
                <EmptyState title="No sales yet" subtitle="Start selling to see trends populate here." />
              )}
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 bg-panel-white shadow-lg shadow-slate-200/50 space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Top movers</h2>
              {charts?.topMovers?.length ? (
                <div className="space-y-2 max-h-72 overflow-auto pr-1">
                  {charts.topMovers.slice(0, 8).map((m: any, idx: number) => (
                    <div
                      key={m.medicineId ?? idx}
                      className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-slate-100"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-brand-text">
                          {m.medicine?.brandName ?? "Unknown"}
                        </p>
                        <p className="text-brand-text-muted">
                          {m.medicine?.category ?? "Uncategorized"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-brand-primary font-semibold">
                          ₹{formatNumber(m.revenue ?? 0)}
                        </p>
                        <p className="text-brand-text-muted">{formatNumber(m.qtySold)} sold</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No movers yet" subtitle="Add inventory and record sales to see top products." />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200 bg-panel-white shadow-lg shadow-slate-200/50">
              <h2 className="text-lg font-semibold mb-2 text-slate-900">Low stock</h2>
              {data?.lists?.lowStock?.length ? (
                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {data.lists.lowStock.slice(0, 8).map((b: any) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-slate-100"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{b.medicine?.brandName ?? "Unknown"}</p>
                        <p className="text-slate-600">Batch {b.batchNumber}</p>
                      </div>
                      <p className="text-amber-600 font-semibold">
                        Qty {formatNumber(b.qtyAvailable ?? 0)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Stock looks good" subtitle="Add inventory to monitor low-stock alerts." />
              )}
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 bg-panel-white shadow-lg shadow-slate-200/50">
              <h2 className="text-lg font-semibold mb-2 text-slate-900">Expiries soon</h2>
              {data?.lists?.expiries?.length ? (
                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {data.lists.expiries.slice(0, 8).map((b: any) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-slate-100"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{b.medicine?.brandName ?? "Unknown"}</p>
                        <p className="text-slate-600">Batch {b.batchNumber}</p>
                      </div>
                      <p className="text-red-600 font-semibold">
                        {b.expiryDate ? new Date(b.expiryDate).toISOString().slice(0, 10) : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No expiries near-term" subtitle="Upcoming expiries will show up here." />
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 bg-panel-white shadow-lg shadow-slate-200/50">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-slate-900">Recent sales</h2>
              <span className="text-xs text-slate-600">
                {data?.lists?.recentSales?.length ?? 0} records
              </span>
            </div>
            {data?.lists?.recentSales?.length ? (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-brand-text-muted">
                    <tr>
                      <th className="text-left pb-2 pr-4">Date</th>
                      <th className="text-left pb-2 pr-4">Value</th>
                      <th className="text-left pb-2 pr-4">Status</th>
                      <th className="text-left pb-2 pr-4">Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lists.recentSales.slice(0, 10).map((s: any) => (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="py-2 pr-4 text-brand-text">
                          {new Date(s.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4 text-brand-primary font-semibold">
                          ₹{formatNumber(s.totalValue ?? 0)}
                        </td>
                        <td className="py-2 pr-4 text-slate-700">{s.paymentStatus}</td>
                        <td className="py-2 pr-4 text-slate-700">
                          {s.items?.length ?? 0} items
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No sales yet" subtitle="Record your first sale to see activity here." />
            )}
          </div>

          {/* Chatbot icon and overlay - only when authenticated */}
          {status.isAuthenticated && (
            <>
              <ChatbotIcon
                onClick={() => setChatOpen(true)}
                ref={chatIconRef}
              />
              <ChatbotOverlay
                open={chatOpen}
                onClose={() => setChatOpen(false)}
                iconButtonRef={chatIconRef}
              />
            </>
          )}
        </div>
      </div>
    </RequireAuth>
  );
};

export default Dashboard;

