/** Pickup's mark: a location pin carrying a parcel (same as the app icon). */
export function PickupMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#F08A24" />
      <path d="M16 5.6c-4.4 0-8 3.4-8 7.7 0 5.6 8 12.9 8 12.9s8-7.3 8-12.9c0-4.3-3.6-7.7-8-7.7z" fill="#fff" />
      <rect x="12.7" y="10.2" width="6.6" height="6" rx="0.9" fill="#F08A24" />
      <path d="M16 10.2v2.3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
