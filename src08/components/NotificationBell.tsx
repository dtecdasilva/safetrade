"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";

interface Notice {
  id: string;
  title: string;
  body: string;
  link?: string;
  tone?: string;
  trade_id?: string;
  read: boolean;
  created_at: string;
}

const POLL_MS = 20000;

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * The bell in the top bar. It checks for new notifications every 20 seconds
 * (and whenever the tab regains focus). When something new arrives it shows a
 * small alert, refreshes the page data, and tells open transaction pages to
 * reload so the status on screen is never stale.
 */
export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems]   = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen]     = useState(false);
  const [alert, setAlert]   = useState<Notice | null>(null);
  const known   = useRef<Set<string> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const list: Notice[] = data.notifications || [];
      setItems(list);
      setUnread(data.unread || 0);

      const ids = new Set(list.map((n) => n.id));
      if (known.current) {
        const fresh = list.filter((n) => !n.read && !known.current!.has(n.id));
        if (fresh.length) {
          setAlert(fresh[0]);
          router.refresh();
          window.dispatchEvent(new CustomEvent("zola:notification", { detail: fresh }));
        }
      }
      known.current = ids;
    } catch {
      /* offline or signed out: try again on the next tick */
    }
  }, [router]);

  // Poll while the tab is visible; catch up as soon as it becomes visible again
  useEffect(() => {
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  // The alert dismisses itself
  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 8000);
    return () => clearTimeout(t);
  }, [alert]);

  // Close the panel on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function markRead(id: string) {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
  }

  function markAllRead() {
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    setUnread(0);
    fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).catch(() => {});
  }

  function openNotice(n: Notice) {
    if (!n.read) markRead(n.id);
    setOpen(false);
    setAlert(null);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="bell" ref={wrapRef}>
      <button type="button" className="icon-btn" onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog" aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
        <Bell size={18} />
        {unread > 0 && <span className="bell-count" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <h2 className="section-title">Notifications</h2>
            {unread > 0 && <button type="button" className="link-btn" style={{ fontSize: 13.5 }} onClick={markAllRead}>Mark all as read</button>}
          </div>

          {items.length === 0 ? (
            <div className="bell-empty">
              <p className="empty-title" style={{ fontSize: 15 }}>Nothing yet</p>
              <p className="empty-text" style={{ fontSize: 14 }}>You&apos;ll be told here each time one of your transactions moves.</p>
            </div>
          ) : (
            <ul className="bell-list">
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" className={`bell-item${n.read ? "" : " is-unread"}`} onClick={() => openNotice(n)}>
                    <span className={`bell-dot t-${n.tone || "info"}`} aria-hidden="true" />
                    <span style={{ minWidth: 0 }}>
                      <span className="bell-title">{n.title}</span>
                      <span className="bell-body">{n.body}</span>
                      <span className="bell-time" suppressHydrationWarning>{timeAgo(n.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Alert for something that just happened */}
      {alert && (
        <div className="bell-alert" role="status" aria-live="polite">
          <span className={`bell-dot t-${alert.tone || "info"}`} aria-hidden="true" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="bell-title">{alert.title}</p>
            <p className="bell-body">{alert.body}</p>
            {alert.link && (
              <button type="button" className="link-btn" style={{ fontSize: 13.5, marginTop: 6 }} onClick={() => openNotice(alert)}>
                View
              </button>
            )}
          </div>
          <button type="button" className="input-affix" style={{ position: "static", transform: "none", flexShrink: 0 }}
            onClick={() => setAlert(null)} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
