"use client";
import { useState } from "react";
import { ArrowLeftRight, ShoppingBag, Store } from "lucide-react";
import { useT } from "@/components/I18n";

/**
 * One account buys and sells. This switches which side the person is using,
 * which decides what their dashboard, lists and "New transaction" show.
 *
 *   variant="seg"   Buying | Selling, for the dashboard and profile
 *   variant="menu"  one "Switch to ..." item, for the account menu
 *   variant="row"   the same, styled as a link in the phone menu
 */
export default function ModeSwitch({
  role, variant = "seg", otherCount = 0, onDone,
}: { role: string; variant?: "seg" | "menu" | "row"; otherCount?: number; onDone?: () => void }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (role !== "buyer" && role !== "vendor") return null;
  const selling = role === "vendor";

  async function switchTo(mode: "buyer" | "vendor") {
    if (busy || mode === role) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/profile/mode", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "That didn't work. Please try again."); setBusy(false); return; }
      onDone?.();
      // A full reload so every page and the session pick up the new side
      window.location.href = "/dashboard";
    } catch {
      setError("Something went wrong. Check your connection and try again.");
      setBusy(false);
    }
  }

  const badge = otherCount > 0 ? <span className="mode-count" aria-label={t("{n} active", { n: otherCount })}>{otherCount}</span> : null;

  if (variant === "menu" || variant === "row") {
    return (
      <button type="button" role={variant === "menu" ? "menuitem" : undefined} disabled={busy}
        className={variant === "menu" ? "nav-menu-item" : "nav-link mode-row"}
        onClick={() => switchTo(selling ? "buyer" : "vendor")}>
        <ArrowLeftRight size={16} />
        {busy ? t("Switching...") : selling ? t("Switch to buying") : t("Switch to selling")}
      </button>
    );
  }

  return (
    <div>
      <div className="seg mode-switch" role="group" aria-label={t("Buying or selling")}>
        <button type="button" className="seg-item" aria-pressed={!selling} disabled={busy} onClick={() => switchTo("buyer")}>
          <ShoppingBag size={15} /> {t("Buying")}{selling && badge}
        </button>
        <button type="button" className="seg-item" aria-pressed={selling} disabled={busy} onClick={() => switchTo("vendor")}>
          <Store size={15} /> {t("Selling")}{!selling && badge}
        </button>
      </div>
      {error && <p role="alert" className="hint-error" style={{ marginTop: 6 }}>{t(error)}</p>}
    </div>
  );
}
