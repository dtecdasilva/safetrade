"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Search, X, ShieldCheck, CheckCircle, AlertTriangle, Trash2, Edit3, Banknote, Phone } from "lucide-react";

const STATUS: Record<string, { label: string; color: string }> = {
  pending_payment: { label: "Awaiting payment", color: "#f59e0b" },
  funds_held:      { label: "Funds held",       color: "#3b82f6" },
  shipped:         { label: "Shipped",           color: "#8b5cf6" },
  pending_release: { label: "Pending release",   color: "#f59e0b" },
  complete:        { label: "Complete",          color: "#22c55e" },
  disputed:        { label: "Disputed",          color: "#ef4444" },
  cancelled:       { label: "Cancelled",         color: "#555"    },
};

const W_STATUS: Record<string, { label: string; color: string }> = {
  pending:  { label: "Pending",  color: "#f59e0b" },
  sent:     { label: "Sent",     color: "#22c55e" },
  rejected: { label: "Rejected", color: "#ef4444" },
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser]                     = useState<any>(null);
  const [tab, setTab]                       = useState<"trades"|"users"|"withdrawals">("trades");
  const [trades, setTrades]                 = useState<any[]>([]);
  const [users, setUsers]                   = useState<any[]>([]);
  const [withdrawals, setWithdrawals]       = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [editUser, setEditUser]             = useState<any>(null);
  const [releaseLoading, setReleaseLoading] = useState<string|null>(null);
  const [sendingW, setSendingW]             = useState<string|null>(null);
  const [tradeQ, setTradeQ]                 = useState("");
  const [userQ, setUserQ]                   = useState("");

  const load = useCallback(async () => {
    const me = await (await fetch("/api/auth/me")).json();
    if (!me.user || me.user.role !== "admin") { router.push("/auth/login"); return; }
    setUser(me.user);
    const [tr, ur, wr] = await Promise.all([fetch("/api/trades"), fetch("/api/admin/users"), fetch("/api/withdrawals")]);
    const [td, ud, wd] = await Promise.all([tr.json(), ur.json(), wr.json()]);
    setTrades(td.trades || []); setUsers(ud.users || []); setWithdrawals(wd.withdrawals || []);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function release(id: string) {
    setReleaseLoading(id);
    await fetch(`/api/admin/release/${id}`, { method: "POST" });
    await load(); setReleaseLoading(null);
  }

  async function markSent(id: string) {
    setSendingW(id);
    await fetch(`/api/withdrawals/${id}/sent`, { method: "POST" });
    await load(); setSendingW(null);
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user?")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    await load();
  }

  async function saveUser() {
    if (!editUser) return;
    await fetch(`/api/admin/users/${editUser.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editUser.name, email: editUser.email, role: editUser.role }) });
    setEditUser(null); await load();
  }

  const tq = tradeQ.toLowerCase().trim();
  const uq = userQ.toLowerCase().trim();
  const filteredTrades = tq ? trades.filter(t => t.id?.toLowerCase().includes(tq) || t.title?.toLowerCase().includes(tq) || t.buyer_name?.toLowerCase().includes(tq) || t.vendor_name?.toLowerCase().includes(tq) || t.status?.toLowerCase().includes(tq) || String(t.amount).includes(tq)) : trades;
  const filteredUsers  = uq ? users.filter(u => u.name?.toLowerCase().includes(uq) || u.email?.toLowerCase().includes(uq) || u.role?.toLowerCase().includes(uq)) : users;

  const pendingRelease  = trades.filter(t => t.status === "pending_release");
  const disputed        = trades.filter(t => t.status === "disputed");
  const pendingW        = withdrawals.filter(w => w.status === "pending");
  const totalEscrow     = trades.filter(t => !["complete","cancelled"].includes(t.status)).reduce((s:number,t:any) => s+t.amount, 0);

  const TABS = [
    { key: "trades" as const,      label: `Transactions (${trades.length})` },
    { key: "users" as const,       label: `Users (${users.length})` },
    { key: "withdrawals" as const, label: `Withdrawals${pendingW.length > 0 ? ` (${pendingW.length})` : ""}` },
  ];

  if (loading || !user) return (
    <div style={{ minHeight: "100vh", background: "#0c0c0c", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 24, height: 24, border: "2px solid #1e1e1e", borderTop: "2px solid #22c55e", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const inp: React.CSSProperties = { width: "100%", padding: "8px 12px 8px 34px", background: "#141414", border: "1px solid #1e1e1e", borderRadius: 7, color: "#f0f0f0", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };
  const cell: React.CSSProperties = { padding: "10px 12px", fontSize: 12, color: "#888", borderBottom: "1px solid #1a1a1a" };

  return (
    <div style={{ background: "#0c0c0c", minHeight: "100vh" }}>
      <Navbar user={{ name: user.name, role: user.role }} />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fade-up { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fade-up 0.2s ease forwards; }
        input:focus { border-color: #22c55e !important; }
        tr:hover td { background: #161616 !important; }
      `}</style>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 20px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, color: "#555", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Admin</p>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#f0f0f0", letterSpacing: "-0.03em", margin: 0 }}>Control center</h1>
        </div>

        {/* Alerts */}
        {pendingRelease.length > 0 && (
          <div style={{ background: "#141414", border: "1px solid #2a2000", borderRadius: 8, padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#f59e0b" }}>
            <AlertTriangle size={14} /> {pendingRelease.length} trade{pendingRelease.length > 1 ? "s" : ""} confirmed — funds release required
          </div>
        )}
        {pendingW.length > 0 && (
          <div style={{ background: "#141414", border: "1px solid #1a2a1a", borderRadius: 8, padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#22c55e" }}>
            <Banknote size={14} /> {pendingW.length} withdrawal request{pendingW.length > 1 ? "s" : ""} pending
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 24 }}>
          {[
            { label: "In escrow",       value: `FCFA ${totalEscrow.toLocaleString()}` },
            { label: "Pending release", value: String(pendingRelease.length) },
            { label: "Disputed",        value: String(disputed.length) },
            { label: "Users",           value: String(users.length) },
          ].map((s,i) => (
            <div key={i} className="fade-up" style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px 16px", animationDelay: `${i*0.04}s` }}>
              <p style={{ fontSize: 11, color: "#444", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{s.label}</p>
              <p style={{ fontSize: 18, fontWeight: 600, color: "#f0f0f0", margin: 0, fontFamily: "monospace" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 16, background: "#141414", border: "1px solid #1e1e1e", borderRadius: 8, padding: 3 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ flex: 1, padding: "7px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, transition: "all 0.15s", background: tab === t.key ? "#1e1e1e" : "transparent", color: tab === t.key ? "#f0f0f0" : "#555", boxShadow: tab === t.key ? "0 1px 3px rgba(0,0,0,0.4)" : "none" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TRADES ── */}
        {tab === "trades" && (
          <div className="fade-up" style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a1a", position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 28, top: "50%", transform: "translateY(-50%)", color: "#444" }} />
              <input style={inp} value={tradeQ} onChange={e => setTradeQ(e.target.value)} placeholder="Search transactions..." />
              {tradeQ && <button onClick={() => setTradeQ("")} style={{ position: "absolute", right: 28, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#444", display: "flex" }}><X size={12} /></button>}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                    {["ID","Item","Buyer","Vendor","Amount","Status",""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, color: "#444", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map(t => {
                    const s = STATUS[t.status] || STATUS.cancelled;
                    return (
                      <tr key={t.id}>
                        <td style={cell}>
                          <Link href={`/trade/${t.id}`} style={{ color: "#22c55e", textDecoration: "none", fontFamily: "monospace", fontSize: 11 }}>{t.id.slice(0,8).toUpperCase()}</Link>
                        </td>
                        <td style={{ ...cell, color: "#f0f0f0", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</td>
                        <td style={cell}>{t.buyer_name || "—"}</td>
                        <td style={cell}>{t.vendor_name || "—"}</td>
                        <td style={{ ...cell, fontFamily: "monospace", color: "#f0f0f0", whiteSpace: "nowrap" }}>FCFA {Number(t.amount).toLocaleString()}</td>
                        <td style={cell}><span style={{ fontSize: 11, fontWeight: 500, color: s.color }}>{s.label}</span></td>
                        <td style={cell}>
                          {t.status === "pending_release" && (
                            <button onClick={() => release(t.id)} disabled={releaseLoading === t.id}
                              style={{ padding: "4px 10px", borderRadius: 5, border: "none", background: "#22c55e", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: releaseLoading === t.id ? 0.7 : 1, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                              <ShieldCheck size={11} /> {releaseLoading === t.id ? "..." : "Release"}
                            </button>
                          )}
                          {t.status === "disputed" && <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 500 }}>Review needed</span>}
                          {t.status === "complete"  && <span style={{ fontSize: 11, color: "#22c55e" }}>Done</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredTrades.length === 0 && <p style={{ textAlign: "center", color: "#444", padding: "32px", fontSize: 13 }}>{tq ? "No results" : "No transactions yet"}</p>}
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {tab === "users" && (
          <div className="fade-up" style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, overflow: "hidden" }}>
            {editUser && (
              <div style={{ padding: "16px", borderBottom: "1px solid #1a1a1a", background: "#111" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f0", margin: "0 0 12px" }}>Edit: {editUser.name}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  {[["name","Name"],["email","Email"]].map(([k,l]) => (
                    <div key={k}>
                      <label style={{ fontSize: 11, color: "#444", display: "block", marginBottom: 4, fontWeight: 500 }}>{l}</label>
                      <input value={(editUser as any)[k]} onChange={e => setEditUser((u:any) => ({...u,[k]:e.target.value}))}
                        style={{ width: "100%", padding: "7px 10px", background: "#0c0c0c", border: "1px solid #242424", borderRadius: 6, color: "#f0f0f0", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const }} />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: 11, color: "#444", display: "block", marginBottom: 4, fontWeight: 500 }}>Role</label>
                    <select value={editUser.role} onChange={e => setEditUser((u:any) => ({...u,role:e.target.value}))}
                      style={{ width: "100%", padding: "7px 10px", background: "#0c0c0c", border: "1px solid #242424", borderRadius: 6, color: "#f0f0f0", fontSize: 12, fontFamily: "inherit", outline: "none" }}>
                      <option value="buyer">Buyer</option>
                      <option value="vendor">Vendor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={saveUser} style={{ padding: "6px 14px", background: "#22c55e", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                  <button onClick={() => setEditUser(null)} style={{ padding: "6px 12px", background: "transparent", color: "#555", border: "1px solid #242424", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                </div>
              </div>
            )}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a1a", position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 28, top: "50%", transform: "translateY(-50%)", color: "#444" }} />
              <input style={inp} value={userQ} onChange={e => setUserQ(e.target.value)} placeholder="Search users..." />
              {userQ && <button onClick={() => setUserQ("")} style={{ position: "absolute", right: 28, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#444", display: "flex" }}><X size={12} /></button>}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                    {["Name","Email","Role","Trades","Joined",""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, color: "#444", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => {
                    const rc = u.role === "vendor" ? "#8b5cf6" : u.role === "admin" ? "#f59e0b" : "#22c55e";
                    return (
                      <tr key={u.id}>
                        <td style={{ ...cell, color: "#f0f0f0", fontWeight: 500 }}>{u.name}</td>
                        <td style={cell}>{u.email}</td>
                        <td style={cell}><span style={{ fontSize: 11, fontWeight: 600, color: rc, textTransform: "uppercase", letterSpacing: "0.05em" }}>{u.role}</span></td>
                        <td style={{ ...cell, fontFamily: "monospace" }}>{u.trade_count ?? 0}</td>
                        <td style={cell}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                        <td style={cell}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => setEditUser(u)} style={{ padding: "4px 8px", borderRadius: 5, cursor: "pointer", background: "transparent", color: "#555", border: "1px solid #242424", fontSize: 11, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                              <Edit3 size={10} /> Edit
                            </button>
                            {u.role !== "admin" && (
                              <button onClick={() => deleteUser(u.id)} style={{ padding: "4px 8px", borderRadius: 5, cursor: "pointer", background: "transparent", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", fontSize: 11, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                                <Trash2 size={10} /> Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredUsers.length === 0 && <p style={{ textAlign: "center", color: "#444", padding: "32px", fontSize: 13 }}>{uq ? "No results" : "No users yet"}</p>}
            </div>
          </div>
        )}

        {/* ── WITHDRAWALS ── */}
        {tab === "withdrawals" && (
          <div className="fade-up">
            {/* Pending */}
            {pendingW.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: "#444", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Pending ({pendingW.length})</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pendingW.map(w => (
                    <div key={w.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
                        <div>
                          <p style={{ fontSize: 20, fontWeight: 600, color: "#f0f0f0", fontFamily: "monospace", margin: "0 0 2px" }}>FCFA {Number(w.amount).toLocaleString()}</p>
                          <p style={{ fontSize: 13, fontWeight: 500, color: "#888", margin: "0 0 2px" }}>{w.vendor_name}</p>
                          <p style={{ fontSize: 12, color: "#444", margin: 0 }}>{w.vendor_email}</p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginBottom: 2 }}>
                            <Phone size={12} color="#444" />
                            <span style={{ fontSize: 13, fontFamily: "monospace", color: "#f0f0f0" }}>+237{w.phone}</span>
                          </div>
                          <p style={{ fontSize: 12, color: "#555", margin: "0 0 2px" }}>{w.network}</p>
                          <p style={{ fontSize: 11, color: "#333", margin: 0 }}>{new Date(w.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                        <div style={{ background: "#0c0c0c", borderRadius: 7, padding: "7px 10px" }}>
                          <p style={{ fontSize: 11, color: "#444", margin: "0 0 1px" }}>Send to</p>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "#f0f0f0", fontFamily: "monospace", margin: 0 }}>{w.network} · +237{w.phone}</p>
                        </div>
                        <button onClick={() => markSent(w.id)} disabled={sendingW === w.id}
                          style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: "#22c55e", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, opacity: sendingW === w.id ? 0.7 : 1 }}>
                          {sendingW === w.id
                            ? <><div style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Processing...</>
                            : <><CheckCircle size={13} /> Mark as sent</>
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingW.length === 0 && (
              <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "32px", textAlign: "center", marginBottom: 16 }}>
                <p style={{ fontSize: 14, color: "#22c55e", fontWeight: 500, margin: "0 0 4px" }}>All caught up</p>
                <p style={{ fontSize: 13, color: "#444", margin: 0 }}>No pending withdrawals</p>
              </div>
            )}

            {/* Processed */}
            {withdrawals.filter(w => w.status !== "pending").length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: "#444", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Processed</p>
                <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                        {["Vendor","Amount","Number","Network","Date","Status"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, color: "#444", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawals.filter(w => w.status !== "pending").map(w => {
                        const ws = W_STATUS[w.status] || W_STATUS.sent;
                        return (
                          <tr key={w.id}>
                            <td style={{ ...cell, color: "#f0f0f0", fontWeight: 500 }}>{w.vendor_name}</td>
                            <td style={{ ...cell, fontFamily: "monospace", color: "#f0f0f0" }}>FCFA {Number(w.amount).toLocaleString()}</td>
                            <td style={{ ...cell, fontFamily: "monospace" }}>+237{w.phone}</td>
                            <td style={cell}>{w.network}</td>
                            <td style={cell}>{new Date(w.created_at).toLocaleDateString()}</td>
                            <td style={cell}><span style={{ fontSize: 11, fontWeight: 600, color: ws.color }}>{ws.label}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
