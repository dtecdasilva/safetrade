/**
 * Shared rules for account details: how phone numbers are stored, and the
 * checks that keep one phone number (and one email) to one account.
 */

/** Phone numbers are stored as local digits: no spaces, no +237, no leading 0. */
export function cleanPhone(raw: unknown): string {
  return String(raw || "").replace(/\D/g, "").replace(/^237/, "").replace(/^0/, "");
}

export function cleanEmail(raw: unknown): string {
  return String(raw || "").trim().toLowerCase();
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function initialsOf(name: string): string {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export const PHONE_TAKEN = "That phone number is already used by another Zola account. Each account needs its own number.";
export const EMAIL_TAKEN = "An account with this email already exists";

/**
 * True if another account (buyer, seller or admin) already has this phone
 * number. Pass `exceptUserId` when someone is editing their own profile.
 */
export async function phoneInUse(db: any, phone: string, exceptUserId?: string): Promise<boolean> {
  if (!phone) return false;
  const snap = await db.collection("users").where("phone", "==", phone).limit(2).get();
  return snap.docs.some((d: any) => (d.data().id || d.id) !== exceptUserId);
}

export async function emailInUse(db: any, email: string, exceptUserId?: string): Promise<boolean> {
  if (!email) return false;
  const snap = await db.collection("users").where("email", "==", email).limit(2).get();
  return snap.docs.some((d: any) => (d.data().id || d.id) !== exceptUserId);
}
