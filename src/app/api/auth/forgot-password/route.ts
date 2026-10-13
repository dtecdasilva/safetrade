import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { sendEmail, emailLayout } from "@/lib/mail";
import { cleanEmail, cleanPhone } from "@/lib/users";

/**
 * Start a password reset.
 *
 * The person enters their email or their WhatsApp number. Either way, the
 * reset link is sent to the EMAIL address on the account. (WhatsApp does not
 * allow reset links in business messages, so email is the channel for this.)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // "identifier" is the new field; "phone" and "email" are accepted for older clients
    const raw = String(body.identifier ?? body.email ?? body.phone ?? "").trim();
    if (!raw) return NextResponse.json({ error: "Enter your email or WhatsApp number" }, { status: 400 });

    const db = getDb();
    const byEmail = raw.includes("@");
    const snap = byEmail
      ? await db.collection("users").where("email", "==", cleanEmail(raw)).limit(1).get()
      : await db.collection("users").where("phone", "==", cleanPhone(raw)).limit(1).get();

    // Always answer the same way, so nobody can use this to find out who has an account
    if (snap.empty) return NextResponse.json({ success: true });

    const user = snap.docs[0].data();
    const token = randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await db.collection("password_resets").doc(token).set({
      token,
      user_id: user.id,
      email: user.email || "",
      phone: user.phone || "",
      expires,
      used: false,
      created_at: new Date().toISOString(),
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://safetrade-ruddy.vercel.app";
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;

    const fr = user.lang === "fr";
    const result = await sendEmail(fr ? {
      to: user.email,
      subject: "Réinitialiser votre mot de passe Zola",
      text: `Bonjour ${user.name},\n\nUtilisez ce lien pour choisir un nouveau mot de passe pour votre compte Zola :\n${resetUrl}\n\nLe lien ne fonctionne qu'une fois et expire dans 1 heure. Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe ne change pas.\n\nZola\nTransactions sécurisées. Paiements simples.`,
      html: emailLayout({
        lang: "fr",
        heading: "Réinitialiser votre mot de passe",
        intro: `Bonjour ${user.name}, utilisez le bouton ci-dessous pour choisir un nouveau mot de passe pour votre compte Zola.`,
        cta: { label: "Choisir un nouveau mot de passe", url: resetUrl },
        note: "Le lien ne fonctionne qu'une fois et expire dans 1 heure. Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe ne change pas.",
      }),
    } : {
      to: user.email,
      subject: "Reset your Zola password",
      text: `Hi ${user.name},\n\nUse this link to choose a new password for your Zola account:\n${resetUrl}\n\nThe link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email and your password stays the same.\n\nZola\nSecure transactions. Simple payments.`,
      html: emailLayout({
        heading: "Reset your password",
        intro: `Hi ${user.name}, use the button below to choose a new password for your Zola account.`,
        cta: { label: "Choose a new password", url: resetUrl },
        note: "The link works once and expires in 1 hour. If you didn't ask for this, ignore this email and your password stays the same.",
      }),
    });

    if (!result.success) console.error("[forgot-password] email could not be sent:", result.error);
    else console.log("[forgot-password] reset link emailed to", user.email);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[forgot-password] error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
