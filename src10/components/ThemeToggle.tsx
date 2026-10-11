"use client";
import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { DEFAULT_THEME, THEME_KEY } from "@/lib/theme";

/**
 * Switches between the light and dark theme and remembers the choice.
 * Which icon or label shows is handled in CSS from the data-theme attribute,
 * so the button renders the same on the server and in the browser.
 */
export default function ThemeToggle({ variant = "icon", className = "" }: { variant?: "icon" | "text"; className?: string }) {
  // Until someone picks a theme, keep following the device setting if that's the default.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let stored: string | null = null;
      try { stored = localStorage.getItem(THEME_KEY); } catch {}
      if ((stored || DEFAULT_THEME) === "system") {
        document.documentElement.setAttribute("data-theme", media.matches ? "dark" : "light");
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  }

  if (variant === "text") {
    return (
      <button type="button" onClick={toggle} className={`theme-toggle theme-text ${className}`}>
        <Moon size={15} className="theme-icon-moon" />
        <Sun size={15} className="theme-icon-sun" />
        <span className="when-light">Dark theme</span>
        <span className="when-dark">Light theme</span>
      </button>
    );
  }

  return (
    <button type="button" onClick={toggle} className={`icon-btn theme-toggle ${className}`}
      aria-label="Switch between light and dark theme" title="Switch theme">
      <Moon size={18} className="theme-icon-moon" />
      <Sun size={18} className="theme-icon-sun" />
    </button>
  );
}
