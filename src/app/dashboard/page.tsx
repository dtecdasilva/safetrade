import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getDb, initDb } from "@/lib/db";
import Navbar from "@/components/Navbar";
import { TrendingUp, Clock, CheckCircle, AlertTriangle, Plus } from "lucide-react";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: "Pending payment", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  funds_held:      { label: "Funds in escrow", color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  shipped:         { label: "Shipped",          color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  delivered:       { label: "Delivered",        color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  pending_release: { label: "Pending release",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  complete:        { label: "Complete",         color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  disputed:        { label: "Disputed",         color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  cancelled:       { label: "Cancelled",        color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  if (session.role === "admin") redirect("/admin");

  await initDb();
  const db = getDb();

  const field = session.role === "vendor" ? "vendor_id" : "buyer_id";

  // No orderBy — avoids composite index; sort newest-first in memory
  const snap = await db.collection("trades").where(field, "==", session.id).get();
  const trades = snap.docs
    .map(d => d.data() as any)
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1));

  const active         = trades.filter(t => !["complete", "cancelled"].includes(t.status));
  const completed      = trades.filter(t => t.status === "complete");
  const totalEscrow    = active.filter(t => t.status !== "pending_payment").reduce((s, t) => s + t.amount, 0);
  const pendingRelease = active.filter(t => t.status === "pending_release").length;
  const totalReleased  = session.role === "vendor" ? completed.reduce((s, t) => s + t.amount, 0) : 0;

  return (
    <div>
      <Navbar user={{ name: session.name, role: session.role }} />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>

        <div style={{ background: "#111812", border: "1px solid rgba(74,222,128,0.12)", borderRadius: 20, padding: "1.75rem 2rem", marginBottom: "1.5rem", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -40, top: -40, width: 200, height: 200, background: "radial-gradient(circle,rgba(34,197,94,0.07),transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
          <p style={{ fontSize: 11, color: "#22c55e", fontWeight: 700, letterSpacing: ".1em", marginBottom: 4 }}>
            {session.role === "vendor" ? "VENDOR DASHBOARD" : "BUYER DASHBOARD"}
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#f0fdf4", margin: "0 0 4px", letterSpacing: "-0.03em" }}>
            Hello, {session.name.split(" ")[0]} 👋
          </h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 1.25rem" }}>
            {active.length} active trade{active.length !== 1 ? "s" : ""} · FCFA {totalEscrow.toLocaleString()} in escrow
          </p>
          {session.role === "vendor" && (
            <Link href="/trade/new" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#22c55e", color: "#fff", padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              <Plus size={14} /> Create new trade
            </Link>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: "1.5rem" }}>
          {[
            session.role === "vendor"
              ? { icon: <TrendingUp size={16}/>, label: "Released funds", value: `FCFA ${totalReleased.toLocaleString()}`, color: "#22c55e" }
              : { icon: <TrendingUp size={16}/>, label: "In escrow",       value: `FCFA ${totalEscrow.toLocaleString()}`,   color: "#22c55e" },
            { icon: <Clock size={16}/>,        label: session.role === "vendor" ? "Pending release" : "Active trades", value: session.role === "vendor" ? String(pendingRelease) : String(active.length), color: "#60a5fa" },
            { icon: <CheckCircle size={16}/>,  label: "Completed", value: String(completed.length), color: "#a78bfa" },
          ].map((s, i) => (
            <div key={i} style={{ background: "#111812", border: "1px solid rgba(74,222,128,0.12)", borderRadius: 14, padding: "1.1rem 1.25rem" }}>
              <div style={{ color: s.color, marginBottom: 6 }}>{s.icon}</div>
              <p style={{ fontSize: 22, fontWeight: 700, color: "#f0fdf4", margin: "0 0 2px", fontFamily: "monospace" }}>{s.value}</p>
              <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {pendingRelease > 0 && (
          <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={16} color="#f59e0b" />
            <p style={{ fontSize: 13, color: "#f59e0b", margin: 0 }}>
              {pendingRelease} trade{pendingRelease > 1 ? "s are" : " is"} confirmed and waiting for admin to release funds
            </p>
          </div>
        )}

        {active.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#f0fdf4", marginBottom: 10 }}>Active Trades</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {active.map(t => <TradeRow key={t.id} trade={t} role={session.role} />)}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#f0fdf4", marginBottom: 10 }}>Completed</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {completed.map(t => <TradeRow key={t.id} trade={t} role={session.role} />)}
            </div>
          </div>
        )}

        {trades.length === 0 && (
          <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#6b7280" }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>No trades yet</p>
            {session.role === "buyer" && (
              <p style={{ fontSize: 13 }}>A vendor will send you a trade link when they create one for you.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function TradeRow({ trade, role }: { trade: any; role: string }) {
  const meta = STATUS_META[trade.status] || STATUS_META.cancelled;
  const counterparty  = role === "buyer" ? trade.vendor_name  : trade.buyer_name;
  const counterAvatar = role === "buyer" ? trade.vendor_avatar : trade.buyer_avatar;
  const label = role === "buyer" ? "Vendor" : "Buyer";

  return (
    <Link href={`/trade/${trade.id}`} style={{ textDecoration: "none" }}>
      <div style={{ background: "#111812", border: "1px solid rgba(74,222,128,0.12)", borderRadius: 14, padding: "14px 16px", cursor: "pointer", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: meta.color, opacity: 0.5 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ flex: 1, marginRight: 12 }}>
            <p style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace", marginBottom: 3 }}>
              #{trade.id.slice(0, 8).toUpperCase()} · {role.toUpperCase()}
            </p>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f0fdf4", margin: 0 }}>{trade.title}</h3>
          </div>
          <div style={{ padding: "3px 10px", borderRadius: 20, background: meta.bg, color: meta.color, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", border: `1px solid ${meta.color}30` }}>
            {meta.label}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#4ade80", fontFamily: "monospace" }}>
              {counterAvatar || counterparty?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#6b7280", margin: 0 }}>{label}</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#f0fdf4", margin: 0 }}>{counterparty}</p>
            </div>
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: trade.status === "complete" ? "#6b7280" : "#4ade80", fontFamily: "monospace", margin: 0 }}>
            FCFA {trade.amount.toLocaleString()}
          </p>
        </div>
        {trade.delivery_deadline && !["complete", "cancelled", "disputed"].includes(trade.status) && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(74,222,128,0.08)", fontSize: 11, color: "#6b7280" }}>
            Delivery deadline: {new Date(trade.delivery_deadline).toLocaleDateString()}
          </div>
        )}
      </div>
    </Link>
  );
}
