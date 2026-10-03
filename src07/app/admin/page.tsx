"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Search, X, ShieldCheck, CheckCircle, AlertTriangle, Trash2, Edit3, Banknote, Phone } from "lucide-react";
import { PageLoader, Pill, StatusPill } from "@/components/ui";
import { WITHDRAWAL_STATUS, brandText, fmtDate, fmtDateTime, money, roleLabel, shortId, statusMeta } from "@/lib/zola";

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
  const [actionError, setActionError]       = useState("");

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
    setReleaseLoading(id); setActionError("");
    const res = await fetch(`/api/admin/release/${id}`, { method: "POST" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error || "The payment could not be released. Please try again."); }
    await load(); setReleaseLoading(null);
  }

  async function markSent(id: string) {
    setSendingW(id); setActionError("");
    const res = await fetch(`/api/withdrawals/${id}/sent`, { method: "POST" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setActionError(d.error || "The payout could not be sent. Please try again."); }
    await load(); setSendingW(null);
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user? This can't be undone.")) return;
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
  const filteredTrades = tq ? trades.filter(t => t.id?.toLowerCase().includes(tq) || t.title?.toLowerCase().includes(tq) || t.buyer_name?.toLowerCase().includes(tq) || t.vendor_name?.toLowerCase().includes(tq) || t.status?.toLowerCase().includes(tq) || statusMeta(t.status).label.toLowerCase().includes(tq) || String(t.amount).includes(tq)) : trades;
  const filteredUsers  = uq ? users.filter(u => u.name?.toLowerCase().includes(uq) || u.email?.toLowerCase().includes(uq) || u.role?.toLowerCase().includes(uq) || roleLabel(u.role).toLowerCase().includes(uq)) : users;

  const pendingRelease  = trades.filter(t => t.status === "pending_release");
  const disputed        = trades.filter(t => t.status === "disputed");
  const pendingW        = withdrawals.filter(w => w.status === "pending");
  const processedW      = withdrawals.filter(w => w.status !== "pending");
  // Money actually paid in and not yet released (unpaid transactions aren't held)
  const totalEscrow     = trades.filter(t => !["complete","cancelled","pending_payment"].includes(t.status)).reduce((s:number,t:any) => s+t.amount, 0);
  const needsAttention  = pendingRelease.length + pendingW.length + disputed.length > 0;

  const TABS = [
    { key: "trades" as const,      label: `Transactions (${trades.length})` },
    { key: "users" as const,       label: `Users (${users.length})` },
    { key: "withdrawals" as const, label: `Withdrawals${pendingW.length > 0 ? ` (${pendingW.length})` : ""}` },
  ];

  if (loading || !user) return <PageLoader />;

  return (
    <div className="page">
      <Navbar user={{ name: user.name, role: user.role }} />

      <main className="container main">

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 className="page-title">Admin</h1>
          <p className="page-sub">Release payments, send withdrawals and manage accounts.</p>
        </div>

        {actionError && (
          <div className="notice notice-danger" role="alert" style={{ marginBottom: 12 }}>
            <AlertTriangle size={16} /> <span>{actionError}</span>
          </div>
        )}

        {/* Things that need the admin */}
        {needsAttention && (
          <div className="stack" style={{ gap: 10, marginBottom: 20 }}>
            {pendingRelease.length > 0 && (
              <div className="notice notice-wait">
                <AlertTriangle size={16} />
                <span>{pendingRelease.length} transaction{pendingRelease.length > 1 ? "s" : ""} delivered and waiting for you to release the payment.</span>
              </div>
            )}
            {pendingW.length > 0 && (
              <div className="notice notice-wait">
                <Banknote size={16} />
                <span>
                  {pendingW.length} withdrawal request{pendingW.length > 1 ? "s" : ""} waiting to be sent.{" "}
                  {tab !== "withdrawals" && <button className="link-btn" style={{ color: "inherit", textDecoration: "underline" }} onClick={() => setTab("withdrawals")}>Review</button>}
                </span>
              </div>
            )}
            {disputed.length > 0 && (
              <div className="notice notice-danger">
                <AlertTriangle size={16} />
                <span>{disputed.length} disputed transaction{disputed.length > 1 ? "s" : ""} to review.</span>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="stats">
          <div className="stat stat-lead">
            <p className="stat-label">Held by Zola</p>
            <p className="stat-value">{money(totalEscrow)}</p>
            <p className="stat-note">Paid by buyers and not yet released</p>
          </div>
          {[
            { label: "Waiting for release", value: String(pendingRelease.length) },
            { label: "Disputed",            value: String(disputed.length) },
            { label: "Users",               value: String(users.length) },
          ].map((s) => (
            <div key={s.label} className="stat">
              <p className="stat-label">{s.label}</p>
              <p className="stat-value">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="seg" role="tablist" style={{ marginBottom: 16, overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} className="seg-item" onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TRANSACTIONS ── */}
        {tab === "trades" && (
          <div className="card fade-up" style={{ overflow: "hidden" }}>
            <div style={{ padding: 14, borderBottom: "1px solid var(--line-soft)" }}>
              <div className="search">
                <Search size={17} className="search-icon" />
                <input className="input" value={tradeQ} onChange={e => setTradeQ(e.target.value)} placeholder="Search transactions" aria-label="Search transactions" />
                {tradeQ && <button onClick={() => setTradeQ("")} className="search-clear" aria-label="Clear search"><X size={16} /></button>}
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    {["ID","Item","Buyer","Seller","Amount","Status",""].map((h, i) => <th key={i}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map(t => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/trade/${t.id}`} className="num" style={{ fontWeight: 600, letterSpacing: "0.03em" }}>{shortId(t.id)}</Link>
                      </td>
                      <td className="strong" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</td>
                      <td>{t.buyer_name || "—"}</td>
                      <td>{t.vendor_name || "—"}</td>
                      <td className="strong num" style={{ whiteSpace: "nowrap" }}>{money(t.amount)}</td>
                      <td><StatusPill status={t.status} /></td>
                      <td>
                        {t.status === "pending_release" && (
                          <button onClick={() => release(t.id)} disabled={releaseLoading === t.id} className="btn btn-primary btn-sm">
                            <ShieldCheck size={15} /> {releaseLoading === t.id ? "Releasing..." : "Release payment"}
                          </button>
                        )}
                        {t.status === "disputed" && <Link href={`/trade/${t.id}`} style={{ fontSize: 13.5, fontWeight: 600, color: "var(--error-ink)" }}>Review</Link>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTrades.length === 0 && <p className="empty empty-text">{tq ? "No transactions match that search." : "No transactions yet."}</p>}
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {tab === "users" && (
          <div className="card fade-up" style={{ overflow: "hidden" }}>
            {editUser && (
              <div style={{ padding: 18, borderBottom: "1px solid var(--line-soft)", background: "var(--bg)" }}>
                <h2 className="section-title" style={{ marginBottom: 12 }}>Edit {brandText(editUser.name)}</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
                  {[["name","Name"],["email","Email"]].map(([k,l]) => (
                    <div key={k} className="field">
                      <label className="label" htmlFor={`u-${k}`}>{l}</label>
                      <input id={`u-${k}`} className="input" value={(editUser as any)[k]} onChange={e => setEditUser((u:any) => ({...u,[k]:e.target.value}))} />
                    </div>
                  ))}
                  <div className="field">
                    <label className="label" htmlFor="u-role">Role</label>
                    <select id="u-role" className="select" value={editUser.role} onChange={e => setEditUser((u:any) => ({...u,role:e.target.value}))}>
                      <option value="buyer">Buyer</option>
                      <option value="vendor">Seller</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="btn-row">
                  <button onClick={saveUser} className="btn btn-primary btn-sm">Save changes</button>
                  <button onClick={() => setEditUser(null)} className="btn btn-secondary btn-sm">Cancel</button>
                </div>
              </div>
            )}
            <div style={{ padding: 14, borderBottom: "1px solid var(--line-soft)" }}>
              <div className="search">
                <Search size={17} className="search-icon" />
                <input className="input" value={userQ} onChange={e => setUserQ(e.target.value)} placeholder="Search users" aria-label="Search users" />
                {userQ && <button onClick={() => setUserQ("")} className="search-clear" aria-label="Clear search"><X size={16} /></button>}
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    {["Name","Email","Role","Completed","Joined",""].map((h, i) => <th key={i}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td className="strong">{brandText(u.name)}</td>
                      <td>{u.email}</td>
                      <td><span className={`tag${u.role === "admin" ? " tag-you" : ""}`}>{roleLabel(u.role)}</span></td>
                      <td className="num">{u.trade_count ?? 0}</td>
                      <td className="num">{u.created_at ? fmtDate(u.created_at) : "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button onClick={() => setEditUser(u)} className="btn btn-secondary btn-sm">
                            <Edit3 size={14} /> Edit
                          </button>
                          {u.role !== "admin" && (
                            <button onClick={() => deleteUser(u.id)} className="btn btn-danger-outline btn-sm">
                              <Trash2 size={14} /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && <p className="empty empty-text">{uq ? "No users match that search." : "No users yet."}</p>}
            </div>
          </div>
        )}

        {/* ── WITHDRAWALS ── */}
        {tab === "withdrawals" && (
          <div className="fade-up">
            {/* Pending */}
            {pendingW.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h2 className="section-title" style={{ marginBottom: 10 }}>Waiting to be sent ({pendingW.length})</h2>
                <div className="stack" style={{ gap: 12 }}>
                  {pendingW.map(w => (
                    <div key={w.id} className="card card-pad">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                        <div>
                          <p className="amount-xl" style={{ fontSize: 24 }}>{money(w.amount)}</p>
                          <p style={{ fontSize: 14.5, fontWeight: 600, color: "var(--navy)", marginTop: 4 }}>{w.vendor_name}</p>
                          <p className="hint">{w.vendor_email}</p>
                        </div>
                        <p className="hint num">Requested {fmtDateTime(w.created_at)}</p>
                      </div>
                      <hr className="divider" />
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className="avatar"><Phone size={16} /></span>
                          <div>
                            <p className="hint">Send to</p>
                            <p className="num" style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)" }}>+237{w.phone} <span style={{ fontWeight: 500, color: "var(--ink-3)" }}>({w.network})</span></p>
                          </div>
                        </div>
                        <button onClick={() => markSent(w.id)} disabled={sendingW === w.id} className="btn btn-primary">
                          {sendingW === w.id
                            ? <><span className="spinner spinner-sm spinner-on-color" /> Sending...</>
                            : <><CheckCircle size={17} /> Send payout</>
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingW.length === 0 && (
              <div className="card empty" style={{ marginBottom: 24 }}>
                <p className="empty-title">All caught up</p>
                <p className="empty-text">There are no withdrawals waiting to be sent.</p>
              </div>
            )}

            {/* Processed */}
            {processedW.length > 0 && (
              <div>
                <h2 className="section-title" style={{ marginBottom: 10 }}>Processed</h2>
                <div className="card" style={{ overflow: "hidden" }}>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          {["Seller","Amount","Number","Network","Date","Status"].map(h => <th key={h}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {processedW.map(w => {
                          const ws = WITHDRAWAL_STATUS[w.status] || WITHDRAWAL_STATUS.sent;
                          return (
                            <tr key={w.id}>
                              <td className="strong">{w.vendor_name}</td>
                              <td className="strong num" style={{ whiteSpace: "nowrap" }}>{money(w.amount)}</td>
                              <td className="num">+237{w.phone}</td>
                              <td>{w.network}</td>
                              <td className="num">{fmtDate(w.created_at)}</td>
                              <td><Pill tone={ws.tone}>{ws.label}</Pill></td>
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
