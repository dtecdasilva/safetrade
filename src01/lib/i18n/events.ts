/**
 * Activity entries are saved in English when they happen. This shows them in
 * French: fixed labels come from the dictionary, and the common sentences
 * with names or amounts in them are matched and rebuilt here.
 */
import { Lang, translate } from "@/lib/i18n/core";
import { brandText } from "@/lib/zola";

const RULES: [RegExp, string][] = [
  [/^(.+) created this transaction for a buyer who is not on Zola yet$/, "$1 a créé cette transaction pour un acheteur qui n'est pas encore sur Zola"],
  [/^(.+) created this transaction for (.+)$/, "$1 a créé cette transaction pour $2"],
  [/^Notification sent to (.+)$/, "Notification envoyée à $1"],
  [/^Reminder sent to (.+)$/, "Rappel envoyé à $1"],
  [/^Email failed: (.+)$/, "L'e-mail n'a pas pu être envoyé : $1"],
  [/^Reminder failed: (.+)$/, "Le rappel n'a pas pu être envoyé : $1"],
  [/^FCFA ([\d,.\s]+) safely held by Zola$/, "FCFA $1 conservés en sécurité par Zola"],
  [/^FCFA ([\d,.\s]+) released to the seller$/, "FCFA $1 versés au vendeur"],
  [/^The seller handed the item to Zola for delivery to the buyer$/, "Le vendeur a remis l'article à Zola pour livraison à l'acheteur"],
  [/^The seller marked the work as delivered$/, "Le vendeur a indiqué que le travail est livré"],
  [/^The seller has shipped the order$/, "Le vendeur a expédié la commande"],
  [/^The buyer confirmed delivery\. Zola reviews this for 24 hours before releasing the payment to the seller\.$/, "L'acheteur a confirmé la livraison. Zola examine la transaction pendant 24 heures avant de verser le paiement au vendeur."],
  [/^The buyer confirmed delivery\. Zola is releasing the payment to the seller\.$/, "L'acheteur a confirmé la livraison. Zola verse le paiement au vendeur."],
  [/^Zola called or texted the buyer to check on this order\.(?: Note: (.+))?$/, "Zola a appelé ou écrit à l'acheteur pour vérifier la commande.__NOTE__"],
  [/^(.+) reported a problem: “(.+)” The payment stays held while Zola looks into it\.$/, "$1 a signalé un problème : « $2 » Le paiement reste bloqué pendant que Zola examine la situation."],
  [/^Zola closed the buyer's complaint\. Note: (.+)$/, "Zola a clôturé la réclamation de l'acheteur. Note : $1"],
  [/^(.+) opened a dispute\. Zola is reviewing this transaction\.$/, "$1 a ouvert un litige. Zola examine cette transaction."],
  [/^Invitation to sign up and pay sent by email to (.+) and on WhatsApp to (.+)\.$/, "Invitation à s'inscrire et à payer envoyée par e-mail à $1 et sur WhatsApp au $2."],
  [/^Invitation to sign up and pay sent by email to (.+)\.$/, "Invitation à s'inscrire et à payer envoyée par e-mail à $1."],
  [/^Invitation to sign up and pay sent on WhatsApp to (.+)\.$/, "Invitation à s'inscrire et à payer envoyée sur WhatsApp au $1."],
  [/^Neither the email nor the WhatsApp message went through\. Share this link with the buyer yourself: (.+)$/, "Ni l'e-mail ni le message WhatsApp ne sont partis. Envoyez vous-même ce lien à l'acheteur : $1"],
  [/^(.+) created an account and can now pay for this transaction\.$/, "$1 a créé un compte et peut maintenant payer cette transaction."],
];

export function translateEventText(lang: Lang, text: string | undefined | null): string {
  const clean = brandText(text);
  if (lang !== "fr" || !clean) return clean;
  const fixed = translate("fr", clean);
  if (fixed !== clean) return fixed;
  for (const [re, fr] of RULES) {
    const m = clean.match(re);
    if (m) {
      let out = clean.replace(re, fr);
      if (out.includes("__NOTE__")) out = out.replace("__NOTE__", m[1] ? ` Note : ${m[1]}` : "");
      return out;
    }
  }
  return clean;
}
