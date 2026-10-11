"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShoppingBag, Store, Package, Wrench, Layers, CheckCircle } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import GoogleButton from "@/components/GoogleButton";
import { PhoneField } from "@/components/ui";
import { money } from "@/lib/zola";
import { DELIVERY_FEE, FEE_LARGE_LABEL, FEE_STANDARD_LABEL, FEE_THRESHOLD_LABEL } from "@/lib/fees";

/**
 * Creating an account, one question at a time.
 *
 * It doubles as the introduction to Zola: after saying whether they are
 * buying or selling, people are shown how a transaction will work for them
 * before they are asked for any details.
 *
 * Someone arriving from a seller's invitation (?invite=<transaction id>)
 * starts with what is waiting for them, with their number and email filled in.
 */

type Role  = "buyer" | "vendor";
type Sells = "goods" | "services" | "both";
type Step  = "invite" | "role" | "sells" | "how" | "name" | "phone" | "account" | "done";

interface Invite {
  title: string; sellerName: string; total: number; amount: number; fee: number; deliveryFee: number;
  phone: string; email: string;
}

const FEE_LINE = `the Zola fee (${FEE_STANDARD_LABEL}, or ${FEE_LARGE_LABEL} above ${FEE_THRESHOLD_LABEL})`;

function pointsFor(role: Role, sells: Sells | ""): { title: string; text: string }[] {
  if (role === "buyer") {
    return [
      { title: "A seller creates a transaction for you",
        text: "They use your phone number, so sign up with the number you gave them." },
      { title: "You pay Zola, not the seller",
        text: `You pay the item price, ${FEE_LINE} and ${money(DELIVERY_FEE)} delivery. You see the full total before you pay.` },
      { title: "Zola delivers your order",
        text: "The seller sends it to Zola and Zola brings it to you. Your money stays with Zola the whole time." },
      { title: "Confirm when it arrives",
        text: "You then have 24 hours to tell us if anything is wrong. After that, the seller is paid." },
    ];
  }
  const third =
    sells === "services"
      ? { title: "You do the work",
          text: "There is nothing to deliver, so switch delivery off and no delivery fee is added. Mark it as delivered when you're done." }
      : { title: "You send the item to Zola",
          text: `Not straight to the buyer. Zola delivers it, and the buyer pays the ${money(DELIVERY_FEE)} delivery, not you.` +
                (sells === "both" ? " For a service there is nothing to send: you just mark the work as delivered." : "") };
  return [
    { title: "You create a transaction",
      text: "Enter the item, your price and the buyer's phone number. If they aren't on Zola yet, we invite them for you." },
    { title: "The buyer pays Zola",
      text: `We tell you the moment the money is held. The buyer pays ${FEE_LINE} on top, so you receive your full price.` },
    third,
    { title: "You get paid",
      text: "The buyer confirms delivery. After a 24-hour review, the money is in your Zola wallet, ready to withdraw to mobile money." },
  ];
}

export default function RegisterWizard({ inviteId = "" }: { inviteId?: string }) {
  const [step, setStep]   = useState<Step>("role");
  const [role, setRole]   = useState<Role | "">("");
  const [sells, setSells] = useState<Sells | "">("");
  const [form, setForm]   = useState({ name: "", phone: "", email: "", password: "" });
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  // Invitation from a seller
  const [invite, setInvite]         = useState<Invite | null>(null);
  const [inviteNote, setInviteNote] = useState("");
  const [checking, setChecking]     = useState(!!inviteId);

  // After the account exists
  const [tradeId, setTradeId] = useState<string | null>(null);

  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!inviteId) return;
    fetch(`/api/invite/${encodeURIComponent(inviteId)}`)
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.claimed) { setInviteNote("This invitation has already been used. If that was you, sign in to see your transaction."); return; }
        if (!res.ok) { setInviteNote(d.error || "This invitation is no longer available. You can still create an account."); return; }
        setInvite(d);
        setRole("buyer");
        setForm((f) => ({ ...f, phone: d.phone || "", email: d.email || "" }));
        setStep("invite");
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [inviteId]);

  const steps: Step[] = useMemo(() => {
    if (invite) return ["invite", "how", "name", "phone", "account"];
    if (role === "vendor") return ["role", "sells", "how", "name", "phone", "account"];
    return ["role", "how", "name", "phone", "account"];
  }, [invite, role]);

  const index = Math.max(0, steps.indexOf(step));
  const go = (s: Step) => { setError(""); setStep(s); };
  const next = () => go(steps[Math.min(index + 1, steps.length - 1)]);
  const back = () => go(steps[Math.max(index - 1, 0)]);

  // Put the cursor in the question's field
  useEffect(() => { firstField.current?.focus(); }, [step]);

  const firstName = form.name.trim().split(" ")[0];

  async function createAccount() {
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name: form.name.trim(), role, sells, invite: inviteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Send them back to the question that needs fixing
        if (res.status === 409 && /phone number/i.test(data.error || "")) { setStep("phone"); setError(data.error); return; }
        setError(data.error || "Your account could not be created. Please try again.");
        return;
      }
      setTradeId(data.tradeId || null);
      setStep("done");
    } catch { setError("Something went wrong. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  function submitStep(e: React.FormEvent) {
    e.preventDefault();
    if (step === "name") {
      if (form.name.trim().length < 2) { setError("Enter your full name"); return; }
      next();
    } else if (step === "phone") {
      if (form.phone.length < 9) { setError("Enter all 9 digits of your number"); return; }
      next();
    } else if (step === "account") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError("Enter a valid email address"); return; }
      if (form.password.length < 8) { setError("Choose a password with at least 8 characters"); return; }
      createAccount();
    } else {
      next();
    }
  }

  if (checking) {
    return (
      <AuthShell>
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }} role="status" aria-label="Loading">
          <span className="spinner" />
        </div>
      </AuthShell>
    );
  }

  /* ── Finished ── */
  if (step === "done") {
    return (
      <AuthShell>
        <span className="auth-badge"><CheckCircle size={24} /></span>
        <h1 className="auth-title">You&apos;re in{firstName ? `, ${firstName}` : ""}.</h1>
        {tradeId ? (
          <>
            <p className="auth-sub">
              {invite ? `${invite.sellerName}'s transaction is waiting for you.` : "A seller already created a transaction for you."}{" "}
              Review it, then pay Zola when you&apos;re ready.
            </p>
            <a href={`/trade/${tradeId}`} className="btn btn-primary btn-lg btn-block">Review and pay <ArrowRight size={17} /></a>
          </>
        ) : role === "vendor" ? (
          <>
            <p className="auth-sub">Your seller account is ready. Create your first transaction and Zola will notify the buyer.</p>
            <a href="/trade/new" className="btn btn-primary btn-lg btn-block">Create my first transaction <ArrowRight size={17} /></a>
            <a href="/dashboard" className="btn btn-secondary btn-block" style={{ marginTop: 10 }}>Go to my dashboard</a>
          </>
        ) : (
          <>
            <p className="auth-sub">
              Your buyer account is ready. Give your seller this number and ask them to create the transaction on Zola:{" "}
              <strong className="num" style={{ color: "var(--navy)", whiteSpace: "nowrap" }}>+237 {form.phone}</strong>
            </p>
            <a href="/dashboard" className="btn btn-primary btn-lg btn-block">Go to my dashboard <ArrowRight size={17} /></a>
          </>
        )}
      </AuthShell>
    );
  }

  const points = role ? pointsFor(role, sells) : [];

  return (
    <AuthShell>
      {/* Where you are */}
      <div className="wiz-top">
        {index > 0
          ? <button type="button" className="wiz-back" onClick={back}><ArrowLeft size={15} /> Back</button>
          : <span />}
        <span className="wiz-count">Step {index + 1} of {steps.length}</span>
      </div>
      <div className="wiz-bar" aria-hidden="true">
        {steps.map((s, i) => <span key={s} className={i <= index ? "is-done" : ""} />)}
      </div>

      {inviteNote && step === "role" && (
        <div className="notice notice-info" style={{ marginBottom: 18 }}>
          <span>{inviteNote} <Link href="/auth/login">Sign in</Link></span>
        </div>
      )}

      <form onSubmit={submitStep} noValidate>

        {/* ── Invitation ── */}
        {step === "invite" && invite && (
          <>
            <h1 className="auth-title">{invite.sellerName} wants you to pay safely with Zola</h1>
            <p className="auth-sub">
              With Zola you pay us, not the seller. We hold your money until your order arrives.
            </p>
            <div className="wiz-summary">
              <p className="wiz-summary-title">{invite.title}</p>
              <div className="kv"><span>Item price</span><span>{money(invite.amount)}</span></div>
              <div className="kv"><span>Zola fee</span><span>{money(invite.fee)}</span></div>
              {invite.deliveryFee > 0 && <div className="kv"><span>Delivery</span><span>{money(invite.deliveryFee)}</span></div>}
              <div className="kv kv-total"><span>Total to pay</span><span>{money(invite.total)}</span></div>
            </div>
            <p className="hint" style={{ margin: "14px 2px 20px", fontSize: 14 }}>
              Create your account first. It takes about a minute, and this transaction will be waiting for you at the end.
            </p>
            <button type="submit" className="btn btn-primary btn-lg btn-block">Create my account <ArrowRight size={17} /></button>
          </>
        )}

        {/* ── Buying or selling ── */}
        {step === "role" && (
          <>
            <h1 className="auth-title">What brings you to Zola?</h1>
            <p className="auth-sub">Zola holds the payment in the middle, so neither side has to trust a stranger.</p>
            <div className="wiz-choices">
              <button type="button" className="wiz-choice" aria-pressed={role === "buyer"}
                onClick={() => { setRole("buyer"); setSells(""); go("how"); }}>
                <span className="wiz-choice-icon"><ShoppingBag size={18} /></span>
                <span>
                  <span className="wiz-choice-title">I&apos;m buying</span>
                  <span className="wiz-choice-text">Pay Zola, not the seller. Your money is held until your order arrives.</span>
                </span>
              </button>
              <button type="button" className="wiz-choice" aria-pressed={role === "vendor"}
                onClick={() => { setRole("vendor"); go("sells"); }}>
                <span className="wiz-choice-icon"><Store size={18} /></span>
                <span>
                  <span className="wiz-choice-title">I&apos;m selling</span>
                  <span className="wiz-choice-text">Know the buyer has paid before you send anything.</span>
                </span>
              </button>
            </div>
          </>
        )}

        {/* ── What a seller sells ── */}
        {step === "sells" && (
          <>
            <h1 className="auth-title">What do you sell?</h1>
            <p className="auth-sub">This decides how delivery works for you. You can still choose for each transaction.</p>
            <div className="wiz-choices">
              {([
                { val: "goods",    icon: <Package size={18} />, title: "Products",  text: "Phones, clothes, food: anything that has to be delivered." },
                { val: "services", icon: <Wrench size={18} />,  title: "Services",  text: "Design, repairs, lessons: nothing to deliver." },
                { val: "both",     icon: <Layers size={18} />,  title: "Both",      text: "Some things I sell are delivered, some are not." },
              ] as { val: Sells; icon: React.ReactNode; title: string; text: string }[]).map((c) => (
                <button key={c.val} type="button" className="wiz-choice" aria-pressed={sells === c.val}
                  onClick={() => { setSells(c.val); go("how"); }}>
                  <span className="wiz-choice-icon">{c.icon}</span>
                  <span>
                    <span className="wiz-choice-title">{c.title}</span>
                    <span className="wiz-choice-text">{c.text}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── How Zola works for this person ── */}
        {step === "how" && (
          <>
            <h1 className="auth-title">{role === "vendor" ? "How selling on Zola works" : "How buying on Zola works"}</h1>
            <p className="auth-sub">Four steps. Take a moment to read them before you continue.</p>
            <ol className="wiz-points">
              {points.map((p, i) => (
                <li key={p.title}>
                  <span className="wiz-num" aria-hidden="true">{i + 1}</span>
                  <div>
                    <p className="wiz-point-title">{p.title}</p>
                    <p className="wiz-point-text">{p.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <button type="submit" className="btn btn-primary btn-lg btn-block" style={{ marginTop: 24 }}>Got it, continue <ArrowRight size={17} /></button>
          </>
        )}

        {/* ── Name ── */}
        {step === "name" && (
          <>
            <h1 className="auth-title">What&apos;s your name?</h1>
            <p className="auth-sub">
              {role === "vendor" ? "Buyers see this on every transaction you create." : "Sellers see this when they create a transaction for you."}
            </p>
            {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
            <div className="field" style={{ marginBottom: 18 }}>
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" ref={firstField} className="input" type="text" placeholder="Your full name" autoComplete="name"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block">Continue <ArrowRight size={17} /></button>
          </>
        )}

        {/* ── Phone ── */}
        {step === "phone" && (
          <>
            <h1 className="auth-title">What&apos;s your WhatsApp number?</h1>
            <p className="auth-sub">
              {invite
                ? `This is the number ${invite.sellerName} used. Keep it and your transaction will be waiting for you.`
                : role === "vendor"
                  ? "We send your payment updates here. Each number can have one Zola account."
                  : "Sellers find you on Zola by this number, and we send your updates here. Each number can have one account."}
            </p>
            {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
            <div className="field" style={{ marginBottom: 18 }}>
              <label className="label" htmlFor="phone">WhatsApp number</label>
              <PhoneField id="phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block">Continue <ArrowRight size={17} /></button>
          </>
        )}

        {/* ── Email and password ── */}
        {step === "account" && (
          <>
            <h1 className="auth-title">Last step: how will you sign in?</h1>
            <p className="auth-sub">We also email you every time one of your transactions moves.</p>
            {error && <div className="notice notice-danger" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
            <div className="auth-form">
              <div className="field">
                <label className="label" htmlFor="email">Email</label>
                <input id="email" ref={firstField} className="input" type="email" placeholder="you@example.com" autoComplete="email"
                  value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label" htmlFor="password">Password</label>
                <div className="input-wrap">
                  <input id="password" className="input" type={showPw ? "text" : "password"}
                    placeholder="At least 8 characters" autoComplete="new-password"
                    value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                  <button type="button" className="input-affix" onClick={() => setShowPw(s => !s)}
                    aria-label={showPw ? "Hide password" : "Show password"}>
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block" style={{ marginTop: 4 }}>
                {loading ? "Creating your account..." : `Create my ${role === "vendor" ? "seller" : "buyer"} account`}
              </button>
            </div>
            <div className="or-rule">or</div>
            <GoogleButton role={role || "buyer"} label="Sign up with Google instead" />
          </>
        )}
      </form>

      <p className="auth-foot">
        Already have an account? <Link href="/auth/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
