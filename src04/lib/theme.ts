/**
 * Light / dark theme.
 *
 * DEFAULT_THEME decides what a first-time visitor sees:
 *   "system" follows the device setting, "dark" or "light" forces one.
 * Once someone uses the switch, their choice is remembered on that device.
 */
export type ThemeChoice = "light" | "dark" | "system";

export const DEFAULT_THEME: ThemeChoice = "system";
export const THEME_KEY = "zola-theme";

/**
 * Runs in <head> before the page paints, so the right theme is applied
 * immediately and there is no flash of the wrong one.
 */
export const themeInitScript = `(function(){try{var c=localStorage.getItem('${THEME_KEY}')||'${DEFAULT_THEME}';var d=c==='dark'||(c==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','${DEFAULT_THEME}'==='dark'?'dark':'light');}})();`;
