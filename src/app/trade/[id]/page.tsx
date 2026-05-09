"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { ShieldCheck, Truck, CheckCircle, AlertTriangle, Clock, RefreshCw } from "lucide-react";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: "Pending payment",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  funds_held:      { label: "Funds in escrow",  color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  shipped:         { label: "Shipped",           color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  delivered:       { label: "Delivered",         color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  pending_release: { label: "Pending release",   color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  complete:        { label: "Complete",          color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  disputed:        { label: "Disputed",          color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  cancelled:       { label: "Cancelled",         color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};

const EVENT_COLORS: Record<string, string> = {
  success: "#22c55e",
  info:    "#60a5fa",
  warn:    "#f59e0b",
  danger:  "#ef4444",
};

export default function TradePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [user, setUser]         = useState<any>(null);
  const [trade, setTrade]       = useState<any>(null);
  const [events, setEvents]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState(false);
  const [tracking, setTracking] = useState("");
  const [phone, setPhone]       = useState("");
  const [error, setError]       = useState("");
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
    setActing(true); setError("");
    try {
      const res = await fetch(`/api/trades/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Payment failed"); return; }
      // If we got a payment URL back, open it
      if (data.payment_url || data.url) {
        window.open(data.payment_url || data.url, "_blank");
      }
      await load();
    } catch { setError("Something went wrong"); }
    finally { setActing(false); }
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
      <div style={{ minHeight: "100vh", background: "#0a0f0d", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", fontSize: 14 }}>
        Loading trade...
      </div>
    );
  }

  const meta = STATUS_META[trade.status] || STATUS_META.cancelled;
  const isAdmin  = user?.role === "admin";
  const isBuyer  = user?.id === trade.buyer_id;
  const isVendor = user?.id === trade.vendor_id;

  const cardStyle: React.CSSProperties = {
    background: "#111812",
    border: "1px solid rgba(74,222,128,0.12)",
    borderRadius: 16,
    padding: "1.5rem",
    marginBottom: 16,
  };

  const inp: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "#0a0f0d",
    border: "1px solid rgba(74,222,128,0.15)",
    borderRadius: 10,
    color: "#f0fdf4",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  };

  const actionBtn = (color: string): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "10px 18px",
    borderRadius: 10,
    border: "none",
    background: color,
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    cursor: acting ? "not-allowed" : "pointer",
    opacity: acting ? 0.7 : 1,
    fontFamily: "inherit",
  });

  return (
    <div style={{ background: "#0a0f0d", minHeight: "100vh" }}>
      <Navbar user={{ name: user.name, role: user.role }} />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace", marginBottom: 4 }}>
            TRADE #{trade.id.slice(0, 8).toUpperCase()}
          </p>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0fdf4", margin: 0, letterSpacing: "-0.03em", flex: 1 }}>
              {trade.title}
            </h1>
            <span style={{ padding: "4px 12px", borderRadius: 20, background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", border: `1px solid ${meta.color}30` }}>
              {meta.label}
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#ef4444", marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Trade details */}
        <div style={cardStyle}>
          <p style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6, margin: "0 0 1rem" }}>{trade.description}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              ["Amount", `FCFA ${Number(trade.amount).toLocaleString()}`],
              ["SafeTrade fee (1.5%)", `FCFA ${Number(trade.fee).toLocaleString()}`],
              ["Buyer",  trade.buyer_name],
              ["Vendor", trade.vendor_name],
              ...(trade.delivery_deadline ? [["Delivery deadline", new Date(trade.delivery_deadline).toLocaleDateString()]] : []),
              ...(trade.tracking_number ? [["Tracking", trade.tracking_number]] : []),
            ].map(([label, value]) => (
              <div key={label}>
                <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 2px" }}>{label}</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#f0fdf4", margin: 0, fontFamily: label === "Amount" || label.includes("fee") ? "monospace" : "inherit" }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Buyer actions ── */}
        {isBuyer && (
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", marginBottom: 12 }}>Your actions</p>

            {trade.status === "pending_payment" && (
              <div>
                <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 10 }}>
                  Enter your mobile money number to pay and lock funds in escrow.
                </p>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#6b7280", fontSize: 13 }}>+237</span>
                    <input
                      style={{ ...inp, paddingLeft: 48 }}
                      type="tel"
                      placeholder="6XXXXXXXX"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </div>
                  <button onClick={doPay} disabled={acting} style={actionBtn("#22c55e")}>
                    <ShieldCheck size={14} /> {acting ? "Processing..." : "Pay now"}
                  </button>
                </div>
              </div>
            )}

            {["shipped", "funds_held"].includes(trade.status) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={() => doAction("confirm")} disabled={acting} style={actionBtn("#22c55e")}>
                  <CheckCircle size={14} /> {acting ? "..." : "Confirm delivery"}
                </button>
                <button onClick={() => doAction("dispute")} disabled={acting} style={{ ...actionBtn("rgba(239,68,68,0.15)"), color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <AlertTriangle size={14} /> {acting ? "..." : "Open dispute"}
                </button>
              </div>
            )}

            {trade.status === "pending_release" && (
              <p style={{ fontSize: 13, color: "#f59e0b", margin: 0 }}>
                ✓ You confirmed delivery. Waiting for admin to release funds to the vendor.
              </p>
            )}

            {trade.status === "complete" && (
              <p style={{ fontSize: 13, color: "#22c55e", margin: 0 }}>✓ Trade complete. Funds have been released.</p>
            )}
          </div>
        )}

        {/* ── Vendor actions ── */}
        {isVendor && (
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", marginBottom: 12 }}>Your actions</p>

            {trade.status === "pending_payment" && (
              <div>
                <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 10 }}>
                  Waiting for the buyer to pay. Resend the notification if needed.
                </p>
                <button onClick={resendNotification} disabled={acting} style={actionBtn("#60a5fa")}>
                  <RefreshCw size={14} /> Resend notification
                </button>
                {notifySent && <p style={{ fontSize: 12, color: "#22c55e", marginTop: 8 }}>✓ Notification resent</p>}
              </div>
            )}

            {trade.status === "funds_held" && (
              <div>
                <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 10 }}>
                  Funds are locked. Enter a tracking number and mark as shipped.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={{ ...inp, flex: 1 }}
                    placeholder="Tracking number (optional)"
                    value={tracking}
                    onChange={e => setTracking(e.target.value)}
                  />
                  <button onClick={() => doAction("ship", { trackingNumber: tracking })} disabled={acting} style={actionBtn("#a78bfa")}>
                    <Truck size={14} /> {acting ? "..." : "Mark shipped"}
                  </button>
                </div>
              </div>
            )}

            {trade.status === "shipped" && (
              <p style={{ fontSize: 13, color: "#a78bfa", margin: 0 }}>
                ✓ Marked as shipped. Waiting for the buyer to confirm delivery.
                {trade.tracking_number && ` Tracking: ${trade.tracking_number}`}
              </p>
            )}

            {trade.status === "pending_release" && (
              <p style={{ fontSize: 13, color: "#f59e0b", margin: 0 }}>
                ✓ Buyer confirmed delivery. Waiting for admin to release your funds.
              </p>
            )}

            {trade.status === "complete" && (
              <p style={{ fontSize: 13, color: "#22c55e", margin: 0 }}>✓ Trade complete. Funds released to you.</p>
            )}
          </div>
        )}

        {/* ── Admin actions ── */}
        {isAdmin && trade.status === "pending_release" && (
          <div style={{ ...cardStyle, border: "1px solid rgba(245,158,11,0.3)" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 8 }}>Admin — release funds</p>
            <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>
              Buyer has confirmed delivery. Release FCFA {Number(trade.amount).toLocaleString()} to {trade.vendor_name}.
            </p>
            <button
              onClick={async () => {
                setActing(true);
                await fetch(`/api/admin/release/${id}`, { method: "POST" });
                await load();
                setActing(false);
              }}
              disabled={acting}
              style={actionBtn("#22c55e")}
            >
              <ShieldCheck size={14} /> {acting ? "Releasing..." : "Release funds"}
            </button>
          </div>
        )}

        {/* Event timeline */}
        <div style={cardStyle}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", marginBottom: 16 }}>Timeline</p>
          {events.length === 0 && (
            <p style={{ fontSize: 13, color: "#6b7280" }}>No events yet.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {events.map((ev, i) => {
              const color = EVENT_COLORS[ev.type] || "#60a5fa";
              return (
                <div key={ev.id} style={{ display: "flex", gap: 12, position: "relative" }}>
                  {/* Line */}
                  {i < events.length - 1 && (
                    <div style={{ position: "absolute", left: 7, top: 20, width: 2, height: "calc(100% - 4px)", background: "rgba(74,222,128,0.08)" }} />
                  )}
                  {/* Dot */}
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: `${color}20`, border: `2px solid ${color}`, flexShrink: 0, marginTop: 2 }} />
                  <div style={{ paddingBottom: 20, flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#f0fdf4", margin: "0 0 2px" }}>{ev.label}</p>
                    <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 2px" }}>{ev.detail}</p>
                    <p style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace", margin: 0 }}>
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
