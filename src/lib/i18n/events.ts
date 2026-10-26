/**
 * Activity entries are saved in English when they happen. This shows them in
 * French: fixed labels come from the dictionary, and the common sentences
 * with names or amounts in them are matched and rebuilt here.
 */
import { Lang, translate } from "@/lib/i18n/core";
import { brandText } from "@/lib/zola";

const RULES: [RegExp, string][] = [
  [/^(.+) \(Pickup\) will collect the parcel at a bus agency in (.+) once the seller sends it\.$/, "$1 (Pickup) récupérera le colis dans une agence de voyage à $2 dès que le vendeur l'envoie."],
  [/^(.+) \(Pickup\) will collect the parcel at (.+), (.+) branch, (.+) once the seller sends it\.$/, "$1 (Pickup) récupérera le colis chez $2, agence de $3, $4 dès que le vendeur l'envoie."],
  [/^(.+) \(Pickup\) will collect the parcel at (.+), (.+) branch, (.+)\.$/, "$1 (Pickup) récupérera le colis chez $2, agence de $3, $4."],
  [/^The seller sent the parcel through (.+) to (.+)\. Receipt: (.+)$/, "Le vendeur a envoyé le colis par $1 à $2. Reçu : $3"],
  [/^(.+) collected the parcel at (.+) and is bringing it to the buyer\.$/, "$1 a récupéré le colis chez $2 et l'apporte à l'acheteur."],
  [/^(.+) handed the parcel to the buyer, who gave the delivery code\.$/, "$1 a remis le colis à l'acheteur, qui a donné le code de livraison."],
  [/^Reminder sent to (.+) to confirm the details$/, "Rappel envoyé à $1 pour confirmer les détails"],
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
  [/^(.+) created an account and can now confirm this transaction\.$/, "$1 a créé un compte et peut maintenant confirmer cette transaction."],
  [/^(.+) started this transaction with a seller who is not on Zola yet\. The seller confirms the details, then the buyer pays\.$/, "$1 a lancé cette transaction avec un vendeur qui n'est pas encore sur Zola. Le vendeur confirme les détails, puis l'acheteur paie."],
  [/^(.+) started this transaction with (.+)\. The seller confirms the details, then the buyer pays\.$/, "$1 a lancé cette transaction avec $2. Le vendeur confirme les détails, puis l'acheteur paie."],
  [/^(.+) confirmed the details\. The buyer can now pay\.$/, "$1 a confirmé les détails. L'acheteur peut maintenant payer."],
  [/^(.+) declined this transaction: “(.+)”$/, "$1 a refusé cette transaction : « $2 »"],
  [/^(.+) declined this transaction\.$/, "$1 a refusé cette transaction."],
  [/^Invitation to sign up and confirm sent by email to (.+)\.$/, "Invitation à s'inscrire et à confirmer envoyée par e-mail à $1."],
  [/^The email to the seller didn't go through\. Send them the link yourself: (.+)$/, "L'e-mail au vendeur n'est pas parti. Envoyez-lui vous-même le lien : $1"],
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
