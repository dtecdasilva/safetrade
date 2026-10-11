"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { PhoneField } from "@/components/ui";

const ROLES = [
  { val: "buyer",  label: "I'm buying",  note: "Pay through Zola. Your payment is held until you confirm delivery." },
  { val: "vendor", label: "I'm selling", note: "Create transactions and get paid once delivery is confirmed." },
];

/** Shown once, to people signing up with Google, before their account is created. */
export default function CompleteProfilePage() {
  const router = useRouter();
  const [email, setEmail]     = useState("");
  const [form, setForm]       = useState({ name: "", role: "buyer", phone: "" });
  const [ready, setReady]     = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/google/complete").then(async (res) => {
      if (!res.ok) { router.replace("/auth/login?error=google_state"); return; }
      const d = await res.json();
      setEmail(d.email);
      setForm((f) => ({ ...f, name: d.name || "", role: d.role === "vendor" ? "vendor" : "buyer" }));
      setReady(true);
    }).catch(() => router.replace("/auth/login?error=google_failed"));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/auth/google/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push("/dashboard");
      router.refresh();
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  const role = ROLES.find((r) => r.val === form.role) || ROLES[0];

  if (!ready) {
    return (
      <AuthShell>
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }} role="status" aria-label="Loading">
          <span className="spinner" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="auth-title">Finish setting up</h1>
      <p className="auth-sub">
        You&apos;re signing up as <strong style={{ color: "var(--navy)" }}>{email}</strong>. Two more details and you&apos;re in.
      </p>

      <div className="seg" role="group" aria-label="Account type">
        {ROLES.map((r) => (
          <button key={r.val} type="button" className="seg-item" aria-pressed={form.role === r.val}
            onClick={() => setForm((f) => ({ ...f, role: r.val }))}>
            {r.label}
          </button>
        ))}
      </div>
      <p className="hint" style={{ margin: "10px 2px 20px" }}>{role.note}</p>

      {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="field">
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" className="input" type="text" autoComplete="name"
            value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>

        <div className="field">
          <label className="label" htmlFor="phone">WhatsApp number</label>
          <PhoneField id="phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} required />
          <p className="hint">
            {form.role === "buyer"
              ? "Sellers use this number to send you transactions. We also use it for updates."
              : "We use this for transaction updates."}
          </p>
        </div>

        <button type="submit" disabled={loading || form.phone.length < 8 || !form.name.trim()} className="btn btn-primary btn-block" style={{ marginTop: 4 }}>
          {loading ? "Creating account..." : `Create ${form.role === "vendor" ? "seller" : "buyer"} account`}
        </button>
      </form>

      <p className="auth-foot">
        Not you? <Link href="/auth/login">Use a different account</Link>
      </p>
    </AuthShell>
  );
}
