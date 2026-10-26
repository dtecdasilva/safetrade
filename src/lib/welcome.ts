/**
 * The email everyone gets right after creating an account (with a password
 * or with Google). It explains how Zola works from both sides, starting with
 * the side they signed up for, and says they can switch at any time.
 *
 * Never throws: an email failing must not stop the signup.
 */
import { sendEmail, emailLayout } from "@/lib/mail";
import { supportLine, siteUrl } from "@/lib/support";
import { DELIVERY_FEE } from "@/lib/fees";

const fcfa = (n: number) => `FCFA ${n.toLocaleString("en-US")}`;

export async function sendWelcomeEmail(user: {
  name: string; email: string; role: string; lang?: string;
}): Promise<boolean> {
  try {
    if (!user.email) return false;
    const fr     = user.lang === "fr";
    const first  = String(user.name || "").trim().split(" ")[0] || "";
    const seller = user.role === "vendor";
    const base   = siteUrl();

    const buying = fr
      ? {
          title: "Quand vous achetez",
          items: [
            "Vous payez Zola, pas le vendeur. Nous gardons votre argent jusqu'à l'arrivée de votre commande.",
            "Un vendeur peut créer la transaction avec votre numéro, ou vous pouvez la lancer vous-même : le vendeur la confirme, puis vous payez.",
            "Après avoir confirmé la livraison, vous avez 24 heures pour nous signaler un problème. Ensuite, le vendeur est payé.",
          ],
        }
      : {
          title: "When you buy",
          items: [
            "You pay Zola, not the seller. We hold your money until your order arrives.",
            "A seller can create the transaction for your number, or you can start one yourself: the seller confirms it, then you pay.",
            "After you confirm delivery, you have 24 hours to tell us if anything is wrong. Then the seller is paid.",
          ],
        };
    const selling = fr
      ? {
          title: "Quand vous vendez",
          items: [
            "Créez une transaction avec le numéro de l'acheteur, ou confirmez celle qu'un acheteur vous envoie.",
            "Nous vous prévenons dès que l'argent de l'acheteur est sécurisé. Seulement alors, remettez l'article à Zola, pas directement à l'acheteur.",
            `Vous recevez la totalité de votre prix : l'acheteur paie les frais Zola et la livraison (${fcfa(DELIVERY_FEE)}).`,
          ],
        }
      : {
          title: "When you sell",
          items: [
            "Create a transaction with the buyer's number, or confirm one a buyer sends you.",
            "We tell you as soon as the buyer's money is held. Only then send the item, to Zola, not straight to the buyer.",
            `You receive your full price: the buyer pays the Zola fee and delivery (${fcfa(DELIVERY_FEE)}).`,
          ],
        };
    const ordered = seller ? [selling, buying] : [buying, selling];

    const heading = fr
      ? (first ? `Bienvenue sur Zola, ${first}` : "Bienvenue sur Zola")
      : (first ? `Welcome to Zola, ${first}` : "Welcome to Zola");
    const intro = fr
      ? "Votre compte est prêt. Zola garde le paiement au milieu, pour que personne n'ait à faire confiance à un inconnu."
      : "Your account is ready. Zola holds the payment in the middle, so neither side has to trust a stranger.";
    const note = fr
      ? "Un seul compte pour acheter et vendre : passez de l'un à l'autre à tout moment depuis le menu en haut de la page."
      : "One account for buying and selling: switch between them at any time from the menu at the top of the page.";
    const cta = seller
      ? { label: fr ? "Créer ma première transaction" : "Create my first transaction", url: `${base}/trade/new` }
      : { label: fr ? "Ouvrir mon tableau de bord" : "Go to my dashboard", url: `${base}/dashboard` };

    const text = [
      heading,
      "",
      intro,
      ...ordered.flatMap((s) => ["", s.title, ...s.items.map((i) => `- ${i}`)]),
      "",
      note,
      "",
      `${cta.label}: ${cta.url}`,
      "",
      supportLine(fr ? "fr" : "en"),
      "",
      "Zola",
      fr ? "Transactions sécurisées. Paiements simples." : "Secure transactions. Simple payments.",
    ].join("\n");

    const res = await sendEmail({
      to: user.email,
      subject: fr ? "Bienvenue sur Zola" : "Welcome to Zola",
      text,
      html: emailLayout({
        lang: fr ? "fr" : "en",
        heading,
        intro,
        sections: ordered.map((s) => ({ title: s.title, items: s.items.map((text) => ({ text })) })),
        cta,
        note,
      }),
    });
    return !!res.success;
  } catch (e: any) {
    console.error("[welcome] email failed:", e?.message);
    return false;
  }
}

/** Welcome for someone who created their account on Pickup to send parcels. */
export async function sendPickupWelcome(user: { name: string; email: string; lang?: string }): Promise<boolean> {
  try {
    if (!user.email) return false;
    const fr = user.lang === "fr";
    const first = String(user.name || "").trim().split(" ")[0] || "";
    const { pickupUrl } = await import("@/lib/pickup/config");
    const url = `${pickupUrl()}/send`;
    const items = fr
      ? [
          "Dites ce que vous envoyez, d'où et vers où. Le prix dépend de la distance, vous le voyez avant de payer.",
          "Payez par Mobile Money. Un livreur Pickup vérifié est envoyé aussitôt.",
          "Suivez le colis sur la carte. Envoyez au destinataire le code à 4 chiffres : il le donne au livreur seulement après avoir vérifié le colis.",
          "Toutes vos livraisons sont dans « Mes livraisons ». Le même compte marche aussi sur Zola pour acheter ou vendre en sécurité.",
        ]
      : [
          "Say what you're sending, from where and to where. The price depends on the distance, and you see it before you pay.",
          "Pay by mobile money. A checked Pickup rider is sent straight away.",
          "Follow the parcel on the map. Send the receiver the 4-digit code: they give it to the rider only after checking the parcel.",
          "All your deliveries are in My deliveries. The same account also works on Zola, to buy and sell safely.",
        ];
    const heading = fr ? `Bienvenue sur Pickup${first ? `, ${first}` : ""}` : `Welcome to Pickup${first ? `, ${first}` : ""}`;
    const cta = { label: fr ? "Envoyer un colis" : "Send a parcel", url };
    const res = await sendEmail({
      to: user.email,
      subject: fr ? "Bienvenue sur Pickup" : "Welcome to Pickup",
      text: [heading, "", ...items.map((i) => `- ${i}`), "", `${cta.label}: ${url}`, "", supportLine(fr ? "fr" : "en")].join("\n"),
      html: emailLayout({
        lang: fr ? "fr" : "en",
        heading,
        intro: fr ? "Votre compte est prêt. Voici comment envoyer un colis :" : "Your account is ready. Here's how sending works:",
        sections: [{ title: fr ? "Envoyer avec Pickup" : "Sending with Pickup", items: items.map((text) => ({ text })) }],
        cta,
      }),
    });
    return !!res.success;
  } catch (e: any) {
    console.error("[welcome] pickup email failed:", e?.message);
    return false;
  }
}
