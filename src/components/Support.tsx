import React from "react";
import { MessageCircle, Phone, MessageSquare } from "lucide-react";
import { SUPPORT, contactLinks } from "@/lib/support";

/** Two buttons: chat with customer service on WhatsApp, or call. */
export function SupportButtons({ small = false }: { small?: boolean }) {
  const size = small ? " btn-sm" : "";
  return (
    <div className="btn-row">
      <a href={SUPPORT.whatsappUrl} target="_blank" rel="noopener noreferrer" className={`btn btn-secondary${size}`}>
        <MessageCircle size={small ? 15 : 17} /> WhatsApp {SUPPORT.whatsapp}
      </a>
      <a href={SUPPORT.phoneUrl} className={`btn btn-secondary${size}`}>
        <Phone size={small ? 15 : 17} /> Call {SUPPORT.phone}
      </a>
    </div>
  );
}

/** A quiet "Need help?" line for the bottom of a screen. */
export function SupportLine({ lead = "Need help?" }: { lead?: string }) {
  return (
    <p className="support-line">
      {lead}{" "}
      <a href={SUPPORT.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp <span className="num">{SUPPORT.whatsapp}</span></a>
      {" "}or{" "}
      <a href={SUPPORT.phoneUrl}>call <span className="num">{SUPPORT.phone}</span></a>.
    </p>
  );
}

/** Customer service block for the Help page. */
export function SupportCard() {
  return (
    <section className="card card-pad support-card" aria-labelledby="support-title">
      <div>
        <h2 id="support-title" className="section-title">Customer service</h2>
        <p className="hint" style={{ fontSize: 14.5, marginTop: 4, maxWidth: "46ch" }}>
          Stuck on a payment, a delivery or your account? Message us on WhatsApp or give us a call.
          Have your transaction ID ready if it&apos;s about a transaction.
        </p>
      </div>
      <SupportButtons />
    </section>
  );
}

/**
 * Call / WhatsApp / SMS links to one person. Used by admins, who have to
 * call or text the buyer while a transaction is under review.
 */
export function ContactRow({ role, name, phone, email }: { role: string; name?: string; phone?: string; email?: string }) {
  const links = contactLinks(phone);
  return (
    <div className="contact">
      <div style={{ minWidth: 0 }}>
        <p className="party-role">{role}</p>
        <p className="party-name">{name || "—"}</p>
        <p className="contact-phone num">{links ? links.display : "No phone number on this account"}</p>
        {email && <p className="hint" style={{ overflowWrap: "anywhere" }}>{email}</p>}
      </div>
      {links && (
        <div className="contact-actions">
          <a href={links.call} className="btn btn-secondary btn-sm"><Phone size={14} /> Call</a>
          <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><MessageCircle size={14} /> WhatsApp</a>
          <a href={links.sms} className="btn btn-secondary btn-sm"><MessageSquare size={14} /> SMS</a>
        </div>
      )}
    </div>
  );
}
