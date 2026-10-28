"use client";
import { useEffect, useState } from "react";
import { CalendarPlus, Copy, RefreshCw } from "lucide-react";
import { googleCalendarUrl, payoutEvent } from "@/lib/calendar";

/**
 * Admin: put "Time to pay the vendor" in your calendar for when this
 * transaction's 24-hour review ends. Google Calendar link, or an .ics invite
 * for any other calendar (iPhone, Outlook, Samsung...).
 */
export function CalendarRemind({ trade, endsAt, compact }: { trade: any; endsAt: string; compact?: boolean }) {
  if (!endsAt) return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.zolahq.com";
  const google = googleCalendarUrl(payoutEvent(trade, endsAt, origin));
  const ics = `/api/admin/trades/${trade.id}/calendar`;
  if (compact) {
    return (
      <span style={{ display: "inline-flex", gap: 4 }}>
        <a className="btn btn-ghost btn-sm" href={google} target="_blank" rel="noopener noreferrer" title="Add “Time to pay the vendor” to Google Calendar"><CalendarPlus size={14} /> Google</a>
        <a className="btn btn-ghost btn-sm" href={ics} title="Download a calendar invite (iPhone, Outlook, any calendar)">.ics</a>
      </span>
    );
  }
  return (
    <div className="btn-row" style={{ margin: "0 0 14px" }}>
      <a className="btn btn-secondary btn-sm" href={google} target="_blank" rel="noopener noreferrer"><CalendarPlus size={15} /> Remind me in Google Calendar</a>
      <a className="btn btn-ghost btn-sm" href={ics}>Other calendar (.ics)</a>
    </div>
  );
}

/** Admin: one private calendar link that lists every review as it starts, with a reminder when its 24 hours are over. */
export function CalendarFeed() {
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (open && !url) fetch("/api/admin/calendar-feed").then((r) => r.json()).then((d) => setUrl(d.url || "")).catch(() => {}); }, [open, url]);
  const webcal = url.replace(/^https?:/, "webcal:");
  return (
    <div className="card card-pad" style={{ marginBottom: 12 }}>
      <div className="kv" style={{ alignItems: "center", padding: 0 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--navy)", fontWeight: 600 }}><CalendarPlus size={17} /> Payment reminders in your calendar</span>
        <button className="btn btn-secondary btn-sm" onClick={() => setOpen(!open)}>{open ? "Close" : "Set up"}</button>
      </div>
      {open && (
        <div className="stack" style={{ gap: 10, marginTop: 10 }}>
          <p className="hint">Subscribe once and every transaction under review shows up in your calendar as <strong>“Time to pay the vendor”</strong> at the moment its 24 hours end, with a reminder. Released ones drop off by themselves. Calendars refresh a subscription every few hours, so for one you need right away use the Google button on that transaction.</p>
          {url ? (
            <>
              <div className="btn-row">
                <a className="btn btn-primary btn-sm" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>
                <a className="btn btn-secondary btn-sm" href={webcal}>iPhone / Outlook</a>
                <button className="btn btn-ghost btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }}><Copy size={14} /> {copied ? "Copied" : "Copy link"}</button>
              </div>
              <p className="hint">This link is private: anyone with it can see who is waiting to be paid. If it leaks, <button className="link-btn" onClick={async () => { if (!confirm("Make a new link? The old one stops working, so you'll need to subscribe again.")) return; const d = await fetch("/api/admin/calendar-feed", { method: "POST" }).then((r) => r.json()); setUrl(d.url || ""); }}><RefreshCw size={12} /> make a new one</button>.</p>
            </>
          ) : <span className="spinner" />}
        </div>
      )}
    </div>
  );
}
