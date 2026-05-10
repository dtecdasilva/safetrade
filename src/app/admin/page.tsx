"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Users, TrendingUp, AlertTriangle, ShieldCheck, Clock, Trash2, Edit3, Search, X, CheckCircle, Banknote, Phone } from "lucide-react";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: "Pending payment",   color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  funds_held:      { label: "Funds held",        color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  shipped:         { label: "Shipped",            color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  pending_release: { label: "Pending release ⚡", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  complete:        { label: "Complete",           color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  disputed:        { label: "Disputed",           color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  cancelled:       { label: "Cancelled",          color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};

const W_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "Pending",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  sent:     { label: "Sent ✓",  color: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
  rejected: { label: "Rejected", color: "#ef4444", bg: "rgba(239,68,68,0.1)"  },
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser]                     = useState<any>(null);
  const [tab, setTab]                       = useState<"trades" | "users" | "withdrawals">("trades");
  const [trades, setTrades]                 = useState<any[]>([]);
  const [users, setUsers]                   = useState<any[]>([]);
  const [withdrawals, setWithdrawals]       = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [editUser, setEditUser]             = useState<any>(null);
  const [releaseLoading, setReleaseLoading] = useState<string | null>(null);
  const [sendingW, setSendingW]             = useState<string | null>(null);
  const [tradeSearch, setTradeSearch]       = useState("");
  const [userSearch, setUserSearch]         = useState("");

  const load = useCallback(async () => {
    const meRes  = await fetch("/api/auth/me");
    const meData = await meRes.json();
    if (!meData.user || meData.user.role !== "admin") { router.push("/auth/login"); return; }
    setUser(meData.user);

    const [tradeRes, userRes, wRes] = await Promise.all([
      fetch("/api/trades"),
      fetch("/api/admin/users"),
      fetch("/api/withdrawals"),
    ]);
    const tradeData = await tradeRes.json();
    const userData  = await userRes.json();
    const wData     = await wRes.json();

    setTrades(tradeData.trades || []);
    setUsers(userData.users || []);
    setWithdrawals(wData.withdrawals || []);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function releaseFunds(id: string) {
    setReleaseLoading(id);
    await fetch(`/api/admin/release/${id}`, { method: "POST" });
    await load();
    setReleaseLoading(null);
  }

  async function markWithdrawalSent(id: string) {
    setSendingW(id);
    await fetch(`/api/withdrawals/${id}/sent`, { method: "POST" });
    await load();
    setSendingW(null);
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user?")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    await load();
  }

  async function saveUser() {
    if (!editUser) return;
    await fetch(`/api/admin/users/${editUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editUser.name, email: editUser.email, role: editUser.role }),
    });
    setEditUser(null);
    await load();
  }

  const tq = tradeSearch.toLowerCase().trim();
  const filteredTrades = tq
    ? trades.filter(t =>
        t.id?.toLowerCase().includes(tq) ||
        t.title?.toLowerCase().includes(tq) ||
        t.buyer_name?.toLowerCase().includes(tq) ||
        t.vendor_name?.toLowerCase().includes(tq) ||
        t.status?.toLowerCase().includes(tq) ||
        String(t.amount).includes(tq)
      )
    : trades;

  const uq = userSearch.toLowerCase().trim();
  const filteredUsers = uq
    ? users.filter(u =>
        u.name?.toLowerCase().includes(uq) ||
        u.email?.toLowerCase().includes(uq) ||
        u.role?.toLowerCase().includes(uq)
      )
    : users;

  const pendingRelease    = trades.filter(t => t.status === "pending_release");
  const disputed          = trades.filter(t => t.status === "disputed");
  const totalEscrow       = trades.filter(t => !["complete","cancelled"].includes(t.status)).reduce((s:number,t:any) => s+t.amount, 0);
  const pendingWithdrawals = withdrawals.filter(w => w.status === "pending");

  if (loading || !user) return (
    <div style={{ minHeight: "100vh", background: "#0a0f0d", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: "2px solid rgba(74,222,128,0.2)", borderTop: "2px solid #22c55e", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "#6b7280", fontSize: 13 }}>Loading admin panel...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const card: React.CSSProperties = { background: "#111812", border: "1px solid rgba(74,222,128,0.1)", borderRadius: 14, padding: "1.1rem 1.25rem" };
  const searchStyle: React.CSSProperties = {
    width: "100%", padding: "10px 36px",
    background: "#111812", border: "1px solid rgba(74,222,128,0.12)",
    borderRadius: 10, color: "#f0fdf4", fontSize: 13,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const,
    transition: "border-color 0.2s",
  };

  const TABS: { key: "trades" | "users" | "withdrawals"; label: string }[] = [
    { key: "trades",      label: `Transactions (${trades.length})` },
    { key: "users",       label: `Users (${users.length})` },
    { key: "withdrawals", label: `Withdrawals${pendingWithdrawals.length > 0 ? ` (${pendingWithdrawals.length} pending)` : ""}` },
  ];

  return (
    <div style={{ background: "#0a0f0d", minHeight: "100vh" }}>
      <Navbar user={{ name: user.name, role: user.role }} />

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0;transform:translateY(6px); } to { opacity:1;transform:translateY(0); } }
        .a-card { animation: fadeUp 0.25s ease forwards; }
        .tr:hover td { background: #0f1a11 !important; }
        .search-inp:focus { border-color: rgba(74,222,128,0.4) !important; box-shadow: 0 0 0 3px rgba(34,197,94,0.06) !important; }
        @media (max-width:700px) {
          .stats-g { grid-template-columns: 1fr 1fr !important; }
          .hide-sm { display: none !important; }
          .tabs-row { flex-wrap: wrap !important; }
        }
      `}</style>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem 4rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.25rem" }}>
          <p style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, letterSpacing: ".12em", marginBottom: 4 }}>ADMIN PANEL</p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f0fdf4", margin: 0, letterSpacing: "-0.03em" }}>SafeTrade Control Center</h1>
        </div>

        {/* Alerts */}
        {pendingRelease.length > 0 && (
          <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={15} color="#f59e0b" />
            <p style={{ fontSize: 13, color: "#f59e0b", margin: 0, fontWeight: 600 }}>
              {pendingRelease.length} trade{pendingRelease.length > 1 ? "s" : ""} confirmed by buyer — release funds required
            </p>
          </div>
        )}
        {pendingWithdrawals.length > 0 && (
          <div style={{ background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <Banknote size={15} color="#60a5fa" />
            <p style={{ fontSize: 13, color: "#60a5fa", margin: 0, fontWeight: 600 }}>
              {pendingWithdrawals.length} withdrawal request{pendingWithdrawals.length > 1 ? "s" : ""} pending — send via MoMo and mark as sent
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="stats-g" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
          {[
            { icon: <TrendingUp size={14}/>,    label: "In escrow",          value: `FCFA ${totalEscrow.toLocaleString()}`, color: "#22c55e" },
            { icon: <Clock size={14}/>,          label: "Pending release",    value: String(pendingRelease.length),          color: "#f59e0b" },
            { icon: <AlertTriangle size={14}/>,  label: "Disputed",           value: String(disputed.length),                color: "#ef4444" },
            { icon: <Users size={14}/>,          label: "Total users",        value: String(users.length),                   color: "#60a5fa" },
          ].map((s, i) => (
            <div key={i} className="a-card" style={{ ...card, animationDelay: `${i*0.05}s` }}>
              <div style={{ color: s.color, marginBottom: 6 }}>{s.icon}</div>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#f0fdf4", margin: "0 0 2px", fontFamily: "monospace" }}>{s.value}</p>
              <p style={{ fontSize: 10, color: "#6b7280", margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tabs-row" style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
              fontSize: 12, fontWeight: 700, border: "1px solid",
              background: tab === t.key ? "#22c55e" : "#111812",
              color: tab === t.key ? "#fff" : t.key === "withdrawals" && pendingWithdrawals.length > 0 ? "#60a5fa" : "#6b7280",
              borderColor: tab === t.key ? "#22c55e" : t.key === "withdrawals" && pendingWithdrawals.length > 0 ? "rgba(96,165,250,0.3)" : "rgba(74,222,128,0.12)",
              transition: "all 0.15s",
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TRADES ── */}
        {tab === "trades" && (
          <div className="a-card" style={card}>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#6b7280", pointerEvents: "none" }} />
              <input className="search-inp" style={searchStyle} value={tradeSearch} onChange={e => setTradeSearch(e.target.value)} placeholder="Search by ID, title, buyer, vendor, status, amount..." />
              {tradeSearch && <button onClick={() => setTradeSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}><X size={13} /></button>}
            </div>
            {tq && <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>{filteredTrades.length} result{filteredTrades.length!==1?"s":""} for "{tradeSearch}"</p>}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(74,222,128,0.08)" }}>
                    {["ID","Item","Buyer","Vendor","Amount","Status","Action"].map(h => (
                      <th key={h} style={{ textAlign:"left", padding:"8px 10px", fontSize:10, color:"#6b7280", fontWeight:700, letterSpacing:".06em", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map(t => {
                    const meta = STATUS_META[t.status] || STATUS_META.cancelled;
                    return (
                      <tr key={t.id} className="tr" style={{ borderBottom: "1px solid rgba(74,222,128,0.05)" }}>
                        <td style={{ padding:"10px" }}>
                          <Link href={`/trade/${t.id}`} style={{ color:"#4ade80", textDecoration:"none", fontFamily:"monospace", fontSize:11 }}>{t.id.slice(0,8).toUpperCase()}</Link>
                        </td>
                        <td style={{ padding:"10px", fontSize:12, color:"#f0fdf4", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.title}</td>
                        <td style={{ padding:"10px", fontSize:12, color:"#9ca3af" }} className="hide-sm">{t.buyer_name}</td>
                        <td style={{ padding:"10px", fontSize:12, color:"#9ca3af" }} className="hide-sm">{t.vendor_name}</td>
                        <td style={{ padding:"10px", fontSize:12, fontFamily:"monospace", color:"#4ade80", fontWeight:700, whiteSpace:"nowrap" }}>FCFA {Number(t.amount).toLocaleString()}</td>
                        <td style={{ padding:"10px" }}>
                          <span style={{ padding:"3px 8px", borderRadius:12, background:meta.bg, color:meta.color, fontSize:10, fontWeight:700, whiteSpace:"nowrap" }}>{meta.label}</span>
                        </td>
                        <td style={{ padding:"10px" }}>
                          {t.status === "pending_release" && (
                            <button onClick={() => releaseFunds(t.id)} disabled={releaseLoading===t.id} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:7, background:"#22c55e", color:"#fff", border:"none", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", opacity: releaseLoading===t.id ? 0.7 : 1 }}>
                              <ShieldCheck size={11}/> {releaseLoading===t.id ? "..." : "Release"}
                            </button>
                          )}
                          {t.status === "disputed" && <span style={{ fontSize:11, color:"#ef4444", fontWeight:700 }}>Review needed</span>}
                          {t.status === "complete" && <span style={{ fontSize:11, color:"#22c55e", display:"flex", alignItems:"center", gap:4 }}><CheckCircle size={11}/> Done</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredTrades.length === 0 && <p style={{ textAlign:"center", color:"#6b7280", padding:"2rem", fontSize:13 }}>{tq ? "No trades match your search" : "No trades yet"}</p>}
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {tab === "users" && (
          <div className="a-card" style={card}>
            {editUser && (
              <div style={{ background:"#0d160e", border:"1px solid rgba(74,222,128,0.15)", borderRadius:12, padding:16, marginBottom:14 }}>
                <p style={{ fontSize:12, fontWeight:700, color:"#4ade80", marginBottom:12 }}>Editing: {editUser.name}</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
                  {[["name","Name"],["email","Email"]].map(([k,l]) => (
                    <div key={k}>
                      <label style={{ fontSize:10, color:"#6b7280", display:"block", marginBottom:4, fontWeight:700, letterSpacing:"0.06em" }}>{l.toUpperCase()}</label>
                      <input value={(editUser as any)[k]} onChange={e => setEditUser((u:any) => ({...u,[k]:e.target.value}))}
                        style={{ width:"100%", padding:"8px 10px", background:"#0a0f0d", border:"1px solid rgba(74,222,128,0.15)", borderRadius:8, color:"#f0fdf4", fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" as const }} />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize:10, color:"#6b7280", display:"block", marginBottom:4, fontWeight:700, letterSpacing:"0.06em" }}>ROLE</label>
                    <select value={editUser.role} onChange={e => setEditUser((u:any) => ({...u,role:e.target.value}))}
                      style={{ width:"100%", padding:"8px 10px", background:"#0a0f0d", border:"1px solid rgba(74,222,128,0.15)", borderRadius:8, color:"#f0fdf4", fontSize:12, fontFamily:"inherit", outline:"none" }}>
                      <option value="buyer">Buyer</option>
                      <option value="vendor">Vendor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={saveUser} style={{ padding:"7px 16px", background:"#22c55e", color:"#fff", border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Save</button>
                  <button onClick={() => setEditUser(null)} style={{ padding:"7px 16px", background:"transparent", color:"#6b7280", border:"1px solid rgba(74,222,128,0.12)", borderRadius:8, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
                </div>
              </div>
            )}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#6b7280", pointerEvents: "none" }} />
              <input className="search-inp" style={searchStyle} value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search by name, email, or role..." />
              {userSearch && <button onClick={() => setUserSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}><X size={13} /></button>}
            </div>
            {uq && <p style={{ fontSize:11, color:"#6b7280", marginBottom:10 }}>{filteredUsers.length} result{filteredUsers.length!==1?"s":""} for "{userSearch}"</p>}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid rgba(74,222,128,0.08)" }}>
                    {["","Name","Email","Role","Trades","Joined","Actions"].map(h => (
                      <th key={h} style={{ textAlign:"left", padding:"8px 10px", fontSize:10, color:"#6b7280", fontWeight:700, letterSpacing:".06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => {
                    const roleColor = u.role==="vendor" ? "#a78bfa" : u.role==="admin" ? "#f59e0b" : "#4ade80";
                    return (
                      <tr key={u.id} className="tr" style={{ borderBottom:"1px solid rgba(74,222,128,0.05)" }}>
                        <td style={{ padding:"10px" }}>
                          <div style={{ width:30, height:30, borderRadius:"50%", background:`${roleColor}12`, border:`1px solid ${roleColor}35`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:roleColor, fontFamily:"monospace" }}>
                            {u.avatar || u.name?.slice(0,2).toUpperCase()}
                          </div>
                        </td>
                        <td style={{ padding:"10px", fontSize:13, fontWeight:600, color:"#f0fdf4" }}>{u.name}</td>
                        <td style={{ padding:"10px", fontSize:12, color:"#9ca3af" }} className="hide-sm">{u.email}</td>
                        <td style={{ padding:"10px" }}>
                          <span style={{ padding:"2px 8px", borderRadius:12, background:`${roleColor}12`, color:roleColor, fontSize:10, fontWeight:700, textTransform:"uppercase" as const }}>{u.role}</span>
                        </td>
                        <td style={{ padding:"10px", fontSize:12, fontFamily:"monospace", color:"#f0fdf4" }}>{u.trade_count ?? 0}</td>
                        <td style={{ padding:"10px", fontSize:11, color:"#6b7280" }} className="hide-sm">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                        <td style={{ padding:"10px" }}>
                          <div style={{ display:"flex", gap:6 }}>
                            <button onClick={() => setEditUser(u)} style={{ padding:"5px 9px", borderRadius:7, cursor:"pointer", background:"rgba(96,165,250,0.08)", color:"#60a5fa", border:"1px solid rgba(96,165,250,0.2)", fontSize:11, fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
                              <Edit3 size={10}/> Edit
                            </button>
                            {u.role !== "admin" && (
                              <button onClick={() => deleteUser(u.id)} style={{ padding:"5px 9px", borderRadius:7, cursor:"pointer", background:"rgba(239,68,68,0.06)", color:"#ef4444", border:"1px solid rgba(239,68,68,0.2)", fontSize:11, fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
                                <Trash2 size={10}/> Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredUsers.length === 0 && <p style={{ textAlign:"center", color:"#6b7280", padding:"2rem", fontSize:13 }}>{uq ? "No users match your search" : "No users yet"}</p>}
            </div>
          </div>
        )}

        {/* ── WITHDRAWALS ── */}
        {tab === "withdrawals" && (
          <div>
            {/* Pending */}
            {pendingWithdrawals.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", letterSpacing: ".08em", marginBottom: 10 }}>⚡ PENDING ({pendingWithdrawals.length})</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pendingWithdrawals.map(w => (
                    <div key={w.id} style={{ background: "#111812", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 14, padding: "1.25rem 1.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Banknote size={20} color="#f59e0b" />
                          </div>
                          <div>
                            <p style={{ fontSize: 20, fontWeight: 700, color: "#f0fdf4", margin: "0 0 2px", fontFamily: "monospace" }}>FCFA {Number(w.amount).toLocaleString()}</p>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#f0fdf4", margin: "0 0 2px" }}>{w.vendor_name}</p>
                            <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{w.vendor_email}</p>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginBottom: 4 }}>
                            <Phone size={12} color="#6b7280" />
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#f0fdf4", fontFamily: "monospace" }}>+237{w.phone}</span>
                          </div>
                          <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 4px" }}>{w.network}</p>
                          <p style={{ fontSize: 10, color: "#6b7280", margin: 0 }}>{new Date(w.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div style={{ paddingTop: 14, borderTop: "1px solid rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                        <div style={{ background: "rgba(245,158,11,0.06)", borderRadius: 8, padding: "8px 12px" }}>
                          <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 2px" }}>Send to</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", fontFamily: "monospace", margin: 0 }}>{w.network} · +237{w.phone}</p>
                        </div>
                        <button onClick={() => markWithdrawalSent(w.id)} disabled={sendingW === w.id}
                          style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 10, border: "none", background: sendingW === w.id ? "#1a2e1e" : "linear-gradient(135deg,#22c55e,#16a34a)", color: sendingW === w.id ? "#4b5563" : "#fff", fontSize: 13, fontWeight: 700, cursor: sendingW === w.id ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                          {sendingW === w.id
                            ? <><div style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Processing...</>
                            : <><CheckCircle size={13} /> Mark as sent</>
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingWithdrawals.length === 0 && (
              <div style={{ ...card, textAlign: "center", padding: "2.5rem", marginBottom: 16 }}>
                <CheckCircle size={24} color="#22c55e" style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 14, color: "#22c55e", fontWeight: 600, margin: "0 0 4px" }}>All caught up!</p>
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>No pending withdrawals</p>
              </div>
            )}

            {/* Processed */}
            {withdrawals.filter(w => w.status !== "pending").length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".08em", marginBottom: 10 }}>PROCESSED</p>
                <div className="a-card" style={card}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(74,222,128,0.08)" }}>
                          {["Vendor","Amount","Number","Network","Date","Status"].map(h => (
                            <th key={h} style={{ textAlign:"left", padding:"8px 10px", fontSize:10, color:"#6b7280", fontWeight:700, letterSpacing:".06em", whiteSpace:"nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {withdrawals.filter(w => w.status !== "pending").map(w => {
                          const ws = W_STATUS[w.status] || W_STATUS.sent;
                          return (
                            <tr key={w.id} className="tr" style={{ borderBottom: "1px solid rgba(74,222,128,0.04)" }}>
                              <td style={{ padding:"10px", fontSize:12, fontWeight:600, color:"#f0fdf4" }}>{w.vendor_name}</td>
                              <td style={{ padding:"10px", fontSize:12, fontFamily:"monospace", color:"#4ade80", fontWeight:700 }}>FCFA {Number(w.amount).toLocaleString()}</td>
                              <td style={{ padding:"10px", fontSize:12, fontFamily:"monospace", color:"#9ca3af" }}>+237{w.phone}</td>
                              <td style={{ padding:"10px", fontSize:12, color:"#9ca3af" }}>{w.network}</td>
                              <td style={{ padding:"10px", fontSize:11, color:"#6b7280" }}>{new Date(w.created_at).toLocaleDateString()}</td>
                              <td style={{ padding:"10px" }}>
                                <span style={{ padding:"3px 8px", borderRadius:12, background:ws.bg, color:ws.color, fontSize:10, fontWeight:700 }}>{ws.label}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}