import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getDb, initDb } from "@/lib/db";
import Navbar from "@/components/Navbar";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
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

  return <DashboardClient session={session} trades={trades} />;
}
