"use client";
import { createContext, useCallback, useContext } from "react";

/**
 * Pickup pages live at pickup.zolahq.com/... and also at zolahq.com/pickup/...
 * This gives links the right prefix on either address.
 */
const BaseCtx = createContext("");

export function PickupBase({ base, children }: { base: string; children: React.ReactNode }) {
  return <BaseCtx.Provider value={base}>{children}</BaseCtx.Provider>;
}

export function usePk() {
  const base = useContext(BaseCtx);
  // Stable between renders, so pages can use it in effects without looping
  return useCallback((path: string) => (base ? `${base}${path === "/" ? "" : path}` || "/" : path), [base]);
}
