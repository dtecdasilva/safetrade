"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import { PhoneField } from "@/components/ui";

const ROLES = [
  { val: "buyer",  label: "I'm buying",  note: "Pay through Zola. Your payment is held until you confirm delivery." },
  { val: "vendor", label: "I'm selling", note: "Create transactions and get paid once delivery is confirmed." },
];

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
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  const role = ROLES.find(r => r.val === form.role) || ROLES[0];

  return (
    <AuthShell>
      <h1 className="auth-title">Create your account</h1>
      <p className="auth-sub">Buy and sell online with confidence.</p>

      {/* Role toggle */}
      <div className="seg" role="group" aria-label="Account type">
        {ROLES.map(r => (
          <button key={r.val} type="button" className="seg-item" aria-pressed={form.role === r.val}
            onClick={() => setForm(f => ({ ...f, role: r.val }))}>
            {r.label}
          </button>
        ))}
      </div>
      <p className="hint" style={{ margin: "10px 2px 20px" }}>{role.note}</p>

      {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="field">
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" className="input" type="text" placeholder="Your full name" autoComplete="name"
            value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
        </div>

        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" placeholder="you@example.com" autoComplete="email"
            value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
        </div>

        <div className="field">
          <label className="label" htmlFor="password">Password</label>
          <div className="input-wrap">
            <input id="password" className="input"
              type={showPw ? "text" : "password"}
              placeholder="At least 8 characters" autoComplete="new-password"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required minLength={8} />
            <button type="button" className="input-affix" onClick={() => setShowPw(s => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}>
              {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        {/* WhatsApp number */}
        <div className="field">
          <label className="label" htmlFor="phone">WhatsApp number</label>
          <PhoneField id="phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
          <p className="hint">
            {form.role === "buyer"
              ? "Sellers use this number to send you transactions. We also use it for updates and password resets."
              : "We use this for transaction updates and password resets."}
          </p>
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ marginTop: 4 }}>
          {loading ? "Creating account..." : `Create ${form.role === "vendor" ? "seller" : "buyer"} account`}
        </button>
      </form>

      <p className="auth-foot">
        Already have an account? <Link href="/auth/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
