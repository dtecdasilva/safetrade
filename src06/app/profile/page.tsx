"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react";
import Navbar from "@/components/Navbar";
import { PageLoader, PhoneField } from "@/components/ui";
import { fmtDate, roleLabel } from "@/lib/zola";

interface Profile {
  id: string; name: string; email: string; phone: string; role: string;
  created_at: string; signed_up_with_google: boolean; has_password: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm]       = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [saved, setSaved]     = useState(false);

  const [pw, setPw]               = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw]       = useState(false);
  const [pwSaving, setPwSaving]   = useState(false);
  const [pwError, setPwError]     = useState("");
  const [pwSaved, setPwSaved]     = useState(false);

  useEffect(() => {
    fetch("/api/profile").then(async (res) => {
      if (!res.ok) { router.push("/auth/login"); return; }
      const { profile } = await res.json();
      setProfile(profile);
      setForm({ name: profile.name, email: profile.email, phone: profile.phone });
    }).catch(() => router.push("/auth/login"));
  }, [router]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaved(false); setSaving(true);
    try {
      const res  = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setProfile(data.profile);
      setForm({ name: data.profile.name, email: data.profile.email, phone: data.profile.phone });
      setSaved(true);
      router.refresh();
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setSaving(false); }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(""); setPwSaved(false);
    if (pw.next !== pw.confirm) { setPwError("The new passwords do not match"); return; }
    if (pw.next.length < 8)     { setPwError("Password must be at least 8 characters"); return; }
    setPwSaving(true);
    try {
      const res  = await fetch("/api/profile/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }) });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error); return; }
      setPw({ current: "", next: "", confirm: "" });
      setPwSaved(true);
      setProfile((p) => (p ? { ...p, has_password: true } : p));
    } catch { setPwError("Something went wrong. Check your connection and try again."); }
    finally { setPwSaving(false); }
  }

  if (!profile) return <PageLoader />;

  const isAdmin = profile.role === "admin";
  const changed = form.name.trim() !== profile.name || form.email.trim().toLowerCase() !== profile.email || form.phone !== profile.phone;
  const phoneOk = isAdmin ? (form.phone.length === 0 || form.phone.length >= 8) : form.phone.length >= 8;
  const canSave = changed && !saving && form.name.trim().length >= 2 && !!form.email.trim() && phoneOk;
  const mismatch = !!pw.confirm && pw.next !== pw.confirm;
  const canSavePw = !pwSaving && pw.next.length >= 8 && pw.next === pw.confirm && (!profile.has_password || !!pw.current);

  return (
    <div className="page">
      <Navbar user={{ name: profile.name, role: profile.role }} />

      <main className="container main narrow">
        <Link href={isAdmin ? "/admin" : "/dashboard"} className="back-link">
          <ArrowLeft size={15} /> Back
        </Link>

        <div style={{ marginBottom: 24 }}>
          <h1 className="page-title">Profile</h1>
          <p className="page-sub" suppressHydrationWarning>
            {roleLabel(profile.role)} account{profile.created_at ? `, member since ${fmtDate(profile.created_at)}` : ""}
          </p>
        </div>

        <div className="stack">
          {/* Details */}
          <form onSubmit={saveProfile} className="card card-pad stack" aria-labelledby="details-title">
            <h2 id="details-title" className="section-title">Your details</h2>

            {error && <div className="notice notice-danger" role="alert">{error}</div>}
            {saved && !error && (
              <div className="notice notice-ok" role="status"><CheckCircle size={16} /> Your profile has been updated.</div>
            )}

            <div className="field">
              <label className="label" htmlFor="p-name">Full name</label>
              <input id="p-name" className="input" type="text" autoComplete="name" value={form.name}
                onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setSaved(false); }} required />
              <p className="hint">This is the name the other side sees on your transactions.</p>
            </div>

            <div className="field">
              <label className="label" htmlFor="p-email">Email</label>
              <input id="p-email" className="input" type="email" autoComplete="email" value={form.email} disabled={isAdmin}
                onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setSaved(false); }} required />
              <p className="hint">
                {isAdmin
                  ? "The admin sign-in address is fixed."
                  : profile.signed_up_with_google
                    ? "You sign in with this email. Google sign-in keeps working if you change it."
                    : "You sign in with this email. Transaction emails and password reset links are sent to it."}
              </p>
            </div>

            <div className="field">
              <label className="label" htmlFor="p-phone">WhatsApp number</label>
              <PhoneField id="p-phone" value={form.phone} required={!isAdmin}
                onChange={(v) => { setForm((f) => ({ ...f, phone: v })); setSaved(false); }} />
              <p className="hint">
                {profile.role === "buyer"
                  ? "Sellers use this number to send you transactions, so it can only belong to one account."
                  : "Used for transaction updates. A number can only belong to one account."}
              </p>
            </div>

            <div className="btn-row">
              <button type="submit" disabled={!canSave} className="btn btn-primary">
                {saving ? "Saving..." : "Save changes"}
              </button>
              {changed && !saving && (
                <button type="button" className="btn btn-secondary"
                  onClick={() => { setForm({ name: profile.name, email: profile.email, phone: profile.phone }); setError(""); }}>
                  Discard
                </button>
              )}
            </div>
          </form>

          {/* Password */}
          <form onSubmit={savePassword} className="card card-pad stack" aria-labelledby="pw-title">
            <div>
              <h2 id="pw-title" className="section-title">{profile.has_password ? "Change password" : "Set a password"}</h2>
              {!profile.has_password && (
                <p className="hint" style={{ marginTop: 2 }}>
                  You signed up with Google, so you don&apos;t have a password yet. Set one if you also want to sign in with your email.
                </p>
              )}
            </div>

            {pwError && <div className="notice notice-danger" role="alert">{pwError}</div>}
            {pwSaved && !pwError && (
              <div className="notice notice-ok" role="status"><CheckCircle size={16} /> Your password has been updated.</div>
            )}

            {profile.has_password && (
              <div className="field">
                <label className="label" htmlFor="pw-current">Current password</label>
                <input id="pw-current" className="input" type={showPw ? "text" : "password"} autoComplete="current-password"
                  value={pw.current} onChange={(e) => { setPw((p) => ({ ...p, current: e.target.value })); setPwSaved(false); }} />
              </div>
            )}

            <div className="form-grid-2">
              <div className="field">
                <label className="label" htmlFor="pw-next">New password</label>
                <div className="input-wrap">
                  <input id="pw-next" className="input" type={showPw ? "text" : "password"} autoComplete="new-password"
                    placeholder="At least 8 characters" minLength={8}
                    value={pw.next} onChange={(e) => { setPw((p) => ({ ...p, next: e.target.value })); setPwSaved(false); }} />
                  <button type="button" className="input-affix" onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? "Hide passwords" : "Show passwords"}>
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <div className="field">
                <label className="label" htmlFor="pw-confirm">Confirm new password</label>
                <input id="pw-confirm" className={`input${mismatch ? " is-invalid" : ""}`} type={showPw ? "text" : "password"} autoComplete="new-password"
                  value={pw.confirm} onChange={(e) => { setPw((p) => ({ ...p, confirm: e.target.value })); setPwSaved(false); }} />
                {mismatch && <p className="hint-error">Passwords do not match</p>}
              </div>
            </div>

            <div>
              <button type="submit" disabled={!canSavePw} className="btn btn-primary">
                {pwSaving ? "Updating..." : profile.has_password ? "Update password" : "Set password"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
