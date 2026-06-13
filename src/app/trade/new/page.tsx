"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ArrowLeft } from "lucide-react";

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
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  }

  if (!user) return (
    <div style={{ minHeight: "100vh", background: "#0c0c0c", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 24, height: 24, border: "2px solid #1e1e1e", borderTop: "2px solid #22c55e", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", background: "#141414", border: "1px solid #242424", borderRadius: 8, color: "#f0f0f0", fontSize: 13, fontFamily: "inherit", outline: "none", transition: "border-color 0.15s", boxSizing: "border-box" as const };
  const valid = form.title && form.buyerPhone && amount > 0;

  return (
    <div style={{ background: "#0c0c0c", minHeight: "100vh" }}>
      <Navbar user={{ name: user.name, role: user.role }} />
      <style>{`input:focus, textarea:focus { border-color: #22c55e !important; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <main style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px 80px" }}>
        <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#555", fontSize: 13, textDecoration: "none", marginBottom: 24 }}>
          <ArrowLeft size={13} /> Back
        </Link>

        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, color: "#555", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>New trade</p>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#f0f0f0", letterSpacing: "-0.03em", margin: 0 }}>Create a trade</h1>
        </div>

        {error && <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#ef4444", marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#555", display: "block", marginBottom: 6 }}>Item title</label>
            <input style={inp} type="text" placeholder="e.g. iPhone 14 Pro, 128GB" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#555", display: "block", marginBottom: 6 }}>
              Buyer's phone number
            </label>
            <div style={{ display: "flex", background: "#141414", border: "1px solid #242424", borderRadius: 8, overflow: "hidden", transition: "border-color 0.15s" }}
              onFocus={() => {}} >
              <span style={{ padding: "0 12px", display: "flex", alignItems: "center", borderRight: "1px solid #242424", color: "#444", fontSize: 12, fontFamily: "monospace", background: "#1a1a1a", flexShrink: 0 }}>+237</span>
              <input type="tel" placeholder="6XXXXXXXX" value={form.buyerPhone}
                onChange={e => setForm(p => ({ ...p, buyerPhone: e.target.value.replace(/\D/g,"").slice(0,9) }))}
                onFocus={e => (e.currentTarget.parentElement!.style.borderColor = "#22c55e")}
                onBlur={e => (e.currentTarget.parentElement!.style.borderColor = "#242424")}
                style={{ flex: 1, height: 38, padding: "0 12px", background: "transparent", border: "none", outline: "none", color: "#f0f0f0", fontSize: 13, fontFamily: "monospace" }} required />
            </div>
            <p style={{ fontSize: 11, color: "#444", margin: "4px 0 0 2px" }}>Buyer must have a SafeTrade account with this number</p>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#555", display: "block", marginBottom: 6 }}>Description</label>
            <textarea style={{ ...inp, resize: "vertical" as const, lineHeight: 1.5 }} rows={3}
              placeholder="Condition, included accessories, notes..." value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#555", display: "block", marginBottom: 6 }}>Item price (FCFA)</label>
              <input style={inp} type="number" min="1" placeholder="0" value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#555", display: "block", marginBottom: 6 }}>Delivery (days)</label>
              <input style={inp} type="number" min="1" max="60" value={form.deliveryDays}
                onChange={e => setForm(p => ({ ...p, deliveryDays: e.target.value }))} />
            </div>
          </div>

          {/* Fee breakdown */}
          {amount > 0 && (
            <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 8, padding: "12px 14px" }}>
              {[
                ["Item price",       `FCFA ${amount.toLocaleString()}`,       "#888"],
                ["SafeTrade fee (1.5%)", `+ FCFA ${fee.toLocaleString()}`,    "#f59e0b"],
                ["Buyer pays",       `FCFA ${buyerTotal.toLocaleString()}`,   "#f0f0f0"],
              ].map(([l,v,c]) => (
                <div key={l as string} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span style={{ fontSize: 12, color: "#555" }}>{l}</span>
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: c as string, fontWeight: l === "Buyer pays" ? 600 : 400 }}>{v}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #1e1e1e", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#555" }}>You receive</span>
                <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 600, color: "#22c55e" }}>FCFA {amount.toLocaleString()}</span>
              </div>
            </div>
          )}

          <button type="submit" disabled={!valid || loading}
            style={{ padding: "10px", background: valid ? "#22c55e" : "#1a1a1a", color: valid ? "#fff" : "#444", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: valid ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: loading ? 0.7 : 1, marginTop: 4 }}>
            {loading ? "Creating..." : "Create trade & notify buyer"}
          </button>
        </form>
      </main>
    </div>
  );
}
