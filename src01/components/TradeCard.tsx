"use client";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Trade, STATUS_META } from "@/lib/types";

export default function TradeCard({ trade }: { trade: Trade }) {
  const meta = STATUS_META[trade.status];
  const counterparty = trade.myRole === "buyer" ? trade.seller : trade.buyer;

  return (
    <Link href={`/trade/${trade.id}`} style={{ textDecoration: "none" }}>
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "1.25rem",
        cursor: "pointer",
        transition: "all 0.2s",
        position: "relative",
        overflow: "hidden",
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
          (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLElement).style.background = "var(--bg-card)";
        }}
      >
        {/* Status bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: meta.color, opacity: 0.6,
        }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ flex: 1, marginRight: 12 }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
              #{trade.id} · {trade.myRole.toUpperCase()}
            </p>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: 0, lineHeight: 1.3 }}>
              {trade.title}
            </h3>
          </div>
          <div style={{
            padding: "4px 10px", borderRadius: 20,
            background: meta.bg, color: meta.color,
            fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
          }}>
            {meta.label}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "var(--green-glow)", border: "1px solid var(--border-strong)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: "var(--green-text)",
              fontFamily: "var(--font-mono)",
            }}>
              {counterparty.avatar}
            </div>
            <div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                {trade.myRole === "buyer" ? "Seller" : "Buyer"}
              </p>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", margin: 0 }}>
                {counterparty.name}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, fontFamily: "var(--font-mono)" }}>ESCROW</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: trade.status === "complete" ? "var(--text-muted)" : "var(--green-text)", margin: 0, fontFamily: "var(--font-mono)" }}>
                FCFA {trade.amount.toLocaleString()}
              </p>
            </div>
            <ArrowRight size={16} color="var(--text-muted)" />
          </div>
        </div>

        {trade.status === "complete" && (
          <div style={{
            marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 11, color: "var(--green)", fontWeight: 500,
          }}>
            <ShieldCheck size={12} />
            Trade completed successfully
          </div>
        )}
      </div>
    </Link>
  );
}
