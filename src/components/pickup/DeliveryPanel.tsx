"use client";
import { useEffect, useState } from "react";
import { Bike, Copy, MapPinned, Send } from "lucide-react";
import { useT, rich } from "@/components/I18n";
import DeliverySpot from "@/components/pickup/DeliverySpot";
import AssignRider from "@/components/pickup/AssignRider";
import { DELIVERY_STATUS, DeliveryStatus, pickupUrl } from "@/lib/pickup/config";
import { prettyPhone } from "@/lib/support";
import { fmtDateTime } from "@/lib/zola";

/**
 * Everything about a Pickup delivery on a Zola transaction page.
 *   seller  who to send the parcel to, then the receipt number
 *   buyer   status, the 4-digit code, where to deliver, the map link
 *   admin   status and moving it to another rider
 */
export default function DeliveryPanel({ trade, delivery, viewer, onChange, act, acting }: {
  trade: any; delivery: any; viewer: "buyer" | "seller" | "admin";
  onChange: () => void;
  act?: (action: string, extra?: Record<string, any>) => Promise<boolean>;
  acting?: boolean;
}) {
  const { t, lang } = useT();
  const [receipt, setReceipt] = useState("");
  const [copied, setCopied] = useState(false);
  const [editSpot, setEditSpot] = useState(false);
  const branch = delivery?.branch || trade.dest_branch || null;
  const origin = delivery?.origin || trade.origin || (branch ? { label: `${branch.agency}, ${branch.name}`, city: branch.city } : null);
  const sameCity = (delivery?.mode || trade.delivery_mode) === "same_city";
  const fromText = sameCity ? (viewer === "buyer" ? t("The seller, in {city}", { city: origin?.city || "" }) : `${origin?.label} (${origin?.city})`) : branch ? `${branch.agency}, ${branch.name} (${branch.city})` : "";
  const status: DeliveryStatus = delivery?.status || "waiting_rider";
  const label = t((DELIVERY_STATUS[status] || DELIVERY_STATUS.waiting_rider).label);
  const track = delivery?.track_code ? `${pickupUrl()}/track/${delivery.track_code}` : "";

  /* ── Seller: who to send it to ─────────────────────────────────────────── */
  if (viewer === "seller") {
    if (trade.status !== "funds_held") return null;
    if (status === "waiting_rider" || !delivery) {
      return (
        <section className="card card-pad card-mint tx-action fade-up" aria-labelledby="send-title">
          <h2 id="send-title" className="section-title">{t("Payment has been secured")}</h2>
          <p style={{ fontSize: 14.5, margin: "2px 0 0", color: "var(--emerald-press)" }}>
            {sameCity
              ? t("We're finding a free Zola rider near your pickup spot. Their name and number will appear here, and we'll notify you.")
              : t("We're finding a free Zola rider near {branch}. Their name and number will appear here, and we'll notify you. Don't send the parcel until then.", { branch: `${branch.agency}, ${branch.name}` })}
          </p>
        </section>
      );
    }
    if (sameCity) {
      return (
        <section className="card card-pad card-mint tx-action fade-up" aria-labelledby="send-title">
          <h2 id="send-title" className="section-title">{t("Your Zola rider is coming")}</h2>
          <p style={{ fontSize: 14.5, margin: "2px 0 14px", color: "var(--emerald-press)" }}>
            {t("The buyer has paid. Have the parcel packed and ready at your pickup spot: {spot}. Hand it over only to this rider.", { spot: origin?.label || "" })}
          </p>
          <div className="pk-recipient">
            <div><p className="label">{t("Rider")}</p><p className="pk-big">{delivery.rider_name}</p></div>
            <div><p className="label">{t("Rider's phone")}</p><p className="pk-big num">{prettyPhone(delivery.rider_phone)}</p></div>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>{t("The rider checks it against the description, takes it, and you'll see it move to Shipped.")}</p>
        </section>
      );
    }
    return (
      <section className="card card-pad card-mint tx-action fade-up" aria-labelledby="send-title">
        <h2 id="send-title" className="section-title">{t("Send the parcel to your Zola rider")}</h2>
        <p style={{ fontSize: 14.5, margin: "2px 0 14px", color: "var(--emerald-press)" }}>
          {rich(t("The buyer has paid. Send it through <b>{agency}</b> to the <b>{branch}</b> branch in {city}, with this recipient:", { agency: branch.agency, branch: branch.name, city: branch.city }), { b: (c) => <strong>{c}</strong> })}
        </p>
        <div className="pk-recipient">
          <div><p className="label">{t("Recipient's name")}</p><p className="pk-big">{delivery.rider_name}</p></div>
          <div><p className="label">{t("Recipient's phone")}</p><p className="pk-big num">{prettyPhone(delivery.rider_phone)}</p></div>
        </div>
        <p className="hint" style={{ margin: "10px 0 14px" }}>{t("Don't write the buyer's name. Zola's rider collects it at the agency, checks it and brings it to the buyer.")}</p>
        <div className="field" style={{ marginBottom: 12 }}>
          <label className="label" htmlFor="receipt">{t("Agency receipt number")}</label>
          <input id="receipt" className="input num" maxLength={60} value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder={t("On the receipt the agency gives you")} />
        </div>
        <button className="btn btn-primary" disabled={acting || receipt.trim().length < 3} onClick={() => act?.("ship", { trackingNumber: receipt.trim() })}>
          <Send size={16} /> {acting ? t("Marking...") : t("I've sent it")}
        </button>
      </section>
    );
  }

  /* ── Buyer and admin: where the parcel is ──────────────────────────────── */
  const hasPaid = !["awaiting_seller", "pending_payment", "cancelled"].includes(trade.status);
  if (!hasPaid) return null;
  return (
    <section className="card card-pad fade-up" aria-labelledby="delivery-title">
      <div className="card-head" style={{ marginBottom: 6 }}>
        <h2 id="delivery-title" className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Bike size={17} /> {t("Delivery by Pickup")}</h2>
        <span className="pk-tag" style={{ marginBottom: 0 }}>{label}</span>
      </div>
      <div className="kv"><span>{sameCity ? t("Collected from") : t("Agency branch")}</span><span style={{ textAlign: "right" }}>{fromText}</span></div>
      {delivery?.rider_name && <div className="kv"><span>{t("Rider")}</span><span>{delivery.rider_name}{delivery.rider_phone ? `, ${prettyPhone(delivery.rider_phone)}` : ""}</span></div>}
      {delivery?.receipt_no && <div className="kv"><span>{t("Agency receipt")}</span><span className="num">{delivery.receipt_no}</span></div>}
      {delivery?.delivered_at && <div className="kv"><span>{t("Delivered")}</span><span suppressHydrationWarning>{fmtDateTime(delivery.delivered_at, lang)}</span></div>}

      {viewer === "buyer" && delivery && status !== "delivered" && (
        <>
          <div className="pk-code">
            <p className="label">{t("Your delivery code")}</p>
            <p className="pk-code-num num">{delivery.handover_code}</p>
            <p className="hint">{t("Give it to the rider only once you have checked your parcel. Never share it before.")}</p>
          </div>
          {track && (
            <div className="btn-row" style={{ marginTop: 12 }}>
              <a className="btn btn-primary" href={track} target="_blank" rel="noopener noreferrer"><MapPinned size={16} /> {t("Follow it on the map")}</a>
              <button className="btn btn-secondary" onClick={async () => { try { await navigator.clipboard.writeText(track); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }}>
                <Copy size={15} /> {copied ? t("Link copied") : t("Copy link")}
              </button>
            </div>
          )}
          <hr className="divider" />
          <p className="label" style={{ marginBottom: 4 }}>{t("Where should the rider bring it?")}</p>
          {delivery.dest && !editSpot ? (
            <p className="hint">{delivery.dest.landmark}</p>
          ) : (
            <DeliverySpot tradeId={trade.id} initial={delivery.dest} onSaved={() => { setEditSpot(false); onChange(); }} />
          )}
        </>
      )}

      {viewer === "admin" && delivery && (
        <>
          {delivery.track_code && <p className="hint" style={{ marginTop: 6 }}>Tracking: <a href={track} target="_blank" rel="noopener noreferrer">{delivery.track_code}</a></p>}
          {delivery.over_limit && delivery.rider_id && <p className="notice notice-wait" style={{ marginTop: 8 }}>Assigned over {delivery.rider_name}&apos;s limit: their balance doesn&apos;t cover this parcel&apos;s value.</p>}
          <AssignRider id={trade.id} status={status} riderName={delivery.rider_name} onDone={onChange} />
        </>
      )}
    </section>
  );
}
