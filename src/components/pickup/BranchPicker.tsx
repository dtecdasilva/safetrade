"use client";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/components/I18n";

export interface Branch { id: string; agency: string; name: string; city: string; address: string }

/**
 * Where the seller sends the parcel: a city, then a bus agency branch in it.
 * Calls onLoaded(false) when Zola has no branches yet, so the form can fall
 * back to the old hand-over.
 */
export default function BranchPicker({
  value, onChange, onLoaded, idPrefix = "br",
}: { value: string; onChange: (id: string) => void; onLoaded?: (has: boolean) => void; idPrefix?: string }) {
  const { t } = useT();
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [city, setCity] = useState("");

  useEffect(() => {
    fetch("/api/branches").then((r) => r.json()).then((d) => {
      const list: Branch[] = d.branches || [];
      setBranches(list);
      onLoaded?.(list.length > 0);
    }).catch(() => { setBranches([]); onLoaded?.(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cities = useMemo(() => Array.from(new Set((branches || []).map((b) => b.city))), [branches]);
  useEffect(() => {
    if (value && branches) { const b = branches.find((x) => x.id === value); if (b) setCity(b.city); }
  }, [value, branches]);
  const inCity = (branches || []).filter((b) => b.city === city);

  if (!branches || branches.length === 0) return null;
  return (
    <div className="form-grid-2">
      <div className="field">
        <label className="label" htmlFor={`${idPrefix}-city`}>{t("Buyer's city")}</label>
        <select id={`${idPrefix}-city`} className="select" value={city} onChange={(e) => { setCity(e.target.value); onChange(""); }}>
          <option value="">{t("Choose a city")}</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="field">
        <label className="label" htmlFor={`${idPrefix}-branch`}>{t("Agency branch")}</label>
        <select id={`${idPrefix}-branch`} className="select" value={value} disabled={!city} onChange={(e) => onChange(e.target.value)}>
          <option value="">{city ? t("Choose a branch") : t("Choose the city first")}</option>
          {inCity.map((b) => <option key={b.id} value={b.id}>{b.agency}, {b.name}</option>)}
        </select>
      </div>
    </div>
  );
}
