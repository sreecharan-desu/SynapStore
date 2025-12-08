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
import { useState, useRef } from "react";

const formatNumber = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString();

const EmptyState = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="flex flex-col items-center justify-center text-center text-white/70 py-8">
    <p className="text-lg font-semibold text-white/80">{title}</p>
    {subtitle && <p className="text-sm mt-1">{subtitle}</p>}
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
  };

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
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white overflow-hidden">
      <ThreeBackdrop />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 relative">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm text-blue-200 uppercase tracking-wide">
              Dashboard
            </p>
            <h1 className="text-3xl font-semibold">
              Welcome back, {auth.user?.username ?? "there"}
            </h1>
            {store && (
              <p className="text-white/70 text-sm">
                Store: {store.name} ({store.slug}) • {store.currency}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={refresh}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg hover:bg-white/15"
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500/80 border border-red-500 rounded-lg hover:bg-red-500"
            >
              Logout
            </button>
          </div>
        </div>

        {auth.needsStoreSetup && (
          <div className="p-4 bg-amber-500/20 border border-amber-400/40 rounded-2xl text-amber-100">
            No store detected. Finish setup to continue.
            <button
              className="ml-3 underline"
              onClick={() => navigate("/store/create")}
            >
              Create now
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-50">
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
          <div className="lg:col-span-2 p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-lg shadow-black/30">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Revenue trend</h2>
              <span className="text-xs text-white/60">
                Last {charts?.salesByDay?.length ?? 0} days
              </span>
            </div>
            {salesByDay.length ? (
              <TrendSparkline points={salesByDay} color="#22d3ee" width={720} height={200} />
            ) : (
              <EmptyState title="No sales yet" subtitle="Start selling to see trends populate here." />
            )}
          </div>
          <div className="p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-lg shadow-black/30 space-y-2">
            <h2 className="text-lg font-semibold">Top movers</h2>
            {charts?.topMovers?.length ? (
              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {charts.topMovers.slice(0, 8).map((m: any, idx: number) => (
                  <div
                    key={m.medicineId ?? idx}
                    className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2 border border-white/5"
                  >
                    <div className="flex-1">
                      <p className="font-medium">
                        {m.medicine?.brandName ?? "Unknown"}
                      </p>
                      <p className="text-white/60">
                        {m.medicine?.category ?? "Uncategorized"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-200 font-semibold">
                        ₹{formatNumber(m.revenue ?? 0)}
                      </p>
                      <p className="text-white/60">{formatNumber(m.qtySold)} sold</p>
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
          <div className="p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-lg shadow-black/30">
            <h2 className="text-lg font-semibold mb-2">Low stock</h2>
            {data?.lists?.lowStock?.length ? (
              <div className="space-y-2 max-h-64 overflow-auto pr-1">
                {data.lists.lowStock.slice(0, 8).map((b: any) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2 border border-white/5"
                  >
                    <div>
                      <p className="font-medium">{b.medicine?.brandName ?? "Unknown"}</p>
                      <p className="text-white/60">Batch {b.batchNumber}</p>
                    </div>
                    <p className="text-amber-200 font-semibold">
                      Qty {formatNumber(b.qtyAvailable ?? 0)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Stock looks good" subtitle="Add inventory to monitor low-stock alerts." />
            )}
          </div>
          <div className="p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-lg shadow-black/30">
            <h2 className="text-lg font-semibold mb-2">Expiries soon</h2>
            {data?.lists?.expiries?.length ? (
              <div className="space-y-2 max-h-64 overflow-auto pr-1">
                {data.lists.expiries.slice(0, 8).map((b: any) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2 border border-white/5"
                  >
                    <div>
                      <p className="font-medium">{b.medicine?.brandName ?? "Unknown"}</p>
                      <p className="text-white/60">Batch {b.batchNumber}</p>
                    </div>
                    <p className="text-red-200 font-semibold">
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

        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-lg shadow-black/30">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Recent sales</h2>
            <span className="text-xs text-white/60">
              {data?.lists?.recentSales?.length ?? 0} records
            </span>
          </div>
          {data?.lists?.recentSales?.length ? (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-white/60">
                  <tr>
                    <th className="text-left pb-2 pr-4">Date</th>
                    <th className="text-left pb-2 pr-4">Value</th>
                    <th className="text-left pb-2 pr-4">Status</th>
                    <th className="text-left pb-2 pr-4">Items</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lists.recentSales.slice(0, 10).map((s: any) => (
                    <tr key={s.id} className="border-t border-white/5">
                      <td className="py-2 pr-4">
                        {new Date(s.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-emerald-200 font-semibold">
                        ₹{formatNumber(s.totalValue ?? 0)}
                      </td>
                      <td className="py-2 pr-4 text-white/70">{s.paymentStatus}</td>
                      <td className="py-2 pr-4 text-white/70">
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

