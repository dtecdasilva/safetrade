"use client";

import { useState } from "react";
import { Search, X, Clock } from "lucide-react";
import TxRow from "@/components/TxRow";
import { statusMeta } from "@/lib/zola";

type Filter = "all" | "active" | "completed";

/** Searchable, filterable list of a person's transactions. */
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
  const [filter, setFilter] = useState<Filter>("all");
  const q = search.toLowerCase().trim();

  const active    = trades.filter(t => !["complete", "cancelled"].includes(t.status));
  const completed = trades.filter(t => t.status === "complete");

  const inFilter = filter === "active" ? active : filter === "completed" ? completed : trades;

  const shown = q
    ? inFilter.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.id?.toLowerCase().includes(q) ||
        t.buyer_name?.toLowerCase().includes(q) ||
        t.vendor_name?.toLowerCase().includes(q) ||
        t.status?.toLowerCase().includes(q) ||
        statusMeta(t.status).label.toLowerCase().includes(q) ||
        String(t.amount).includes(q)
      )
    : inFilter;

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all",       label: `All (${trades.length})` },
    { key: "active",    label: `Active (${active.length})` },
    { key: "completed", label: `Completed (${completed.length})` },
  ];

  return (
    <>
      {pendingRelease > 0 && (
        <div className="notice notice-ok" style={{ marginBottom: 16 }}>
          <Clock size={16} />
          <span>
            {pendingRelease} transaction{pendingRelease > 1 ? "s" : ""} delivered. Zola is releasing {pendingRelease > 1 ? "those payments" : "the payment"}.
          </span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <div className="search">
          <Search size={17} className="search-icon" />
          <input
            className="input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by item, name, status, amount or ID"
            aria-label="Search transactions"
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="seg" role="group" aria-label="Filter transactions">
          {FILTERS.map(f => (
            <button key={f.key} className="seg-item" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {q && (
        <p className="hint" style={{ marginBottom: 10 }}>
          {shown.length} result{shown.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
        </p>
      )}

      {shown.length > 0 ? (
        <div className="card tx-list">
          {shown.map(t => <TxRow key={t.id} trade={t} role={role} />)}
        </div>
      ) : (
        <div className="card empty">
          {trades.length === 0 ? (
            <>
              <p className="empty-title">No transactions yet</p>
              <p className="empty-text">
                {role === "buyer"
                  ? "When a seller creates a transaction for your number, it will appear here."
                  : "Create a transaction and Zola will notify the buyer."}
              </p>
            </>
          ) : (
            <>
              <p className="empty-title">Nothing matches</p>
              <p className="empty-text">Try a different search, or switch the filter to All.</p>
            </>
          )}
        </div>
      )}
    </>
  );
}
