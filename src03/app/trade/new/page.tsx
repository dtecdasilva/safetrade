"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PageLoader, PhoneField } from "@/components/ui";
import { money } from "@/lib/zola";

export default function NewTradePage() {
  const router = useRouter();
  const [user, setUser]   = useState<any>(null);
  const [form, setForm]   = useState({ title: "", description: "", amount: "", buyerPhone: "", deliveryDays: "7" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (!d.user) { router.push("/auth/login"); return; }
      if (d.user.role !== "vendor") { router.push("/dashboard"); return; }
      setUser(d.user);
    });
  }, [router]);

  const amount     = parseFloat(form.amount) || 0;
  const fee        = parseFloat((amount * 0.015).toFixed(2));
  const buyerTotal = parseFloat((amount + fee).toFixed(2));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.title, description: form.description, amount, buyerPhone: form.buyerPhone, deliveryDays: parseInt(form.deliveryDays) }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push(`/trade/${data.tradeId}`);
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  if (!user) return <PageLoader />;

  const valid = form.title && form.description.trim() && form.buyerPhone && amount > 0;

  return (
    <div className="page">
      <Navbar user={{ name: user.name, role: user.role }} />

      <main className="container main narrow">
        <Link href="/dashboard" className="back-link">
          <ArrowLeft size={15} /> Back
        </Link>

        <div style={{ marginBottom: 24 }}>
          <h1 className="page-title">Create a transaction</h1>
          <p className="page-sub">Describe what you&apos;re selling. Zola notifies the buyer and holds their payment until delivery is confirmed.</p>
        </div>

        {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit} className="stack">
          <div className="card card-pad stack">
            <div className="field">
              <label className="label" htmlFor="title">What are you selling?</label>
              <input id="title" className="input" type="text" placeholder="e.g. iPhone 14 Pro, 128GB" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
            </div>

            <div className="field">
              <label className="label" htmlFor="description">Description</label>
              <textarea id="description" className="textarea" rows={3}
                placeholder="Condition, what's included, how it will be delivered" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required />
              <p className="hint">The buyer sees this before paying. Be specific about what you both agreed.</p>
            </div>

            <div className="field">
              <label className="label" htmlFor="buyerPhone">Buyer&apos;s phone number</label>
              <PhoneField id="buyerPhone" value={form.buyerPhone} onChange={v => setForm(p => ({ ...p, buyerPhone: v }))} required />
              <p className="hint">The buyer needs a Zola account registered with this number.</p>
            </div>

            <div className="form-grid-2">
              <div className="field">
                <label className="label" htmlFor="amount">Item price (FCFA)</label>
                <input id="amount" className="input num" type="number" min="1" placeholder="0" inputMode="numeric" value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required />
              </div>
              <div className="field">
                <label className="label" htmlFor="days">Delivery time (days)</label>
                <input id="days" className="input num" type="number" min="1" max="60" inputMode="numeric" value={form.deliveryDays}
                  onChange={e => setForm(p => ({ ...p, deliveryDays: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Fee breakdown */}
          {amount > 0 && (
            <div className="card card-pad fade-up">
              <h2 className="section-title" style={{ marginBottom: 8 }}>Who pays what</h2>
              <div className="kv"><span>Item price</span><span>{money(amount)}</span></div>
              <div className="kv"><span>Zola fee (1.5%), added to the buyer&apos;s total</span><span>{money(fee)}</span></div>
              <div className="kv kv-total"><span>Buyer pays</span><span>{money(buyerTotal)}</span></div>
              <div className="receipt-out" style={{ marginTop: 14 }}>
                <span>You receive</span><strong>{money(amount)}</strong>
              </div>
            </div>
          )}

          <button type="submit" disabled={!valid || loading} className="btn btn-primary btn-lg btn-block">
            {loading ? "Creating..." : "Create transaction and notify buyer"}
          </button>

          <p className="protect" style={{ justifyContent: "center" }}>
            <ShieldCheck size={16} />
            <span>You can edit or delete this transaction until the buyer pays.</span>
          </p>
        </form>
      </main>
    </div>
  );
}
