"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ArrowLeft, ShieldCheck, UserPlus } from "lucide-react";
import { PageLoader, PhoneField } from "@/components/ui";
import { money } from "@/lib/zola";
import { quote, feePercentLabel, DELIVERY_FEE, DELIVERY_NOTE } from "@/lib/fees";
import { handoverHow } from "@/lib/handover";
import { useT } from "@/components/I18n";

export default function NewTradePage() {
  const router = useRouter();
  const { t, lang } = useT();
  const [user, setUser]   = useState<any>(null);
  const [form, setForm]   = useState({ title: "", description: "", amount: "", buyerPhone: "", deliveryDays: "7", needsDelivery: true });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // The buyer's number isn't on Zola yet: ask for their email and invite them
  const [needEmail, setNeedEmail]   = useState(false);
  const [buyerEmail, setBuyerEmail] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (!d.user) { router.push("/auth/login"); return; }
      if (d.user.role !== "vendor") { router.push("/dashboard"); return; }
      setUser(d.user);
      // Sellers who said at signup that they only sell services start with delivery off
      fetch("/api/profile").then(r => r.json()).then(p => {
        if (p.profile?.sells === "services") setForm(f => ({ ...f, needsDelivery: false }));
      }).catch(() => {});
    });
  }, [router]);

  useEffect(() => { if (needEmail) emailRef.current?.focus(); }, [needEmail]);

  const amount     = parseFloat(form.amount) || 0;
  const { fee, deliveryFee, total: buyerTotal } = quote(amount, form.needsDelivery);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.title, description: form.description, amount, buyerPhone: form.buyerPhone, buyerEmail: needEmail ? buyerEmail : "", deliveryDays: parseInt(form.deliveryDays), needsDelivery: form.needsDelivery }) });
      const data = await res.json();
      if (!res.ok) {
        // Not an error: this buyer simply needs an invitation
        if (data.code === "buyer_not_found") { setNeedEmail(true); return; }
        setError(data.error); return;
      }
      router.push(`/trade/${data.tradeId}`);
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  if (!user) return <PageLoader />;

  const valid = form.title && form.description.trim() && form.buyerPhone && amount > 0 && (!needEmail || buyerEmail.trim());

  return (
    <div className="page">
      <Navbar user={{ name: user.name, role: user.role }} />

      <main className="container main narrow">
        <Link href="/dashboard" className="back-link">
          <ArrowLeft size={15} /> {t("Back")}
        </Link>

        <div style={{ marginBottom: 24 }}>
          <h1 className="page-title">{t("Create a transaction")}</h1>
          <p className="page-sub">{t("Describe what you're selling. Zola notifies the buyer and holds their payment until delivery is confirmed.")}</p>
        </div>

        {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 16 }}>{t(error)}</div>}

        <form onSubmit={handleSubmit} className="stack">
          <div className="card card-pad stack">
            <div className="field">
              <label className="label" htmlFor="title">{t("What are you selling?")}</label>
              <input id="title" className="input" type="text" placeholder={t("e.g. iPhone 14 Pro, 128GB")} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
            </div>

            <div className="field">
              <label className="label" htmlFor="description">{t("Description")}</label>
              <textarea id="description" className="textarea" rows={3}
                placeholder={t("Condition, what's included, how it will be delivered")} value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required />
              <p className="hint">{t("The buyer sees this before paying. Be specific about what you both agreed.")}</p>
            </div>

            <div className="field">
              <span className="label">{t("Does it need to be delivered?")}</span>
              <div className="seg" role="group" aria-label={t("Delivery")}>
                <button type="button" className="seg-item" aria-pressed={form.needsDelivery}
                  onClick={() => setForm(p => ({ ...p, needsDelivery: true }))}>
                  {t("Yes, deliver it")}
                </button>
                <button type="button" className="seg-item" aria-pressed={!form.needsDelivery}
                  onClick={() => setForm(p => ({ ...p, needsDelivery: false }))}>
                  {t("No, nothing to deliver")}
                </button>
              </div>
              {form.needsDelivery ? (
                <div className="notice notice-info" style={{ marginTop: 4 }}>
                  <ShieldCheck size={16} />
                  <span>
                    <strong style={{ color: "var(--navy)" }}>{t("You send the item to Zola, not straight to the buyer.")}</strong>{" "}
                    {t("Zola delivers it. The buyer pays the {delivery} delivery, so it costs you nothing.", { delivery: money(DELIVERY_FEE) })}{" "}
                    {t("Once the buyer has paid:")} {handoverHow(lang)}
                  </span>
                </div>
              ) : (
                <p className="hint">{t("For services, digital items, or anything you hand over yourself. No delivery fee is added.")}</p>
              )}
            </div>

            <div className="field">
              <label className="label" htmlFor="buyerPhone">{t("Buyer's phone number")}</label>
              <PhoneField id="buyerPhone" value={form.buyerPhone} onChange={v => { setForm(p => ({ ...p, buyerPhone: v })); setNeedEmail(false); }} required />
              <p className="hint">{t("Not on Zola yet? No problem. We'll ask for their email and invite them to sign up and pay.")}</p>
            </div>

            {needEmail && (
              <div className="invite-box fade-up" role="status">
                <p className="invite-title"><UserPlus size={17} /> {t("This buyer isn't on Zola yet")}</p>
                <p className="hint" style={{ fontSize: 14, margin: "4px 0 12px" }}>
                  {t("Add their email. Zola creates the transaction and invites them by email and WhatsApp ({phone}) to sign up so they can pay.", { phone: `+237 ${form.buyerPhone}` })}
                </p>
                <div className="field">
                  <label className="label" htmlFor="buyerEmail">{t("Buyer's email")}</label>
                  <input id="buyerEmail" ref={emailRef} className="input" type="email" inputMode="email" autoComplete="off"
                    placeholder={t("buyer@example.com")} value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} required />
                </div>
              </div>
            )}

            <div className="form-grid-2">
              <div className="field">
                <label className="label" htmlFor="amount">{t("Item price (FCFA)")}</label>
                <input id="amount" className="input num" type="number" min="1" placeholder="0" inputMode="numeric" value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required />
              </div>
              <div className="field">
                <label className="label" htmlFor="days">{form.needsDelivery ? t("Delivery time (days)") : t("Time to complete (days)")}</label>
                <input id="days" className="input num" type="number" min="1" max="60" inputMode="numeric" value={form.deliveryDays}
                  onChange={e => setForm(p => ({ ...p, deliveryDays: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Fee breakdown */}
          {amount > 0 && (
            <div className="card card-pad fade-up">
              <h2 className="section-title" style={{ marginBottom: 8 }}>{t("Who pays what")}</h2>
              <div className="kv"><span>{t("Item price")}</span><span>{money(amount)}</span></div>
              <div className="kv"><span>{t("Zola fee ({rate}), paid by the buyer", { rate: feePercentLabel(amount) })}</span><span>{money(fee)}</span></div>
              {deliveryFee > 0 && <div className="kv"><span>{t("Delivery, paid by the buyer")}</span><span>{money(deliveryFee)}</span></div>}
              <div className="kv kv-total"><span>{t("Buyer pays")}</span><span>{money(buyerTotal)}</span></div>
              <div className="receipt-out" style={{ marginTop: 14 }}>
                <span>{t("You receive")}</span><strong>{money(amount)}</strong>
              </div>
              <p className="hint" style={{ marginTop: 12 }}>
                {deliveryFee > 0
                  ? t("The buyer pays the Zola fee and delivery on top of your price. Nothing is taken from what you receive.")
                  : t("The buyer pays the Zola fee on top of your price. Nothing is taken from what you receive.")}
              </p>
              {deliveryFee > 0 && (
                <p className="hint" style={{ marginTop: 12 }}>
                  {t("Delivery is {delivery} for a standard delivery. If the item costs more than that to deliver, the buyer pays the difference.", { delivery: money(DELIVERY_FEE) })}
                </p>
              )}
            </div>
          )}

          <button type="submit" disabled={!valid || loading} className="btn btn-primary btn-lg btn-block">
            {loading ? t("Creating...") : needEmail ? t("Create transaction and invite buyer") : t("Create transaction and notify buyer")}
          </button>

          <p className="protect" style={{ justifyContent: "center" }}>
            <ShieldCheck size={16} />
            <span>{t("You can edit or delete this transaction until the buyer pays. After that it is locked.")}</span>
          </p>
        </form>
      </main>
    </div>
  );
}
