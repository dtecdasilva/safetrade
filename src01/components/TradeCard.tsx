"use client";
import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";
import { Trade, STATUS_META } from "@/lib/types";

export default function TradeCard({ trade }: { trade: Trade }) {
  const meta = STATUS_META[trade.status];
  const counterparty = trade.myRole === "buyer" ? trade.seller : trade.buyer;
  const held = !["pending_payment", "complete", "cancelled"].includes(trade.status);

  return (
    <Link href={`/trade/${trade.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div className="card card-pad" style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="tx-id" style={{ marginBottom: 4 }}>
              Transaction ID <strong>{trade.id}</strong>
            </p>
            <h3 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{trade.title}</h3>
          </div>
          <span className="pill" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span className="avatar">{counterparty.avatar}</span>
            <div style={{ minWidth: 0 }}>
              <p className="party-role">{trade.myRole === "buyer" ? "Seller" : "Buyer"}</p>
              <p className="party-name">{counterparty.name}</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              {held && <p className="hint">Held by Zola</p>}
              <p className={`tx-amount${trade.status === "complete" ? " is-quiet" : ""}`} style={{ fontSize: 16 }}>
                FCFA {trade.amount.toLocaleString("en-US")}
              </p>
            </div>
            <ArrowRight size={17} color="var(--ink-3)" />
          </div>
        </div>

        {trade.status === "complete" && (
          <p style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: "var(--emerald-press)", fontWeight: 600 }}>
            <CheckCircle size={15} />
            Completed. The payment was released to the seller.
          </p>
        )}
      </div>
    </Link>
  );
}
