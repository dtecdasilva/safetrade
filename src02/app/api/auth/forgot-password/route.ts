import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";

// In-memory store for reset tokens (use Firestore in production for persistence)
// We'll use Firestore to store tokens
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone) return NextResponse.json({ error: "Phone number is required" }, { status: 400 });

    const cleanPhone = phone.replace(/\D/g, "").replace(/^237/, "");

    const db = getDb();
    const snap = await db.collection("users").where("phone", "==", cleanPhone).limit(1).get();

    // Always return success to prevent phone enumeration
    if (snap.empty) return NextResponse.json({ success: true });

    const user = snap.docs[0].data();
    const token = randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Store token in Firestore
    await db.collection("password_resets").doc(token).set({
      token,
      user_id: user.id,
      phone: cleanPhone,
      expires,
      used: false,
      created_at: new Date().toISOString(),
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://safetrade-ruddy.vercel.app";
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;

    // Send WhatsApp message
    const WHATSAPP_TOKEN    = process.env.WHATSAPP_TOKEN!;
    const PHONE_NUMBER_ID   = process.env.WHATSAPP_PHONE_NUMBER_ID!;

    const res = await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: `237${cleanPhone}`,
        type: "template",
        template: {
          name: "password_reset",
          language: { code: "en" },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: user.name },
              { type: "text", text: resetUrl },
            ],
          }],
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("[forgot-password] WhatsApp error:", JSON.stringify(err));
    } else {
      console.log(`[forgot-password] Reset link sent to +237${cleanPhone}`);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[forgot-password] error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
