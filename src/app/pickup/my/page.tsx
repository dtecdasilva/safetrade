"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, LogOut } from "lucide-react";
import { useT } from "@/components/I18n";
import { usePk } from "@/components/pickup/Base";
import { Pill } from "@/components/ui";
import { fmtDateTime, money } from "@/lib/zola";

/** The signed-in sender's deliveries. */
export default function MyDeliveries() {
  const { t, lang } = useT();
  const pk = usePk();
  const [list, setList] = useState<any[] | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    fetch("/api/pickup/deliveries", { cache: "no-store" }).then(async (r) => {
      if (r.status === 401) { window.location.href = pk("/signin?next=/my"); return; }
      const d = await r.json(); setList(d.deliveries || []);
    }).catch(() => setList([]));
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setName(d.user?.name || "")).catch(() => {});
  }, [pk]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = pk("/");
  }

  if (!list) return <div className="pk-card" style={{ display: "flex", justifyContent: "center", padding: 40 }}><span className="spinner" /></div>;

  return (
    <div className="pk-app">
      <section className="pk-card">
        <h1 className="pk-h1" style={{ marginBottom: 4 }}>{t("My deliveries")}</h1>
        {name && <p className="hint" style={{ marginBottom: 12 }}>{t("Signed in as {name}", { name })}</p>}
        <div className="btn-row">
          <Link href={pk("/send")} className="btn btn-primary"><Plus size={16} /> {t("Send a parcel")}</Link>
          <button className="btn btn-ghost" onClick={signOut}><LogOut size={15} /> {t("Sign out")}</button>
        </div>
      </section>
      {list.length === 0 && <section className="pk-card"><p className="hint">{t("You haven't sent anything yet.")}</p></section>}
      {list.map((d) => (
        <a key={d.id} href={pk(d.path)} className="pk-card pk-item" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
          <div className="kv" style={{ alignItems: "center" }}>
            <strong>{d.title}</strong>
            <Pill tone={d.status === "delivered" ? "ok" : d.status === "awaiting_payment" ? "wait" : "info"}>{t(d.label)}</Pill>
          </div>
          <p className="hint">{t("To {name}", { name: d.recipient })} · {d.dest}</p>
          <p className="hint num" suppressHydrationWarning>{fmtDateTime(d.created_at, lang)} · {money(d.fee)}{d.rider_name ? ` · ${d.rider_name}` : ""}</p>
        </a>
      ))}
    </div>
  );
}
