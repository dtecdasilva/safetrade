"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ZolaMark } from "@/components/Logo";

const DISMISS_KEY = "zola-install-dismissed";

/**
 * Makes Zola installable as an app.
 *  - The app manifest (src/app/manifest.ts) is what makes it installable.
 *    There is deliberately no service worker: nothing sits between the
 *    browser and the server.
 *  - On phones, offers to add Zola to the home screen. Android/Chrome gets an
 *    Install button; iPhone Safari gets the two taps to do it by hand, because
 *    iOS has no install prompt. Once dismissed or installed it stays away.
 */
export default function PwaSetup() {
  const [promptEvent, setPromptEvent] = useState<any>(null);
  const [mode, setMode] = useState<"hidden" | "android" | "ios">("hidden");

  useEffect(() => {
    // Zola does not use a service worker. Remove the one an earlier version
    // installed, because it interfered with signing in through Google.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
    }

    const installed =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch {}
    if (installed || dismissed) return;

    const onPrompt = (e: Event) => { e.preventDefault(); setPromptEvent(e); setMode("android"); };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (isIos && isSafari) setMode("ios");

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setMode("hidden");
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
  }

  async function install() {
    if (!promptEvent) return;
    promptEvent.prompt();
    try { await promptEvent.userChoice; } catch {}
    setPromptEvent(null);
    setMode("hidden");
  }

  if (mode === "hidden") return null;

  return (
    <div className="install-bar" role="region" aria-label="Install Zola">
      <span className="install-icon"><ZolaMark size={24} color="#fff" /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p className="install-title">Add Zola to your home screen</p>
        <p className="install-text">
          {mode === "android"
            ? "Open it like an app, with one tap."
            : "Tap the Share button, then “Add to Home Screen”."}
        </p>
      </div>
      {mode === "android" && (
        <button type="button" className="btn btn-primary btn-sm" onClick={install}>Install</button>
      )}
      <button type="button" className="input-affix" style={{ position: "static", transform: "none", flexShrink: 0 }}
        onClick={dismiss} aria-label="Not now">
        <X size={17} />
      </button>
    </div>
  );
}
