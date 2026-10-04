"use client";
import React, { useEffect, useRef, useState } from "react";

/** A prepared link is reused for this long before a fresh one is fetched. */
const FRESH_MS = 20 * 60 * 1000;

/**
 * "Continue with Google".
 *
 * The button links DIRECTLY to Google's sign-in address rather than to a Zola
 * address that redirects there. That matters for the installed app on iPhone:
 * Google blocks sign-in inside the app's own browser view, and only a direct
 * link to Google makes the iPhone open it in a Safari view that Google accepts.
 *
 * The link is prepared in the background as soon as the button appears. If it
 * isn't ready (or JavaScript is off) the button falls back to the redirecting
 * address, which works in ordinary browsers.
 */
export default function GoogleButton({ role, label = "Continue with Google" }: { role?: string; label?: string }) {
  const fallback = role ? `/api/auth/google?role=${encodeURIComponent(role)}` : "/api/auth/google";
  const [direct, setDirect] = useState<{ url: string; role: string; at: number } | null>(null);
  const queue  = useRef<Promise<void>>(Promise.resolve());
  const wanted = useRef(role || "");

  async function prepare(forRole: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/auth/google?format=json${forRole ? `&role=${encodeURIComponent(forRole)}` : ""}`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data.url === "string" ? data.url : null;
    } catch {
      return null;
    }
  }

  // Prepare the direct link, and again whenever buyer/seller changes. Requests run one
  // after another so the link on the button always matches the latest one prepared.
  useEffect(() => {
    const forRole = role || "";
    wanted.current = forRole;
    queue.current = queue.current.then(async () => {
      if (wanted.current !== forRole) return;       // a newer choice is already queued
      const url = await prepare(forRole);
      if (wanted.current === forRole) setDirect(url ? { url, role: forRole, at: Date.now() } : null);
    });
  }, [role]);

  const ready = direct && direct.role === (role || "") && Date.now() - direct.at < FRESH_MS;

  async function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (ready) return;                 // a plain tap on a direct link to Google
    // Not ready or gone stale: get a fresh link now, then follow it as a link
    e.preventDefault();
    const url = await prepare(role || "");
    const a = document.createElement("a");
    a.href = url || fallback;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <a href={ready ? direct!.url : fallback} onClick={onClick} className="btn btn-google btn-block" rel="noopener">
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
      {label}
    </a>
  );
}
