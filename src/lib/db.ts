import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

let _db: Firestore | null = null;
let _initialized = false; // in-memory flag — survives for the lifetime of the server process

export function getDb(): Firestore {
  if (!_db) {
    let app: App;
    if (!getApps().length) {
      app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
    } else {
      app = getApps()[0];
    }
    _db = getFirestore(app);
  }
  return _db;
}

/**
 * Seeds the admin user once per server process.
 * The in-memory flag means Firestore is only queried on the very first
 * request after a cold start — not on every subsequent request.
 */
export async function initDb(): Promise<void> {
  if (_initialized) return; // ← skip entirely after first run
  _initialized = true;      // ← set immediately to prevent concurrent calls racing

  try {
    const db = getDb();
    const snap = await db
      .collection("users")
      .where("email", "==", "admin@safetrade.com")
      .limit(1)
      .get();

    if (snap.empty) {
      const hash = await bcrypt.hash("admin123", 10);
      const id = randomUUID();
      await db.collection("users").doc(id).set({
        id,
        email: "admin@safetrade.com",
        name: "SafeTrade Admin",
        password: hash,
        role: "admin",
        avatar: "SA",
        rating: 5.0,
        trade_count: 0,
        created_at: new Date().toISOString(),
      });
      console.log("[initDb] admin user seeded");
    }
  } catch (e: any) {
    // Reset flag so it retries on next request if seeding failed
    _initialized = false;
    console.error("[initDb] failed:", e.message);
  }
}
