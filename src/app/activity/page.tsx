import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getDb, initDb } from "@/lib/db";
import { getRecentActivity } from "@/lib/activity";
import Navbar from "@/components/Navbar";
import { Timeline } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export function generateMetadata(): Metadata {
  return { title: getT().t("Activity") };
}

export default async function ActivityPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  if (session.role === "admin") redirect("/admin");

  await initDb();
  const db = getDb();

  const field = session.role === "vendor" ? "vendor_id" : "buyer_id";
  const snap = await db.collection("trades").where(field, "==", session.id).get();
  const trades = snap.docs.map(d => d.data() as any);
  const activity = await getRecentActivity(trades, 50);

  const { t } = getT();
  return (
    <div className="page">
      <Navbar user={{ name: session.name, role: session.role }} />
      <main className="container main" style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 className="page-title">{t("Activity")}</h1>
          <p className="page-sub">{t("A record of everything that has happened on your transactions.")}</p>
        </div>

        {activity.length > 0 ? (
          <div className="card card-pad">
            <Timeline
              events={activity.map(a => ({
                ...a,
                context: (
                  <Link href={`/trade/${a.trade_id}`} style={{ fontSize: 13, fontWeight: 600 }}>
                    {a.trade_title}
                  </Link>
                ),
              }))}
            />
          </div>
        ) : (
          <div className="card empty">
            <p className="empty-title">{t("No activity yet")}</p>
            <p className="empty-text">{t("Payments, deliveries and confirmations will be recorded here as they happen.")}</p>
          </div>
        )}
      </main>
    </div>
  );
}
