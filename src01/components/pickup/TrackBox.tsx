"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePk } from "@/components/pickup/Base";
import { useT } from "@/components/I18n";

export default function TrackBox() {
  const { t } = useT();
  const pk = usePk();
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (
    <form className="pk-row" onSubmit={(e) => { e.preventDefault(); if (clean.length >= 6) router.push(pk(`/track/${clean}`)); }}>
      <input className="input num" aria-label={t("Tracking code")} placeholder="ABCD2345EF" value={code} maxLength={20}
        onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" />
      <button className="btn btn-primary" disabled={clean.length < 6}>{t("Track")}</button>
    </form>
  );
}
