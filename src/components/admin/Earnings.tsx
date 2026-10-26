"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Table2, BarChart3 } from "lucide-react";
import { money } from "@/lib/zola";

/**
 * Admin: what Zola earns. Zola fees on transactions plus the Pickup delivery
 * margin (delivery fee minus what riders earn), over a chosen period, compared
 * with the period before. Figures come from /api/admin/stats.
 */
const RANGES = [["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["365d", "12 months"], ["all", "All time"]] as const;
const RANGE_KEY = "zola-admin-earnings-range";

export default function Earnings() {
  const [range, setRange] = useState<string>(() => { try { return localStorage.getItem(RANGE_KEY) || "30d"; } catch { return "30d"; } });
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    try { localStorage.setItem(RANGE_KEY, range); } catch {}
    fetch(`/api/admin/stats?range=${range}`, { cache: "no-store" }).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "The figures couldn't be loaded."); return; }
      setData(d);
    }).catch(() => setErr("The figures couldn't be loaded. Check your connection."));
  }, [range]);

  const label = RANGES.find(([k]) => k === range)?.[1] || "";
  if (err) return <div className="notice notice-danger">{err}</div>;
  if (!data) return <div className="card empty"><span className="spinner" /></div>;
  const c = data.current, p = data.previous;

  return (
    <div className="fade-up stack earn" style={{ gap: 14 }}>
      <div className="seg" role="group" aria-label="Period" style={{ alignSelf: "flex-start", overflowX: "auto", maxWidth: "100%" }}>
        {RANGES.map(([k, l]) => <button key={k} type="button" className="seg-item" aria-pressed={range === k} onClick={() => setRange(k)}>{l}</button>)}
      </div>

      {/* Headline */}
      <div className="earn-grid">
        <div className="stat stat-lead earn-hero">
          <p className="stat-label">Earned{range === "all" ? "" : `, last ${label}`}</p>
          <p className="stat-value earn-hero-value">{money(c.net)}</p>
          <Change now={c.net} before={p?.net} label={label} light />
          <div className="earn-split">
            <span><strong>{money(c.secured)}</strong> secured</span>
            <span><strong>{money(c.pending)}</strong> pending</span>
          </div>
        </div>
        <Tile label="Zola fees" value={money(c.zola_fees)} now={c.zola_fees} before={p?.zola_fees} note={`${c.paid_trades} paid transaction${c.paid_trades === 1 ? "" : "s"}, ${money(c.avg_fee)} on average`} swatch="zola" />
        <Tile label="Pickup delivery margin" value={money(c.pickup_margin)} now={c.pickup_margin} before={p?.pickup_margin} note={`${c.deliveries} deliver${c.deliveries === 1 ? "y" : "ies"}: ${money(c.delivery_fees)} in, ${money(c.rider_pay)} to riders`} swatch="pickup" />
        <Tile label="Value of sales" value={money(c.gmv)} now={c.gmv} before={p?.gmv} note="Item prices of paid transactions (sellers' money, not earnings)" />
      </div>

      <Chart series={data.series} bucket={data.bucket} />

      <div className="earn-two">
        {/* Where the money comes from */}
        <section className="card card-pad">
          <h2 className="section-title">Where it comes from</h2>
          <div className="kv"><span><i className="earn-sw earn-sw-zola" /> Zola fees (8% or 5%)</span><strong className="num">{money(c.zola_fees)}</strong></div>
          <div className="kv"><span><i className="earn-sw earn-sw-pickup" /> Pickup delivery fees</span><span className="num">{money(c.delivery_fees)}</span></div>
          <div className="kv"><span style={{ paddingLeft: 18 }}>Paid to riders</span><span className="num">− {money(c.rider_pay)}</span></div>
          <div className="kv"><span style={{ paddingLeft: 18 }}>Pickup margin</span><strong className="num">{money(c.pickup_margin)}</strong></div>
          <div className="kv kv-total"><span>Earned</span><span className="num">{money(c.net)}</span></div>
          {c.flat_delivery > 0 && <p className="hint" style={{ marginTop: 8 }}>Also {money(c.flat_delivery)} in flat FCFA 1,000 deliveries (before Pickup). Not counted above: what you paid to deliver them isn&apos;t recorded.</p>}
          <p className="hint" style={{ marginTop: 8 }}>Before mobile money (Fapshi) charges.</p>
        </section>

        {/* Transactions started in the period */}
        <section className="card card-pad">
          <h2 className="section-title">Transactions started</h2>
          <Funnel f={data.funnel} />
        </section>
      </div>

      <div className="earn-two">
        <section className="card" style={{ overflow: "hidden" }}>
          <h2 className="section-title card-pad" style={{ paddingBottom: 0 }}>Top sellers by fees</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Seller</th><th className="num">Sales</th><th className="num earn-hide-sm">Value</th><th className="num">Fees</th></tr></thead>
              <tbody>{data.top_sellers.map((v: any) => <tr key={v.name + v.fees}><td className="strong">{v.name}</td><td className="num">{v.count}</td><td className="num earn-hide-sm">{money(v.gmv)}</td><td className="num">{money(v.fees)}</td></tr>)}</tbody>
            </table>
            {data.top_sellers.length === 0 && <p className="empty empty-text">No paid transactions in this period.</p>}
          </div>
        </section>
        <section className="card" style={{ overflow: "hidden" }}>
          <h2 className="section-title card-pad" style={{ paddingBottom: 0 }}>Pickup by city</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>City</th><th className="num">Deliveries</th><th className="num">Margin</th></tr></thead>
              <tbody>{data.cities.map((v: any) => <tr key={v.city}><td className="strong">{v.city}</td><td className="num">{v.count}</td><td className="num">{money(v.margin)}</td></tr>)}</tbody>
            </table>
            {data.cities.length === 0 && <p className="empty empty-text">No paid deliveries in this period.</p>}
          </div>
        </section>
      </div>

      <div className="earn-two">
        <section className="card card-pad">
          <h2 className="section-title">Money you hold (not earnings)</h2>
          <p className="hint" style={{ marginBottom: 8 }}>Right now. This belongs to sellers and riders.</p>
          <div className="kv"><span>Held for sellers (paid, not yet released)</span><span className="num">{money(data.held.escrow)}</span></div>
          <div className="kv"><span>Rider balances (deposits and earnings)</span><span className="num">{money(data.held.rider_balances)}</span></div>
          <div className="kv"><span>Seller withdrawals to send</span><span className="num">{money(data.held.seller_withdrawals)}</span></div>
          <div className="kv"><span>Rider withdrawals to send</span><span className="num">{money(data.held.rider_withdrawals)}</span></div>
        </section>
        <section className="card card-pad">
          <h2 className="section-title">People</h2>
          <div className="kv"><span>Buyers and sellers</span><span className="num">{data.people.users}</span></div>
          <div className="kv"><span>New users{range === "all" ? "" : `, last ${label}`}</span><span className="num">{data.people.new_users}</span></div>
          <div className="kv"><span>Approved riders</span><span className="num">{data.people.riders}</span></div>
          <div className="kv"><span>Riders available now</span><span className="num">{data.people.riders_on}</span></div>
        </section>
      </div>
    </div>
  );
}

function Change({ now, before, label, light }: { now: number; before?: number; label: string; light?: boolean }) {
  if (before === undefined || before === null) return null;
  const cls = light ? "earn-change earn-change-light" : "earn-change";
  if (before === 0) return <p className={cls}>{now > 0 ? "New this period" : "Nothing in the period before"}</p>;
  const pct = Math.round(((now - before) / before) * 100);
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  return <p className={cls}><Icon size={14} aria-hidden /><span>{pct > 0 ? "+" : ""}{pct}% vs the {label} before<span className="earn-was">Then: {money(before)}</span></span></p>;
}

function Tile({ label, value, now, before, note, swatch }: { label: string; value: string; now: number; before?: number; note: string; swatch?: "zola" | "pickup" }) {
  return (
    <div className="stat">
      <p className="stat-label">{swatch && <i className={`earn-sw earn-sw-${swatch}`} />}{label}</p>
      <p className="stat-value">{value}</p>
      <Change now={now} before={before} label="period" />
      <p className="stat-note">{note}</p>
    </div>
  );
}

function Funnel({ f }: { f: any }) {
  const rows = [["Created", f.created], ["Paid", f.paid], ["Completed", f.completed]] as [string, number][];
  const max = Math.max(1, f.created);
  return (
    <div className="stack" style={{ gap: 10 }}>
      {rows.map(([l, v]) => (
        <div key={l}>
          <div className="kv" style={{ padding: 0, border: 0 }}><span>{l}</span><span className="num">{v}{l !== "Created" && f.created ? <span className="hint"> · {Math.round((v / f.created) * 100)}%</span> : null}</span></div>
          <div className="earn-bar"><span style={{ width: `${(v / max) * 100}%` }} /></div>
        </div>
      ))}
      <p className="hint">{f.cancelled} cancelled · {f.disputed} disputed</p>
    </div>
  );
}

/* ── Earnings over time: stacked bars (Zola fees, Pickup margin) ─────────── */

const fmtShort = (v: number) => v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${+(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k` : String(Math.round(v));

function bucketLabel(iso: string, bucket: string, long = false) {
  const d = new Date(Date.parse(iso) + 3600000);
  const M = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  if (bucket === "month") return long ? `${M} ${d.getUTCFullYear()}` : M;
  if (bucket === "week") return long ? `Week of ${d.getUTCDate()} ${M}` : `${d.getUTCDate()} ${M}`;
  return `${d.getUTCDate()} ${M}`;
}

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function Chart({ series, bucket }: { series: any[]; bucket: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  // Draw at the real width so text stays readable on phones
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.round(el.clientWidth))));
    ro.observe(el); return () => ro.disconnect();
  }, [asTable]);
  const total = series.reduce((a, s) => a + s.zola + Math.max(0, s.pickup), 0);
  const H = W < 500 ? 200 : 240, L = 40, R = 8, T = 12, B = 26;
  const max = useMemo(() => niceMax(Math.max(...series.map((s) => Math.max(0, s.zola) + Math.max(0, s.pickup)), 0)), [series]);
  const n = series.length || 1;
  const step = (W - L - R) / n;
  const bw = Math.max(2, Math.min(36, step * 0.64));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const every = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(W / 90))));

  // Bar with rounded top corners only (4px), square at the baseline
  const bar = (x: number, top: number, bottom: number, round: boolean) => {
    const h = bottom - top; if (h <= 0) return "";
    const r = round ? Math.min(4, h, bw / 2) : 0;
    return `M${x},${bottom}V${top + r}${r ? `Q${x},${top} ${x + r},${top}` : ""}H${x + bw - r}${r ? `Q${x + bw},${top} ${x + bw},${top + r}` : ""}V${bottom}Z`;
  };

  const h = hover !== null ? series[hover] : null;
  return (
    <section className="card card-pad">
      <div className="earn-chart-head">
        <h2 className="section-title" style={{ margin: 0 }}>Earnings by {bucket}</h2>
        <div className="earn-legend">
          <span><i className="earn-sw earn-sw-zola" /> Zola fees</span>
          <span><i className="earn-sw earn-sw-pickup" /> Pickup margin</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsTable(!asTable)} aria-pressed={asTable}>
            {asTable ? <><BarChart3 size={14} /> Chart</> : <><Table2 size={14} /> Table</>}
          </button>
        </div>
      </div>

      {asTable ? (
        <div className="table-wrap" style={{ maxHeight: 320, overflowY: "auto" }}>
          <table className="table">
            <thead><tr><th>{bucket === "day" ? "Day" : bucket === "week" ? "Week" : "Month"}</th><th className="num">Zola fees</th><th className="num">Pickup margin</th><th className="num">Total</th></tr></thead>
            <tbody>{series.slice().reverse().map((s) => <tr key={s.start}><td>{bucketLabel(s.start, bucket, true)}</td><td className="num">{money(s.zola)}</td><td className="num">{money(s.pickup)}</td><td className="num strong">{money(s.zola + s.pickup)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : total === 0 ? (
        <p className="empty empty-text">No earnings in this period yet.</p>
      ) : (
        <div className="earn-chart" ref={box} onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Earnings by ${bucket}: ${money(total)} in total`}>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 0 ? "earn-axis" : "earn-grid-line"} />
                <text x={L - 6} y={y(v) + 4} textAnchor="end" className="earn-tick">{fmtShort(v)}</text>
              </g>
            ))}
            {series.map((s, i) => {
              const x = L + i * step + (step - bw) / 2;
              const z = Math.max(0, s.zola), pk = Math.max(0, s.pickup);
              const zTop = y(z), pTop = y(z + pk);
              const gap = z > 0 && pk > 0 ? 2 : 0;
              return (
                <g key={s.start} opacity={hover === null || hover === i ? 1 : 0.45}>
                  <path d={bar(x, zTop, y(0), pk === 0)} className="earn-fill-zola" />
                  {pk > 0 && <path d={bar(x, pTop, zTop - gap, true)} className="earn-fill-pickup" />}
                  {i % every === 0 && <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="earn-tick">{bucketLabel(s.start, bucket)}</text>}
                  <rect x={L + i * step} y={T} width={step} height={H - T - B} fill="transparent"
                    onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}
                    aria-label={`${bucketLabel(s.start, bucket, true)}: ${money(s.zola + s.pickup)}`} />
                </g>
              );
            })}
          </svg>
          {h && (
            <div className="earn-tip" style={{ left: Math.min(Math.max(L + hover! * step + step / 2, 100), W - 100) }} role="status">
              <p className="earn-tip-title">{bucketLabel(h.start, bucket, true)}</p>
              <p><i className="earn-sw earn-sw-zola" /> Zola fees <strong>{money(h.zola)}</strong></p>
              <p><i className="earn-sw earn-sw-pickup" /> Pickup margin <strong>{money(h.pickup)}</strong></p>
              <p className="earn-tip-total">Total <strong>{money(h.zola + h.pickup)}</strong></p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
