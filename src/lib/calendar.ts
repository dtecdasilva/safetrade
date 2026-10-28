/**
 * Calendar invites (.ics) and "Add to Google Calendar" links, used to remind
 * the admin when a transaction's 24-hour review ends and the seller can be paid.
 * No server-only code: screens and API routes share it.
 */
export interface CalEvent {
  uid: string;
  title: string;
  description: string;
  start: string;          // ISO
  minutes?: number;       // length, default 30
  url?: string;
}

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// Fold and escape text the way calendar apps expect
const esc = (s: string) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line: string) => {
  const out: string[] = [];
  let s = line;
  while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); }
  out.push(s);
  return out.join("\r\n");
};

function vevent(e: CalEvent): string[] {
  const end = new Date(Date.parse(e.start) + (e.minutes || 30) * 60000).toISOString();
  return [
    "BEGIN:VEVENT",
    `UID:${e.uid}@zolahq.com`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.description + (e.url ? `\n\n${e.url}` : ""))}`,
    ...(e.url ? [`URL:${e.url}`] : []),
    // The reminder: a pop-up when the 24 hours are over
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, "TRIGGER:PT0M", "END:VALARM",
    "END:VEVENT",
  ];
}

export function buildIcs(events: CalEvent[], name = "Zola"): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Zola//Reviews//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`, "X-PUBLISHED-TTL:PT1H", "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    ...events.flatMap(vevent),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: CalEvent): string {
  const end = new Date(Date.parse(e.start) + (e.minutes || 30) * 60000).toISOString();
  const p = new URLSearchParams({
    action: "TEMPLATE", text: e.title, dates: `${stamp(e.start)}/${stamp(end)}`,
    details: e.description + (e.url ? `\n\n${e.url}` : ""),
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** The "time to pay the seller" event for a transaction under review. */
export function payoutEvent(t: { id: string; title?: string; amount?: number; vendor_name?: string; buyer_name?: string }, endsAt: string, siteUrl: string): CalEvent {
  const amount = `FCFA ${(Number(t.amount) || 0).toLocaleString("en-US")}`;
  return {
    uid: `review-${t.id}`,
    title: `Time to pay the vendor: ${t.vendor_name || "seller"} (${amount})`,
    description: `The 24-hour review of “${t.title || "the item"}” is over. Check there's no complaint from ${t.buyer_name || "the buyer"} and that you called or texted them, then release ${amount} to ${t.vendor_name || "the seller"}.`,
    start: endsAt,
    url: `${siteUrl}/trade/${t.id}`,
  };
}
