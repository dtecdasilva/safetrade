import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, initDb } from "@/lib/db";
import { getRecentActivity } from "@/lib/activity";
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

  const activity = await getRecentActivity(trades, 5, 10);

  // One account buys and sells: count what is going on on the other side,
  // so the switch can show it
  const otherField = field === "vendor_id" ? "buyer_id" : "vendor_id";
  const [otherSnap, meDoc] = await Promise.all([
    db.collection("trades").where(otherField, "==", session.id).get(),
    db.collection("users").doc(session.id).get(),
  ]);
  const otherActive = otherSnap.docs.filter(d => !["complete", "cancelled"].includes((d.data() as any).status)).length;
  const flagged = !!(meDoc.data() as any)?.flagged;

  return <DashboardClient session={session} trades={trades} activity={activity} otherActive={otherActive} flagged={flagged} />;
}
