"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, X, AlertTriangle } from "lucide-react";

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

function TradeRow({ trade, role }: { trade: any; role: string }) {
  const meta = STATUS_META[trade.status] || STATUS_META.cancelled;
  const counterparty  = role === "buyer" ? trade.vendor_name  : trade.buyer_name;
  const counterAvatar = role === "buyer" ? trade.vendor_avatar : trade.buyer_avatar;
  const label = role === "buyer" ? "Vendor" : "Buyer";

  return (
    <Link href={`/trade/${trade.id}`} style={{ textDecoration: "none" }}>
      <div className="trade-row" style={{ background: "#111812", border: "1px solid rgba(74,222,128,0.1)", borderRadius: 14, padding: "14px 16px", cursor: "pointer", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: meta.color, opacity: 0.4 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace", marginBottom: 2 }}>#{trade.id.slice(0,8).toUpperCase()} · {role.toUpperCase()}</p>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f0fdf4", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trade.title}</h3>
          </div>
          <span style={{ padding: "3px 10px", borderRadius: 20, background: meta.bg, color: meta.color, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", border: `1px solid ${meta.color}25`, flexShrink: 0 }}>
            {meta.label}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#4ade80", fontFamily: "monospace", flexShrink: 0 }}>
              {counterAvatar || counterparty?.slice(0,2).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#6b7280", margin: 0 }}>{label}</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#f0fdf4", margin: 0 }}>{counterparty}</p>
            </div>
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: trade.status === "complete" ? "#6b7280" : "#4ade80", fontFamily: "monospace", margin: 0 }}>
            FCFA {Number(trade.amount).toLocaleString()}
          </p>
        </div>
        {trade.delivery_deadline && !["complete","cancelled","disputed"].includes(trade.status) && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(74,222,128,0.06)", fontSize: 11, color: "#6b7280" }}>
            📅 Deadline: {new Date(trade.delivery_deadline).toLocaleDateString()}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function TradeList({
  trades,
  role,
  pendingRelease,
}: {
  trades: any[];
  role: string;
  pendingRelease: number;
}) {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase().trim();

  const active    = trades.filter(t => !["complete", "cancelled"].includes(t.status));
  const completed = trades.filter(t => t.status === "complete");

  const filtered = q
    ? trades.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.id?.toLowerCase().includes(q) ||
        t.buyer_name?.toLowerCase().includes(q) ||
        t.vendor_name?.toLowerCase().includes(q) ||
        t.status?.toLowerCase().includes(q) ||
        String(t.amount).includes(q)
      )
    : null;

  return (
    <>
      {/* Alert */}
      {pendingRelease > 0 && (
        <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "11px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={14} color="#f59e0b" />
          <p style={{ fontSize: 13, color: "#f59e0b", margin: 0 }}>
            {pendingRelease} trade{pendingRelease > 1 ? "s" : ""} confirmed — waiting for admin to release funds
          </p>
        </div>
      )}

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#6b7280", pointerEvents: "none" }} />
        <input
          className="search-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title, ID, name, status, amount..."
          style={{
            width: "100%", padding: "11px 40px 11px 38px",
            background: "#111812", border: "1px solid rgba(74,222,128,0.12)",
            borderRadius: 12, color: "#f0fdf4", fontSize: 13,
            fontFamily: "inherit", outline: "none",
            boxSizing: "border-box",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        />
        {search && (
          <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 2, display: "flex" }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Search results */}
      {filtered && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""} for "{search}"
          </p>
          {filtered.length === 0 ? (
            <div style={{ background: "#111812", border: "1px solid rgba(74,222,128,0.1)", borderRadius: 14, padding: "2rem", textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>No trades match your search</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map(t => <TradeRow key={t.id} trade={t} role={role} />)}
            </div>
          )}
        </div>
      )}

      {/* Active trades */}
      {!filtered && active.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".08em", marginBottom: 8 }}>ACTIVE</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {active.map(t => <TradeRow key={t.id} trade={t} role={role} />)}
          </div>
        </div>
      )}

      {/* Completed */}
      {!filtered && completed.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".08em", marginBottom: 8 }}>COMPLETED</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {completed.map(t => <TradeRow key={t.id} trade={t} role={role} />)}
          </div>
        </div>
      )}

      {!filtered && trades.length === 0 && (
        <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#6b7280" }}>
          <p style={{ fontSize: 15, marginBottom: 8 }}>No trades yet</p>
          {role === "buyer" && <p style={{ fontSize: 13 }}>A vendor will send you a trade link when ready.</p>}
        </div>
      )}
    </>
  );
}