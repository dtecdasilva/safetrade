/** Pickup's mark: a parcel with a location pin. */
export function PickupMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="8" fill="#F08A24" />
      <path d="M16 7c-3.9 0-7 3-7 6.8 0 4.9 7 11.2 7 11.2s7-6.3 7-11.2C23 10 19.9 7 16 7z" fill="#fff" />
      <circle cx="16" cy="13.8" r="2.6" fill="#F08A24" />
    </svg>
  );
}
