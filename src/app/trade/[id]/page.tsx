"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { ShieldCheck, Truck, CheckCircle, AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

const STATUS_META: Record<string, { label: string; color: string; bg: string; step: number }> = {
  pending_payment: { label: "Pending payment",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  step: 1 },
  funds_held:      { label: "Funds in escrow",  color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  step: 2 },
  shipped:         { label: "Shipped",           color: "#a78bfa", bg: "rgba(167,139,250,0.1)", step: 3 },
  delivered:       { label: "Delivered",         color: "#34d399", bg: "rgba(52,211,153,0.1)",  step: 4 },
  pending_release: { label: "Pending release",   color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  step: 4 },
  complete:        { label: "Complete",          color: "#22c55e", bg: "rgba(34,197,94,0.1)",   step: 5 },
  disputed:        { label: "Disputed",          color: "#ef4444", bg: "rgba(239,68,68,0.1)",   step: 0 },
  cancelled:       { label: "Cancelled",         color: "#6b7280", bg: "rgba(107,114,128,0.1)", step: 0 },
};

const EVENT_COLORS: Record<string, string> = {
  success: "#22c55e",
  info:    "#60a5fa",
  warn:    "#f59e0b",
  danger:  "#ef4444",
};

const STEPS = ["Payment", "Escrow", "Shipped", "Confirmed", "Complete"];

const NETWORKS = [
  { id: "mtn",    label: "MTN Mobile Money", emoji: "🟡", color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)" },
  { id: "orange", label: "Orange Money",     emoji: "🟠", color: "#f97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.3)" },
];

export default function TradePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [user, setUser]             = useState<any>(null);
  const [trade, setTrade]           = useState<any>(null);
  const [events, setEvents]         = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [acting, setActing]         = useState(false);
  const [phone, setPhone]           = useState("");
  const [network, setNetwork]       = useState<"mtn" | "orange" | "">("");
  const [error, setError]           = useState("");
  const [notifySent, setNotifySent] = useState(false);

  const load = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    const meData = await meRes.json();
    if (!meData.user) { router.push("/auth/login"); return; }
    setUser(meData.user);
    const res = await fetch(`/api/trades/${id}`);
    if (!res.ok) { router.push("/dashboard"); return; }
    const data = await res.json();
    setTrade(data.trade);
    setEvents(data.events || []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  async function doAction(action: string, extra: Record<string, any> = {}) {
    setActing(true); setError("");
    try {
      const res = await fetch(`/api/trades/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      await load();
    } catch { setError("Something went wrong"); }
    finally { setActing(false); }
  }

  async function doPay() {
    if (!phone.trim()) { setError("Enter your phone number"); return; }
    if (!network)      { setError("Select your network (MTN or Orange)"); return; }
    setActing(true); setError("");
    try {
      const res = await fetch(`/api/trades/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, network }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Payment failed"); setActing(false); return; }
      const payUrl = data.payment_url || data.url || data.paymentUrl;
      if (payUrl) {
        window.location.href = payUrl;
      } else {
        await load();
        setActing(false);
      }
    } catch { setError("Something went wrong"); setActing(false); }
  }

  async function resendNotification() {
    setNotifySent(false); setError("");
    const res = await fetch(`/api/trades/${id}/notify`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setNotifySent(true);
  }

  if (loading || !trade) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0f0d", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 36, height: 36, border: "2px solid rgba(74,222,128,0.2)", borderTop: "2px solid #22c55e", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: "#6b7280", fontSize: 13 }}>Loading trade...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const meta     = STATUS_META[trade.status] || STATUS_META.cancelled;
  const isAdmin  = user?.role === "admin";
  const isBuyer  = user?.id === trade.buyer_id;
  const isVendor = user?.id === trade.vendor_id;
  const currentStep = meta.step;
  const selectedNet = NETWORKS.find(n => n.id === network);
  const canPay = phone.length >= 8 && !!network;

  const card: React.CSSProperties = {
    background: "#111812",
    border: "1px solid rgba(74,222,128,0.1)",
    borderRadius: 16,
    padding: "1.25rem 1.5rem",
    marginBottom: 12,
  };

  const actionBtn = (color: string, outline = false): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 7,
    padding: "10px 18px", borderRadius: 10,
    border: outline ? `1px solid ${color}50` : "none",
    background: outline ? `${color}15` : color,
    color: outline ? color : "#fff",
    fontSize: 13, fontWeight: 700,
    cursor: acting ? "not-allowed" : "pointer",
    opacity: acting ? 0.7 : 1,
    fontFamily: "inherit",
    whiteSpace: "nowrap" as const,
  });

  return (
    <div style={{ background: "#0a0f0d", minHeight: "100vh" }}>
      <Navbar user={{ name: user.name, role: user.role }} />

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .trade-card { animation: fadeUp 0.3s ease forwards; }
        .phone-input:focus { border-color: rgba(74,222,128,0.5) !important; box-shadow: 0 0 0 3px rgba(34,197,94,0.08) !important; }
        .net-btn { transition: all 0.15s ease; cursor: pointer; }
        .net-btn:hover { transform: translateY(-1px); }
        .action-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
        .action-btn { transition: all 0.15s ease; }
        @media (max-width: 600px) {
          .party-grid { grid-template-columns: 1fr !important; }
          .step-label { display: none !important; }
          .net-grid   { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <main style={{ maxWidth: 680, margin: "0 auto", padding: "1.5rem 1rem 4rem" }}>

        <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#6b7280", fontSize: 12, textDecoration: "none", marginBottom: 16, fontWeight: 500 }}>
          <ArrowLeft size={13} /> Back to dashboard
        </Link>

        {/* Header */}
        <div className="trade-card" style={{ ...card, background: "linear-gradient(135deg, #111812 0%, #0f1a10 100%)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -60, top: -60, width: 200, height: 200, background: `radial-gradient(circle, ${meta.color}10, transparent 70%)`, borderRadius: "50%", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace", marginBottom: 4, letterSpacing: "0.05em" }}>
                TRADE #{trade.id.slice(0, 8).toUpperCase()}
              </p>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f0fdf4", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                {trade.title}
              </h1>
            </div>
            <span style={{ padding: "5px 12px", borderRadius: 20, background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", border: `1px solid ${meta.color}25`, flexShrink: 0 }}>
              {meta.label}
            </span>
          </div>

          {/* Progress steps */}
          {!["disputed", "cancelled"].includes(trade.status) && (
            <div style={{ display: "flex", alignItems: "center" }}>
              {STEPS.map((step, i) => {
                const stepNum = i + 1;
                const done    = currentStep > stepNum;
                const active  = currentStep === stepNum;
                return (
                  <div key={step} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: done ? "#22c55e" : active ? "rgba(34,197,94,0.15)" : "#162018", border: `2px solid ${active ? "#22c55e" : done ? "#22c55e" : "#2d3530"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: done ? "#fff" : active ? "#22c55e" : "#4b5563", flexShrink: 0 }}>
                        {done ? "✓" : stepNum}
                      </div>
                      <span className="step-label" style={{ fontSize: 9, color: active ? "#22c55e" : done ? "#4ade80" : "#4b5563", fontWeight: active ? 700 : 500, whiteSpace: "nowrap" }}>{step}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div style={{ flex: 1, height: 2, background: done ? "#22c55e" : "#1e2920", margin: "0 4px", marginBottom: 16 }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#ef4444", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Trade info */}
        <div className="trade-card" style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 2px" }}>Trade amount</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: "#4ade80", margin: 0, fontFamily: "monospace", letterSpacing: "-0.03em" }}>
                FCFA {Number(trade.amount).toLocaleString()}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 2px" }}>SafeTrade fee (1.5%)</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#f0fdf4", margin: 0, fontFamily: "monospace" }}>
                FCFA {Number(trade.fee).toLocaleString()}
              </p>
            </div>
          </div>

          {trade.description && (
            <p style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.65, margin: "0 0 16px", padding: "12px 14px", background: "rgba(74,222,128,0.03)", borderRadius: 10, border: "1px solid rgba(74,222,128,0.06)" }}>
              {trade.description}
            </p>
          )}

          <div className="party-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Buyer",  name: trade.buyer_name,  avatar: trade.buyer_avatar },
              { label: "Vendor", name: trade.vendor_name, avatar: trade.vendor_avatar },
            ].map(p => (
              <div key={p.label} style={{ background: "#0d160e", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(74,222,128,0.07)", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(74,222,128,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#4ade80", fontFamily: "monospace", flexShrink: 0 }}>
                  {p.avatar || p.name?.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 10, color: "#6b7280", margin: "0 0 1px", fontWeight: 600, letterSpacing: "0.05em" }}>{p.label.toUpperCase()}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#f0fdf4", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                </div>
              </div>
            ))}
          </div>

          {(trade.delivery_deadline || trade.tracking_number) && (
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {trade.delivery_deadline && (
                <span style={{ fontSize: 11, color: "#6b7280", background: "#0d160e", padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(74,222,128,0.07)" }}>
                  📅 Deadline: {new Date(trade.delivery_deadline).toLocaleDateString()}
                </span>
              )}
              {trade.tracking_number && (
                <span style={{ fontSize: 11, color: "#a78bfa", background: "rgba(167,139,250,0.06)", padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(167,139,250,0.15)" }}>
                  📦 {trade.tracking_number}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Buyer: pay ── */}
        {isBuyer && trade.status === "pending_payment" && (
          <div className="trade-card" style={{ ...card, border: "1px solid rgba(34,197,94,0.2)", background: "linear-gradient(135deg, #0f1a10, #111812)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShieldCheck size={14} color="#22c55e" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#f0fdf4", margin: 0 }}>Pay with Mobile Money</p>
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>Funds are locked in escrow until delivery</p>
              </div>
            </div>

            {/* Step 1: Choose network */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 8, letterSpacing: "0.05em" }}>
                STEP 1 — CHOOSE YOUR NETWORK
              </label>
              <div className="net-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {NETWORKS.map(n => {
                  const isSelected = network === n.id;
                  return (
                    <button
                      key={n.id}
                      className="net-btn"
                      onClick={() => setNetwork(n.id as "mtn" | "orange")}
                      style={{
                        padding: "14px 12px", borderRadius: 12,
                        border: `2px solid ${isSelected ? n.color : "rgba(74,222,128,0.1)"}`,
                        background: isSelected ? n.bg : "#0a0f0d",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                        fontFamily: "inherit",
                        boxShadow: isSelected ? `0 0 0 3px ${n.color}15` : "none",
                        position: "relative",
                      }}>
                      {isSelected && (
                        <div style={{ position: "absolute", top: 8, right: 8, width: 16, height: 16, borderRadius: "50%", background: n.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ color: "#fff", fontSize: 9, fontWeight: 900 }}>✓</span>
                        </div>
                      )}
                      <span style={{ fontSize: 28, lineHeight: 1 }}>{n.emoji}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? n.color : "#9ca3af" }}>{n.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Enter phone */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 8, letterSpacing: "0.05em" }}>
                STEP 2 — ENTER YOUR {network ? (network === "mtn" ? "MTN" : "ORANGE") : "MOBILE MONEY"} NUMBER
              </label>
              <div style={{
                display: "flex", alignItems: "center",
                background: "#0a0f0d",
                border: `1px solid ${selectedNet ? selectedNet.border : "rgba(74,222,128,0.15)"}`,
                borderRadius: 12, overflow: "hidden",
                transition: "border-color 0.2s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px", borderRight: `1px solid ${selectedNet ? selectedNet.border : "rgba(74,222,128,0.1)"}`, height: 52, flexShrink: 0, background: selectedNet ? selectedNet.bg : "rgba(74,222,128,0.03)" }}>
                  <span style={{ fontSize: 18 }}>🇨🇲</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: selectedNet ? selectedNet.color : "#4ade80", fontFamily: "monospace" }}>+237</span>
                </div>
                <input
                  className="phone-input"
                  type="tel"
                  placeholder={network === "orange" ? "69X XXX XXX" : "67X / 65X XXX XXX"}
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  style={{ flex: 1, height: 52, padding: "0 16px", background: "transparent", border: "none", outline: "none", color: "#f0fdf4", fontSize: 16, fontFamily: "monospace", letterSpacing: "0.05em" }}
                />
                {phone.length >= 9 && (
                  <div style={{ padding: "0 14px", color: "#22c55e" }}>
                    <CheckCircle size={18} />
                  </div>
                )}
              </div>
              {network && (
                <p style={{ fontSize: 11, color: "#6b7280", margin: "5px 0 0 2px" }}>
                  {network === "mtn" ? "MTN numbers start with 67, 68, 65" : "Orange numbers start with 69, 65"}
                </p>
              )}
            </div>

            {/* Summary */}
            {canPay && (
              <div style={{ background: selectedNet ? selectedNet.bg : "rgba(34,197,94,0.04)", border: `1px solid ${selectedNet ? selectedNet.border : "rgba(34,197,94,0.1)"}`, borderRadius: 10, padding: "11px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{selectedNet?.emoji}</span>
                  <div>
                    <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>Paying via</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: selectedNet?.color, margin: 0 }}>{selectedNet?.label} · +237{phone}</p>
                  </div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#4ade80", fontFamily: "monospace" }}>
                  FCFA {Number(trade.amount).toLocaleString()}
                </span>
              </div>
            )}

            <button
              onClick={doPay}
              disabled={acting || !canPay}
              style={{
                width: "100%", padding: "14px", borderRadius: 12, border: "none",
                background: canPay
                  ? selectedNet
                    ? `linear-gradient(135deg, ${selectedNet.color}, ${selectedNet.id === "mtn" ? "#d97706" : "#ea580c"})`
                    : "linear-gradient(135deg, #22c55e, #16a34a)"
                  : "#1a2e1e",
                color: canPay ? "#fff" : "#4b5563",
                fontSize: 14, fontWeight: 700,
                cursor: canPay && !acting ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "inherit",
                boxShadow: canPay ? `0 4px 20px ${selectedNet ? selectedNet.color : "#22c55e"}30` : "none",
                transition: "all 0.2s",
              }}>
              {acting ? (
                <>
                  <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  Redirecting to payment...
                </>
              ) : !network ? (
                "Select a network to continue"
              ) : (
                <>
                  <ShieldCheck size={16} />
                  Pay FCFA {Number(trade.amount).toLocaleString()} via {selectedNet?.label}
                </>
              )}
            </button>
          </div>
        )}

        {/* Buyer: confirm/dispute */}
        {isBuyer && ["shipped", "funds_held"].includes(trade.status) && (
          <div className="trade-card" style={card}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", marginBottom: 12 }}>Confirm or dispute</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="action-btn" onClick={() => doAction("confirm")} disabled={acting} style={actionBtn("#22c55e")}>
                <CheckCircle size={14} /> {acting ? "..." : "Confirm delivery"}
              </button>
              <button className="action-btn" onClick={() => doAction("dispute")} disabled={acting} style={actionBtn("#ef4444", true)}>
                <AlertTriangle size={14} /> {acting ? "..." : "Open dispute"}
              </button>
            </div>
          </div>
        )}

        {isBuyer && trade.status === "pending_release" && (
          <div style={{ ...card, border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.03)" }}>
            <p style={{ fontSize: 13, color: "#f59e0b", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={14} /> Delivery confirmed — waiting for admin to release funds
            </p>
          </div>
        )}

        {isBuyer && trade.status === "complete" && (
          <div style={{ ...card, border: "1px solid rgba(34,197,94,0.2)", background: "rgba(34,197,94,0.03)" }}>
            <p style={{ fontSize: 13, color: "#22c55e", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={14} /> Trade complete — funds have been released
            </p>
          </div>
        )}

        {isBuyer && trade.status === "disputed" && (
          <div style={{ ...card, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.03)" }}>
            <p style={{ fontSize: 13, color: "#ef4444", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={14} /> Dispute open — SafeTrade is reviewing this trade
            </p>
          </div>
        )}

        {/* ── Vendor actions ── */}
        {isVendor && trade.status === "pending_payment" && (
          <div className="trade-card" style={card}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", marginBottom: 8 }}>Waiting for payment</p>
            <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>The buyer hasn't paid yet. Resend the notification if needed.</p>
            <button className="action-btn" onClick={resendNotification} disabled={acting}
              style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.08)", color: "#60a5fa", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
              <RefreshCw size={14} /> Resend notification
            </button>
            {notifySent && <p style={{ fontSize: 12, color: "#22c55e", marginTop: 8, marginBottom: 0 }}>✓ Notification resent</p>}
          </div>
        )}

        {isVendor && trade.status === "funds_held" && (
          <div className="trade-card" style={{ ...card, border: "1px solid rgba(167,139,250,0.2)" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", marginBottom: 8 }}>Ready to ship</p>
            <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 14 }}>Funds are locked in escrow. Once you've shipped the item, click below.</p>
            <button className="action-btn"
              onClick={() => doAction("ship", { trackingNumber: "" })} disabled={acting}
              style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#a78bfa,#7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: acting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", opacity: acting ? 0.7 : 1 }}>
              <Truck size={14} /> {acting ? "Marking..." : "Mark as shipped"}
            </button>
          </div>
        )}

        {isVendor && trade.status === "shipped" && (
          <div style={{ ...card, border: "1px solid rgba(167,139,250,0.2)", background: "rgba(167,139,250,0.03)" }}>
            <p style={{ fontSize: 13, color: "#a78bfa", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Truck size={14} /> Marked as shipped — waiting for buyer to confirm delivery
            </p>
          </div>
        )}

        {isVendor && trade.status === "pending_release" && (
          <div style={{ ...card, border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.03)" }}>
            <p style={{ fontSize: 13, color: "#f59e0b", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={14} /> Buyer confirmed — waiting for admin to release your funds
            </p>
          </div>
        )}

        {isVendor && trade.status === "complete" && (
          <div style={{ ...card, border: "1px solid rgba(34,197,94,0.2)", background: "rgba(34,197,94,0.03)" }}>
            <p style={{ fontSize: 13, color: "#22c55e", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={14} /> Trade complete — funds released to you
            </p>
          </div>
        )}

        {/* ── Admin release ── */}
        {isAdmin && trade.status === "pending_release" && (
          <div className="trade-card" style={{ ...card, border: "1px solid rgba(245,158,11,0.3)", background: "linear-gradient(135deg,rgba(245,158,11,0.05),#111812)" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>⚡ Action required</p>
            <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 14 }}>
              Buyer confirmed delivery. Release FCFA {Number(trade.amount).toLocaleString()} to {trade.vendor_name}.
            </p>
            <button className="action-btn"
              onClick={async () => { setActing(true); await fetch(`/api/admin/release/${id}`, { method: "POST" }); await load(); setActing(false); }}
              disabled={acting}
              style={{ padding: "12px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
              <ShieldCheck size={14} /> {acting ? "Releasing..." : "Release funds"}
            </button>
          </div>
        )}

        {/* Timeline */}
        <div className="trade-card" style={card}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", marginBottom: 16, letterSpacing: "0.05em" }}>TIMELINE</p>
          {events.length === 0 && <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>No events yet.</p>}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {events.map((ev, i) => {
              const color = EVENT_COLORS[ev.type] || "#60a5fa";
              return (
                <div key={ev.id} style={{ display: "flex", gap: 12, position: "relative" }}>
                  {i < events.length - 1 && (
                    <div style={{ position: "absolute", left: 7, top: 22, width: 2, height: "calc(100% - 8px)", background: "rgba(74,222,128,0.07)" }} />
                  )}
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: `${color}15`, border: `2px solid ${color}`, flexShrink: 0, marginTop: 3 }} />
                  <div style={{ paddingBottom: 20, flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#f0fdf4", margin: "0 0 2px" }}>{ev.label}</p>
                    <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 3px" }}>{ev.detail}</p>
                    <p style={{ fontSize: 10, color: "#4b5563", fontFamily: "monospace", margin: 0 }}>
                      {new Date(ev.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </main>
    </div>
  );
}