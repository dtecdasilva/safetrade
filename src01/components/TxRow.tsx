"use client";
import Link from "next/link";
import { useT } from "@/components/I18n";
import { StatusPill } from "@/components/ui";
import { fmtDate, money } from "@/lib/zola";

/** One transaction in a list. `role` is the viewer's account role. */
export default function TxRow({ trade, role }: { trade: any; role: string }) {
  const { t, lang } = useT();
  const counterparty = role === "buyer" ? trade.vendor_name : trade.buyer_name;
  const label        = role === "buyer" ? t("Seller") : t("Buyer");
  const showDue      = trade.delivery_deadline && !["complete", "cancelled", "disputed"].includes(trade.status);

  return (
    <Link href={`/trade/${trade.id}`} className="tx-row">
      <div style={{ minWidth: 0 }}>
        <p className="tx-title">{trade.title}</p>
        <div className="tx-meta">
          <span>{label}: {counterparty ? (counterparty === "Invited buyer" ? t(counterparty) : counterparty) : "—"}</span>
          {showDue && <span suppressHydrationWarning>{t("Due {date}", { date: fmtDate(trade.delivery_deadline, lang) })}</span>}
        </div>
      </div>
      <div className="tx-side">
        <span className={`tx-amount${trade.status === "complete" || trade.status === "cancelled" ? " is-quiet" : ""}`}>
          {money(trade.amount)}
        </span>
        <StatusPill status={trade.status} />
      </div>
    </Link>
  );
}
