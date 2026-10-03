"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Check, Package, ArrowLeft } from "lucide-react";
import { ZolaMark } from "@/components/Logo";
import { PageLoader } from "@/components/ui";
import { fmtDate, fmtDateTime, money } from "@/lib/zola";
import { DELIVERY_FEE } from "@/lib/fees";
import { DELIVERY_COMPANY, trackingNumber } from "@/lib/delivery";

/**
 * Delivery tracking page.
 *
 * This is the stand-in for the separate delivery company's website: Zola sends
 * the buyer here after they pay. It reads the order from Zola, so for now the
 * person needs to be signed in to Zola to see it. When the real delivery site
 * exists, set NEXT_PUBLIC_DELIVERY_URL and Zola will send people there instead.
 */

type Stage = 0 | 1 | 2 | 3 | 4; // how many of the four stops are complete

const STAGE: Record<string, Stage> = {
  pending_payment: 0,
  funds_held: 1,
  shipped: 2,
  delivered: 4,
  pending_release: 4,
  complete: 4,
};

function eventTime(events: any[], ...labels: string[]): string {
  const ev = events.find((e) => labels.some((l) => String(e.label || "").toLowerCase().startsWith(l)));
  return ev?.created_at ? fmtDateTime(ev.created_at) : "";
}

export default function DeliveryTrackingPage() {
  const { id } = useParams() as { id: string };
  const [state, setState]   = useState<"loading" | "ready" | "signin" | "missing">("loading");
  const [trade, setTrade]   = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [me, setMe]         = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) { setState("signin"); return; }
      setMe((await meRes.json()).user);
      const res = await fetch(`/api/trades/${id}`);
      if (!res.ok) { setState("missing"); return; }
      const data = await res.json();
      setTrade(data.trade); setEvents(data.events || []); setState("ready");
    } catch { setState("missing"); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Keep the status fresh while the page is open
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) load(); }, 30000);
    return () => clearInterval(t);
  }, [load]);

  if (state === "loading") return <PageLoader />;

  const header = (
    <div className="dlv-bar">
      <span className="dlv-brand">
        <span className="dlv-brand-mark"><Package size={18} strokeWidth={2.4} /></span>
        {DELIVERY_COMPANY}
      </span>
      <span className="dlv-via"><ZolaMark size={18} color="#fff" /> <span>Delivering orders paid through Zola</span></span>
    </div>
  );

  if (state !== "ready" || !trade) {
    return (
      <div className="dlv">
        <div className="dlv-band" style={{ paddingBottom: 40 }}>
          {header}
          <div className="dlv-hero">
            <h1 className="dlv-title">{state === "signin" ? "Sign in to see this delivery" : "We couldn't find that delivery"}</h1>
            <p className="dlv-sub">
              {state === "signin"
                ? "Tracking is linked to your Zola account. Sign in to Zola, then open the tracking link again."
                : "Check the link, or open the order from your Zola account and choose Track delivery."}
            </p>
            <div style={{ marginTop: 22 }}>
              <Link href={state === "signin" ? "/auth/login" : "/dashboard"} className="btn btn-light">
                {state === "signin" ? "Sign in to Zola" : "Go to Zola"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isBuyer  = me?.id === trade.buyer_id;
  const isSeller = me?.id === trade.vendor_id;
  const seller   = trade.vendor_name || "The seller";
  const buyer    = trade.buyer_name || "the buyer";
  const onHold   = trade.status === "disputed";
  const cancelled = trade.status === "cancelled";
  const stage: Stage = STAGE[trade.status] ?? (onHold ? 1 : 0);
  const toWhom   = isBuyer ? "you" : buyer;

  let title = "Waiting for payment";
  let sub   = "Tracking starts as soon as this order has been paid for on Zola.";
  if (cancelled)        { title = "This order was cancelled"; sub = "There is nothing to deliver for this order."; }
  else if (onHold)      { title = "Delivery on hold"; sub = "A dispute was opened on Zola. Delivery is paused while it is reviewed."; }
  else if (stage === 1) { title = "Getting your order ready"; sub = `${seller} is preparing the order. We'll show it here as soon as it has been picked up.`; }
  else if (stage === 2) { title = `On the way to ${toWhom}`; sub = `${seller} has handed the order over for delivery.`; }
  else if (stage === 4) { title = "Delivered"; sub = `The order was delivered and ${isBuyer ? "you confirmed it" : `${buyer} confirmed it`} on Zola.`; }
  if (isSeller && stage === 1) { title = "Waiting for pickup"; sub = "Have the order packed and ready. Mark it as shipped on Zola once it has been handed over."; }

  const stops = [
    { title: "Order confirmed",          text: "Payment is held safely by Zola.",                      time: eventTime(events, "payment confirmed") },
    { title: "Picked up from the seller", text: seller,                                                 time: eventTime(events, "order shipped", "item shipped") },
    { title: `On the way to ${toWhom}`,   text: trade.tracking_number ? `Reference ${trade.tracking_number}` : "", time: "" },
    { title: "Delivered",                 text: stage === 4 ? "Delivery confirmed on Zola." : "",        time: eventTime(events, "delivery confirmed") },
  ];
  // "Shipped" covers both pickup and being on the way
  const doneCount = stage === 2 ? 2 : stage;
  const nowIndex  = cancelled || onHold ? -1 : stage === 4 ? -1 : doneCount;

  const deliveryFee = Number(trade.delivery_fee) || 0;

  // Services and older transactions have no delivery to follow
  if (deliveryFee <= 0) {
    return (
      <div className="dlv">
        <div className="dlv-band" style={{ paddingBottom: 40 }}>
          {header}
          <div className="dlv-hero">
            <h1 className="dlv-title">Nothing to deliver for this order</h1>
            <p className="dlv-sub">This transaction was set up without delivery, so there is nothing to track here. Everything else is on Zola.</p>
            <div style={{ marginTop: 22 }}>
              <Link href={`/trade/${trade.id}`} className="btn btn-light">Back to the transaction on Zola</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dlv">
      <div className="dlv-band">
        {header}
        <div className="dlv-hero">
          <p className="dlv-ref">Tracking number <strong>{trackingNumber(trade.id)}</strong></p>
          <h1 className="dlv-title">{title}</h1>
          <p className="dlv-sub">{sub}</p>
          <div className="dlv-meter" role="img" aria-label={`Step ${Math.min(doneCount + 1, 4)} of 4`}>
            {stops.map((s, i) => (
              <span key={s.title} className={i < doneCount ? "is-done" : i === nowIndex ? "is-now" : ""} />
            ))}
          </div>
        </div>
      </div>

      <main className="dlv-main">
        <div className="dlv-col">
          <section className="card card-pad" aria-labelledby="route-title">
            <h2 id="route-title" className="section-title" style={{ marginBottom: 18 }}>Delivery progress</h2>
            <ol className="dlv-route">
              {stops.map((s, i) => {
                const done = i < doneCount;
                const now  = i === nowIndex;
                return (
                  <li key={s.title} className={`dlv-stop${done ? " is-done" : now ? " is-now" : ""}`} aria-current={now ? "step" : undefined}>
                    <span className="dlv-mark">{done && <Check size={14} strokeWidth={3} />}</span>
                    <div>
                      <p className="dlv-stop-title">{s.title}</p>
                      {(done || now) && s.text && <p className="dlv-stop-text">{s.text}</p>}
                      {done && s.time && <time className="dlv-stop-time" suppressHydrationWarning>{s.time}</time>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="card card-pad" aria-labelledby="courier-title">
            <h2 id="courier-title" className="section-title" style={{ marginBottom: 6 }}>Your courier</h2>
            <p style={{ fontSize: 14.5 }}>
              Not assigned yet. The courier&apos;s name and phone number will show here once the order has been picked up.
            </p>
          </section>
        </div>

        <div className="dlv-col">
          <section className="card card-pad" aria-labelledby="fee-title">
            <div className="dlv-fee">
              <h2 id="fee-title" className="section-title">Delivery fee</h2>
              <strong>{money(deliveryFee)}</strong>
            </div>
            <p className="hint" style={{ marginTop: 2 }}>
              {stage >= 1 ? "Paid with the order through Zola." : "Paid with the order through Zola, when the buyer pays."}
            </p>
            <p className="dlv-note">
              <strong>If your item costs more than {money(DELIVERY_FEE)} to deliver, you will have to pay more.</strong>{" "}
              The {money(DELIVERY_FEE)} covers a standard delivery. Large or heavy items, or addresses outside the
              standard area, cost extra, and you pay the difference to {DELIVERY_COMPANY}.
            </p>
          </section>

          <section className="card card-pad" aria-labelledby="parcel-title">
            <h2 id="parcel-title" className="section-title" style={{ marginBottom: 8 }}>The order</h2>
            <p style={{ fontSize: 15.5, fontWeight: 600, color: "var(--navy)", overflowWrap: "anywhere" }}>{trade.title}</p>
            <div style={{ marginTop: 8 }}>
              <div className="kv"><span>From</span><span>{trade.vendor_name || "—"}</span></div>
              <div className="kv"><span>To</span><span>{trade.buyer_name || "—"}</span></div>
              {trade.delivery_deadline && (
                <div className="kv"><span>Deliver by</span><span suppressHydrationWarning>{fmtDate(trade.delivery_deadline)}</span></div>
              )}
            </div>
          </section>

          <div className="dlv-col" style={{ gap: 10 }}>
            {isBuyer && trade.status === "shipped" && (
              <Link href={`/trade/${trade.id}`} className="btn dlv-btn btn-block">Order arrived? Confirm it on Zola</Link>
            )}
            <Link href={`/trade/${trade.id}`} className="btn btn-secondary btn-block">
              <ArrowLeft size={16} /> Back to the transaction on Zola
            </Link>
          </div>
        </div>
      </main>

      <p className="dlv-foot">{DELIVERY_COMPANY} delivers orders that were paid for through Zola. Payment stays with Zola until delivery is confirmed.</p>
    </div>
  );
}
