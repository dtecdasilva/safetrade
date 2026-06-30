"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm]       = useState({ name: "", email: "", password: "", role: "buyer", phone: "" });
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push("/dashboard");
      router.refresh();
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px",
    background: "#141414", border: "1px solid #242424",
    borderRadius: 8, color: "#f0f0f0", fontSize: 14,
    fontFamily: "inherit", outline: "none", transition: "border-color 0.15s",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0c0c0c", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <style>{`
        input:focus { border-color: #22c55e !important; }
        a { color: #22c55e; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .eye-btn:hover { color: #f0f0f0 !important; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
          <div style={{ width: 28, height: 28, background: "#22c55e", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={15} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#f0f0f0", letterSpacing: "-0.02em" }}>SafeTrade</span>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#f0f0f0", margin: "0 0 6px", letterSpacing: "-0.03em" }}>Create account</h1>
        <p style={{ fontSize: 14, color: "#555", margin: "0 0 24px" }}>Secure escrow trading in Cameroon</p>

        {/* Role toggle */}
        <div style={{ display: "flex", background: "#141414", border: "1px solid #242424", borderRadius: 8, padding: 3, marginBottom: 20 }}>
          {[{ val: "buyer", label: "Buyer" }, { val: "vendor", label: "Vendor" }].map(r => (
            <button key={r.val} type="button" onClick={() => setForm(f => ({ ...f, role: r.val }))}
              style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s", background: form.role === r.val ? "#1e1e1e" : "transparent", color: form.role === r.val ? "#f0f0f0" : "#555", boxShadow: form.role === r.val ? "0 1px 3px rgba(0,0,0,0.4)" : "none" }}>
              {r.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#ef4444", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#888", display: "block", marginBottom: 6 }}>Full name</label>
            <input style={inp} type="text" placeholder="Jordan Lee"
              value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#888", display: "block", marginBottom: 6 }}>Email</label>
            <input style={inp} type="email" placeholder="you@example.com"
              value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#888", display: "block", marginBottom: 6 }}>Password</label>
            <div style={{ position: "relative" }}>
              <input style={{ ...inp, paddingRight: 40 }}
                type={showPw ? "text" : "password"}
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required minLength={8} />
              <button type="button" className="eye-btn"
                onClick={() => setShowPw(s => !s)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#444", display: "flex", alignItems: "center", padding: 2, transition: "color 0.15s" }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* WhatsApp number */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#888", display: "block", marginBottom: 6 }}>
              WhatsApp number
              <span style={{ color: "#444", fontWeight: 400, marginLeft: 6, fontSize: 12 }}>for notifications & password reset</span>
            </label>
            <div style={{ display: "flex", background: "#141414", border: "1px solid #242424", borderRadius: 8, overflow: "hidden", transition: "border-color 0.15s" }}>
              <span style={{ padding: "0 12px", display: "flex", alignItems: "center", borderRight: "1px solid #242424", color: "#444", fontSize: 12, fontFamily: "monospace", background: "#1a1a1a", flexShrink: 0 }}>+237</span>
              <input type="tel" placeholder="6XXXXXXXX" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g,"").slice(0,9) }))}
                onFocus={e => (e.currentTarget.parentElement!.style.borderColor = "#22c55e")}
                onBlur={e => (e.currentTarget.parentElement!.style.borderColor = "#242424")}
                style={{ flex: 1, height: 40, padding: "0 12px", background: "transparent", border: "none", outline: "none", color: "#f0f0f0", fontSize: 14, fontFamily: "monospace" }} />
            </div>
          </div>

          <button type="submit" disabled={loading}
            style={{ padding: "10px", background: "#22c55e", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1, marginTop: 4 }}>
            {loading ? "Creating account..." : `Create ${form.role} account`}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "#555", marginTop: 20 }}>
          Already have an account? <Link href="/auth/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
