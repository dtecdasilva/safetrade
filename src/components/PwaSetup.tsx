"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ZolaMark } from "@/components/Logo";
import { PickupMark } from "@/components/pickup/Mark";
import { useT } from "@/components/I18n";


/**
 * Makes Zola installable as an app.
 *  - The app manifest (src/app/manifest.ts) is what makes it installable.
 *  - Registers a small service worker (live site only) whose one job is to
 *    show the "You're offline" page. It leaves /api/ addresses alone.
 *  - On phones, offers to add Zola to the home screen. Android/Chrome gets an
 *    Install button; iPhone Safari gets the two taps to do it by hand, because
 *    iOS has no install prompt. Once dismissed or installed it stays away.
 */
export default function PwaSetup({ site = "zola" }: { site?: "zola" | "pickup" }) {
  const { t } = useT();
  const pickup = site === "pickup";
  // Each app has its own service worker and its own "not now"
  const DISMISS_KEY = pickup ? "pickup-install-dismissed" : "zola-install-dismissed";
  const [promptEvent, setPromptEvent] = useState<any>(null);
  const [mode, setMode] = useState<"hidden" | "android" | "ios">("hidden");

  useEffect(() => {
    // The service worker only provides the "You're offline" page (see public/sw.js).
    // Live site only, so it never gets in the way while developing.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register(pickup ? "/pickup-sw.js" : "/sw.js").catch(() => {});
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="install-bar" role="region" aria-label={pickup ? t("Install Pickup") : t("Install Zola")}>
      {pickup
        ? <span className="install-icon" style={{ background: "none" }}><PickupMark size={44} /></span>
        : <span className="install-icon"><ZolaMark size={24} color="#fff" /></span>}
      <div style={{ minWidth: 0, flex: 1 }}>
        <p className="install-title">{pickup ? t("Add Pickup to your home screen") : t("Add Zola to your home screen")}</p>
        <p className="install-text">
          {mode === "android"
            ? t("Open it like an app, with one tap.")
            : t("Tap the Share button, then “Add to Home Screen”.")}
        </p>
      </div>
      {mode === "android" && (
        <button type="button" className="btn btn-primary btn-sm" onClick={install} style={pickup ? { background: "#B85A08", borderColor: "#B85A08" } : undefined}>{t("Install")}</button>
      )}
      <button type="button" className="input-affix" style={{ position: "static", transform: "none", flexShrink: 0 }}
        onClick={dismiss} aria-label={t("Not now")}>
        <X size={17} />
      </button>
    </div>
  );
}
