"use client";

import { useState } from "react";
import { Search, X, Clock } from "lucide-react";
import TxRow from "@/components/TxRow";
import { useT } from "@/components/I18n";
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
  const { t } = useT();
  const tr = t;
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
        tr(statusMeta(t.status).label).toLowerCase().includes(q) ||
        String(t.amount).includes(q)
      )
    : inFilter;

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all",       label: t("All ({n})", { n: trades.length }) },
    { key: "active",    label: t("Active ({n})", { n: active.length }) },
    { key: "completed", label: t("Completed ({n})", { n: completed.length }) },
  ];

  return (
    <>
      {pendingRelease > 0 && (
        <div className="notice notice-ok" style={{ marginBottom: 16 }}>
          <Clock size={16} />
          <span>
            {pendingRelease > 1
              ? t("{n} transactions under review. Zola holds the payment for 24 hours after delivery is confirmed, then releases it.", { n: pendingRelease })
              : t("1 transaction under review. Zola holds the payment for 24 hours after delivery is confirmed, then releases it.")}
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
            placeholder={t("Search by item, name, status, amount or ID")}
            aria-label={t("Search transactions")}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")} aria-label={t("Clear search")}>
              <X size={16} />
            </button>
          )}
        </div>
        <div className="seg" role="group" aria-label={t("Filter transactions")}>
          {FILTERS.map(f => (
            <button key={f.key} className="seg-item" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {q && (
        <p className="hint" style={{ marginBottom: 10 }}>
          {shown.length === 1 ? t("1 result for “{q}”", { q: search }) : t("{n} results for “{q}”", { n: shown.length, q: search })}
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
              <p className="empty-title">{t("No transactions yet")}</p>
              <p className="empty-text">
                {role === "buyer"
                  ? t("When a seller creates a transaction for your number, it will appear here.")
                  : t("Create a transaction and Zola will notify the buyer.")}
              </p>
            </>
          ) : (
            <>
              <p className="empty-title">{t("Nothing matches")}</p>
              <p className="empty-text">{t("Try a different search, or switch the filter to All.")}</p>
            </>
          )}
        </div>
      )}
    </>
  );
}
