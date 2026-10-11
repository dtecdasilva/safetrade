import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getDb, initDb } from "@/lib/db";
import Navbar from "@/components/Navbar";
import TradeList from "@/components/TradeList";

export const metadata: Metadata = { title: "Transactions" };

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

  return (
    <div className="page">
      <Navbar user={{ name: session.name, role: session.role }} />
      <main className="container main" style={{ maxWidth: 820 }}>
        <div className="dash-head">
          <div>
            <h1 className="page-title">Transactions</h1>
            <p className="page-sub">Every transaction you&apos;re part of, newest first.</p>
          </div>
          {session.role === "vendor" && (
            <Link href="/trade/new" className="btn btn-primary"><Plus size={17} /> New transaction</Link>
          )}
        </div>
        <TradeList trades={trades} role={session.role} pendingRelease={pendingRelease} />
      </main>
    </div>
  );
}
