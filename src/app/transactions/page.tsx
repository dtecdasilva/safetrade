import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getDb, initDb } from "@/lib/db";
import ModeSwitch from "@/components/ModeSwitch";
import Navbar from "@/components/Navbar";
import TradeList from "@/components/TradeList";
import { getT } from "@/lib/i18n/server";

export function generateMetadata(): Metadata {
  return { title: getT().t("Transactions") };
}

export default async function TransactionsPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  if (session.role === "admin") redirect("/admin");

  await initDb();
  const db = getDb();

  const field = session.role === "vendor" ? "vendor_id" : "buyer_id";
  const snap = await db.collection("trades").where(field, "==", session.id).get();
  const trades = snap.docs
    .map(d => d.data() as any)
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1));

  const pendingRelease = trades.filter(t => t.status === "pending_release").length;
  const { t } = getT();

  return (
    <div className="page">
      <Navbar user={{ name: session.name, role: session.role }} />
      <main className="container main" style={{ maxWidth: 820 }}>
        <div className="dash-head">
          <div>
            <h1 className="page-title">{t("Transactions")}</h1>
            <p className="page-sub">{session.role === "vendor" ? t("Everything you're selling, newest first.") : t("Everything you're buying, newest first.")}</p>
          </div>
          <div className="dash-actions">
            <ModeSwitch role={session.role} />
            <Link href="/trade/new" className="btn btn-primary"><Plus size={17} /> {t("New transaction")}</Link>
          </div>
        </div>
        <TradeList trades={trades} role={session.role} pendingRelease={pendingRelease} />
      </main>
    </div>
  );
}
