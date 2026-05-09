"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Users, TrendingUp, AlertTriangle, CheckCircle, Clock, Trash2, Edit3, ShieldCheck } from "lucide-react";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: "Pending payment", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  funds_held:      { label: "Funds held", color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  shipped:         { label: "Shipped", color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  pending_release: { label: "Pending release ⚡", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  complete:        { label: "Complete", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  disputed:        { label: "Disputed", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  cancelled:       { label: "Cancelled", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<"trades"|"users">("trades");
  const [trades, setTrades] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<any>(null);
  const [releaseLoading, setReleaseLoading] = useState<string|null>(null);

  const load = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    const meData = await meRes.json();
    if (!meData.user || meData.user.role !== "admin") { router.push("/auth/login"); return; }
    setUser(meData.user);

    const [tradeRes, userRes] = await Promise.all([
      fetch("/api/trades"),
      fetch("/api/admin/users"),
    ]);
    const tradeData = await tradeRes.json();
    const userData = await userRes.json();
    setTrades(tradeData.trades || []);
    setUsers(userData.users || []);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function releaseFunds(id: string) {
    setReleaseLoading(id);
    const res = await fetch(`/api/admin/release/${id}`, { method: "POST" });
    if (res.ok) await load();
    setReleaseLoading(null);
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

  if (loading || !user) return <div style={{ minHeight: "100vh", background: "#0a0f0d", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", fontSize: 14 }}>Loading admin panel...</div>;

  const pendingRelease = trades.filter(t => t.status === "pending_release");
  const disputed = trades.filter(t => t.status === "disputed");
  const totalEscrow = trades.filter(t => !["complete","cancelled"].includes(t.status)).reduce((s:number,t:any) => s+t.amount, 0);

  const cardStyle = { background: "#111812", border: "1px solid rgba(74,222,128,0.12)", borderRadius: 14, padding: "1.1rem 1.25rem" };

  return (
    <div style={{ background: "#0a0f0d", minHeight: "100vh" }}>
      <Navbar user={{ name: user.name, role: user.role }} />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>

        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, letterSpacing: ".1em", marginBottom: 4 }}>ADMIN PANEL</p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0fdf4", margin: 0, letterSpacing: "-0.03em" }}>SafeTrade Control Center</h1>
        </div>

        {/* Alert: pending releases */}
        {pendingRelease.length > 0 && (
          <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 12, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={16} color="#f59e0b" />
            <p style={{ fontSize: 13, color: "#f59e0b", margin: 0, fontWeight: 600 }}>
              {pendingRelease.length} trade{pendingRelease.length > 1 ? "s" : ""} confirmed by buyer — action required to release funds
            </p>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: "1.5rem" }}>
          {[
            { icon: <TrendingUp size={15}/>, label: "Total in escrow", value: `FCFA ${totalEscrow.toLocaleString()}`, color: "#22c55e" },
            { icon: <Clock size={15}/>, label: "Pending release", value: String(pendingRelease.length), color: "#f59e0b" },
            { icon: <AlertTriangle size={15}/>, label: "Disputed", value: String(disputed.length), color: "#ef4444" },
            { icon: <Users size={15}/>, label: "Total users", value: String(users.length), color: "#60a5fa" },
          ].map((s,i) => (
            <div key={i} style={cardStyle}>
              <div style={{ color: s.color, marginBottom: 6 }}>{s.icon}</div>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#f0fdf4", margin: "0 0 2px", fontFamily: "monospace" }}>{s.value}</p>
              <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {(["trades","users"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
              fontSize: 13, fontWeight: 600, border: "1px solid",
              background: tab===t ? "#22c55e" : "#111812",
              color: tab===t ? "#fff" : "#6b7280",
              borderColor: tab===t ? "#22c55e" : "rgba(74,222,128,0.12)",
            }}>
              {t === "trades" ? `Transactions (${trades.length})` : `Users (${users.length})`}
            </button>
          ))}
        </div>

        {/* Trades table */}
        {tab === "trades" && (
          <div style={cardStyle}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(74,222,128,0.1)" }}>
                    {["ID","Item","Buyer","Vendor","Amount","Status","Deadline","Action"].map(h => (
                      <th key={h} style={{ textAlign:"left", padding:"8px 10px", fontSize:10, color:"#6b7280", fontWeight:700, letterSpacing:".05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.map(t => {
                    const meta = STATUS_META[t.status] || STATUS_META.cancelled;
                    return (
                      <tr key={t.id} style={{ borderBottom: "1px solid rgba(74,222,128,0.06)" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#162018"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                        <td style={{ padding:"10px", fontSize:10, fontFamily:"monospace", color:"#6b7280" }}>
                          <Link href={`/trade/${t.id}`} style={{ color:"#4ade80", textDecoration:"none" }}>{t.id.slice(0,8).toUpperCase()}</Link>
                        </td>
                        <td style={{ padding:"10px", fontSize:12, color:"#f0fdf4", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.title}</td>
                        <td style={{ padding:"10px", fontSize:12, color:"#6b7280" }}>{t.buyer_name}</td>
                        <td style={{ padding:"10px", fontSize:12, color:"#6b7280" }}>{t.vendor_name}</td>
                        <td style={{ padding:"10px", fontSize:12, fontFamily:"monospace", color:"#4ade80", fontWeight:700 }}>FCFA {t.amount.toLocaleString()}</td>
                        <td style={{ padding:"10px" }}>
                          <span style={{ padding:"3px 8px", borderRadius:12, background:meta.bg, color:meta.color, fontSize:10, fontWeight:700 }}>{meta.label}</span>
                        </td>
                        <td style={{ padding:"10px", fontSize:11, color:"#6b7280", fontFamily:"monospace" }}>
                          {t.delivery_deadline ? new Date(t.delivery_deadline).toLocaleDateString() : "—"}
                        </td>
                        <td style={{ padding:"10px" }}>
                          {t.status === "pending_release" && (
                            <button onClick={() => releaseFunds(t.id)} disabled={releaseLoading === t.id} style={{
                              display:"flex", alignItems:"center", gap:5, padding:"5px 11px", borderRadius:7, cursor:"pointer",
                              background:"#22c55e", color:"#fff", border:"none", fontSize:11, fontWeight:700, fontFamily:"inherit",
                              opacity: releaseLoading===t.id ? 0.7 : 1,
                            }}>
                              <ShieldCheck size={11}/> {releaseLoading===t.id ? "Releasing..." : "Release funds"}
                            </button>
                          )}
                          {t.status === "disputed" && (
                            <span style={{ fontSize:11, color:"#ef4444", fontWeight:700 }}>Review needed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {trades.length === 0 && <p style={{ textAlign:"center", color:"#6b7280", padding:"2rem", fontSize:13 }}>No trades yet</p>}
            </div>
          </div>
        )}

        {/* Users table */}
        {tab === "users" && (
          <div style={cardStyle}>
            {editUser && (
              <div style={{ background:"#162018", border:"1px solid rgba(74,222,128,0.2)", borderRadius:12, padding:16, marginBottom:16 }}>
                <p style={{ fontSize:12, fontWeight:700, color:"#4ade80", marginBottom:12 }}>Editing: {editUser.name}</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
                  {[["name","Name"],["email","Email"]].map(([k,l]) => (
                    <div key={k}>
                      <label style={{ fontSize:11, color:"#6b7280", display:"block", marginBottom:4 }}>{l}</label>
                      <input value={(editUser as any)[k]} onChange={e => setEditUser((u: any) => ({...u,[k]:e.target.value}))}
                        style={{ width:"100%", padding:"7px 10px", background:"#0a0f0d", border:"1px solid rgba(74,222,128,0.15)", borderRadius:7, color:"#f0fdf4", fontSize:12, fontFamily:"inherit", outline:"none" }} />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize:11, color:"#6b7280", display:"block", marginBottom:4 }}>Role</label>
                    <select value={editUser.role} onChange={e => setEditUser((u: any) => ({...u,role:e.target.value}))}
                      style={{ width:"100%", padding:"7px 10px", background:"#0a0f0d", border:"1px solid rgba(74,222,128,0.15)", borderRadius:7, color:"#f0fdf4", fontSize:12, fontFamily:"inherit", outline:"none" }}>
                      <option value="buyer">Buyer</option>
                      <option value="vendor">Vendor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={saveUser} style={{ padding:"7px 16px", background:"#22c55e", color:"#fff", border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Save</button>
                  <button onClick={() => setEditUser(null)} style={{ padding:"7px 16px", background:"#162018", color:"#6b7280", border:"1px solid rgba(74,222,128,0.12)", borderRadius:8, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
                </div>
              </div>
            )}
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid rgba(74,222,128,0.1)" }}>
                  {["Avatar","Name","Email","Role","Trades","Joined","Actions"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"8px 10px", fontSize:10, color:"#6b7280", fontWeight:700, letterSpacing:".05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const roleColor = u.role==="vendor" ? "#a78bfa" : u.role==="admin" ? "#f59e0b" : "#4ade80";
                  return (
                    <tr key={u.id} style={{ borderBottom:"1px solid rgba(74,222,128,0.06)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background="#162018"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background="transparent"}>
                      <td style={{ padding:"10px" }}>
                        <div style={{ width:28, height:28, borderRadius:"50%", background:`${roleColor}15`, border:`1px solid ${roleColor}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:roleColor, fontFamily:"monospace" }}>
                          {u.avatar || u.name.slice(0,2).toUpperCase()}
                        </div>
                      </td>
                      <td style={{ padding:"10px", fontSize:13, fontWeight:600, color:"#f0fdf4" }}>{u.name}</td>
                      <td style={{ padding:"10px", fontSize:12, color:"#6b7280" }}>{u.email}</td>
                      <td style={{ padding:"10px" }}>
                        <span style={{ padding:"3px 8px", borderRadius:12, background:`${roleColor}15`, color:roleColor, fontSize:10, fontWeight:700, textTransform:"uppercase" }}>{u.role}</span>
                      </td>
                      <td style={{ padding:"10px", fontSize:12, fontFamily:"monospace", color:"#f0fdf4" }}>{u.trade_count}</td>
                      <td style={{ padding:"10px", fontSize:11, color:"#6b7280" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td style={{ padding:"10px" }}>
                        <div style={{ display:"flex", gap:6 }}>
                          <button onClick={() => setEditUser(u)} style={{ padding:"5px 9px", borderRadius:7, cursor:"pointer", background:"rgba(96,165,250,0.1)", color:"#60a5fa", border:"1px solid rgba(96,165,250,0.2)", fontSize:11, fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
                            <Edit3 size={11}/> Edit
                          </button>
                          {u.role !== "admin" && (
                            <button onClick={() => deleteUser(u.id)} style={{ padding:"5px 9px", borderRadius:7, cursor:"pointer", background:"rgba(239,68,68,0.08)", color:"#ef4444", border:"1px solid rgba(239,68,68,0.2)", fontSize:11, fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
                              <Trash2 size={11}/> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {users.length === 0 && <p style={{ textAlign:"center", color:"#6b7280", padding:"2rem", fontSize:13 }}>No users yet</p>}
          </div>
        )}
      </main>
    </div>
  );
}
