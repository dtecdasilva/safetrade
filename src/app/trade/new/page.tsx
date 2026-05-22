"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { ShieldCheck } from "lucide-react";
import { inp } from "@/lib/styles";

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
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:       form.title,
          description: form.description,
          amount,
          buyerPhone:  form.buyerPhone,
          deliveryDays: parseInt(form.deliveryDays),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push(`/trade/${data.tradeId}`);
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  }

  if (!user) return (
    <div style={{ minHeight: "100vh", background: "#0a0f0d", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>
      <div style={{ width: 28, height: 28, border: "2px solid rgba(74,222,128,0.2)", borderTop: "2px solid #22c55e", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const valid = form.title && form.buyerPhone && amount > 0;

  return (
    <div style={{ background: "#0a0f0d", minHeight: "100vh" }}>
      <Navbar user={{ name: user.name, role: user.role }} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <main style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{ marginBottom: "1.75rem" }}>
          <p style={{ fontSize: 11, color: "#22c55e", fontWeight: 700, letterSpacing: ".1em", marginBottom: 4 }}>VENDOR · NEW TRADE</p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0fdf4", margin: "0 0 4px", letterSpacing: "-0.03em" }}>Create a trade</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>The buyer will be notified and must pay to activate escrow.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {error && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#ef4444", marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Title */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>Item title</label>
            <input style={inp} type="text" placeholder="e.g. Sony A7 IV Camera, full kit"
              value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              onFocus={e => (e.target.style.borderColor = "rgba(74,222,128,0.35)")}
              onBlur={e => (e.target.style.borderColor = "rgba(74,222,128,0.15)")} required />
          </div>

          {/* Buyer phone */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>
              Buyer's phone number
            </label>
            <div style={{ display: "flex", alignItems: "center", background: "#0a0f0d", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 10, overflow: "hidden", transition: "border-color 0.2s" }}
              onFocus={() => {}} >
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px", borderRight: "1px solid rgba(74,222,128,0.1)", height: 44, background: "rgba(74,222,128,0.03)", flexShrink: 0 }}>
                <span style={{ fontSize: 16 }}>🇨🇲</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", fontFamily: "monospace" }}>+237</span>
              </div>
              <input
                type="tel"
                placeholder="6XXXXXXXX"
                value={form.buyerPhone}
                onChange={e => setForm(p => ({ ...p, buyerPhone: e.target.value.replace(/\D/g, "").slice(0, 9) }))}
                onFocus={e => (e.currentTarget.parentElement!.style.borderColor = "rgba(74,222,128,0.4)")}
                onBlur={e => (e.currentTarget.parentElement!.style.borderColor = "rgba(74,222,128,0.15)")}
                style={{ flex: 1, height: 44, padding: "0 14px", background: "transparent", border: "none", outline: "none", color: "#f0fdf4", fontSize: 14, fontFamily: "monospace" }}
                required
              />
            </div>
            <p style={{ fontSize: 11, color: "#4b5563", margin: "4px 0 0 2px" }}>
              The buyer must have a SafeTrade account with this number
            </p>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>Item description</label>
            <textarea style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} rows={3}
              placeholder="Condition, what's included, any notes..."
              value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              onFocus={e => (e.target.style.borderColor = "rgba(74,222,128,0.35)")}
              onBlur={e => (e.target.style.borderColor = "rgba(74,222,128,0.15)")} />
          </div>

          {/* Amount + delivery */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>Item price (FCFA)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#6b7280", fontFamily: "monospace", fontSize: 11 }}>FCFA</span>
                <input style={{ ...inp, paddingLeft: 50 }} type="number" min="1" placeholder="0"
                  value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  onFocus={e => (e.target.style.borderColor = "rgba(74,222,128,0.35)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(74,222,128,0.15)")} required />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>Delivery window (days)</label>
              <input style={inp} type="number" min="1" max="60" value={form.deliveryDays}
                onChange={e => setForm(p => ({ ...p, deliveryDays: e.target.value }))}
                onFocus={e => (e.target.style.borderColor = "rgba(74,222,128,0.35)")}
                onBlur={e => (e.target.style.borderColor = "rgba(74,222,128,0.15)")} />
            </div>
          </div>

          {/* Fee breakdown */}
          <div style={{ background: "#111812", border: "1px solid rgba(74,222,128,0.12)", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, fontWeight: 600 }}>Fee breakdown</p>
            {[
              ["Item price",          `FCFA ${amount.toFixed(2)}`,       "#f0fdf4"],
              ["SafeTrade fee (1.5%)", `+FCFA ${fee.toFixed(2)}`,        "#f59e0b"],
            ].map(([l, v, c]) => (
              <div key={l as string} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{l}</span>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: c as string }}>{v}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid rgba(74,222,128,0.12)", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#f0fdf4" }}>Buyer pays</span>
              <span style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 700, color: "#4ade80" }}>FCFA {buyerTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(74,222,128,0.08)" }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>You receive</span>
              <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#22c55e" }}>FCFA {amount.toFixed(2)}</span>
            </div>
          </div>

          <button type="submit" disabled={!valid || loading} style={{
            width: "100%", padding: "13px",
            background: valid ? "#22c55e" : "#162018",
            color: valid ? "#fff" : "#374151",
            border: "none", borderRadius: 12,
            fontSize: 14, fontWeight: 700,
            cursor: valid ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontFamily: "inherit", transition: "all .2s", opacity: loading ? 0.8 : 1,
          }}>
            <ShieldCheck size={15} />
            {loading ? "Creating trade..." : "Create trade & notify buyer"}
          </button>

          <p style={{ fontSize: 11, color: "#6b7280", textAlign: "center", marginTop: 10 }}>
            The buyer pays the item price + 1.5% fee. You receive the full item price.
          </p>
        </form>
      </main>
    </div>
  );
}
