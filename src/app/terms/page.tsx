import type { Metadata } from "next";
import LegalPage, { LegalSection } from "@/components/LegalPage";
import { getT } from "@/lib/i18n/server";
import { SUPPORT } from "@/lib/support";

export function generateMetadata(): Metadata {
  return { title: getT().t("Terms of use") };
}

const W = SUPPORT.whatsapp, P = SUPPORT.phone;

const EN: LegalSection[] = [
  { title: "What Zola does", body: [
    "Zola (zolahq.com) helps people who buy and sell online trust each other. The buyer pays Zola instead of paying the seller directly. Zola holds the money until the buyer confirms the order arrived and a short review has passed, then pays the seller.",
    "Zola is not a shop and does not sell the items or services in a transaction. The agreement about what is sold, its price and its condition is between the buyer and the seller. Zola is not a bank, and money held by Zola does not earn interest.",
  ]},
  { title: "Your account", body: [
    "You must be at least 18 years old to use Zola.",
    [
      "Give your real name, a working email address and a phone number you use.",
      "Each phone number can belong to one Zola account only.",
      "One account can both buy and sell. You can switch between buying and selling at any time.",
      "Keep your password private. You are responsible for what happens in your account.",
      "Tell us straight away if you think someone else has used your account.",
    ],
  ]},
  { title: "How a transaction works", body: [
    [
      "The seller creates a transaction with the item or service, the price, the delivery time and the buyer's phone number. If the buyer is not on Zola yet, Zola invites them to sign up.",
      "A buyer can also start a transaction with the seller's phone number. It only goes ahead once the seller has checked and confirmed the details, and the buyer cannot pay before that. The buyer can change it until the seller confirms, and cancel it until they pay. If the seller declines, it is cancelled and nothing is charged.",
      "The seller can change or delete a transaction until the buyer pays. After payment it is locked.",
      "The buyer pays Zola with MTN Mobile Money or Orange Money. The total, including fees, is shown before paying.",
      "For goods, the seller sends the item to Zola, and Zola delivers it to the buyer. For services, the seller does the work agreed.",
      "The buyer confirms delivery once the order has arrived and been checked.",
      "After the buyer confirms, the transaction is under review for 24 hours. Zola may call or text the buyer to check.",
      "If no problem is reported, Zola releases the item price to the seller's Zola wallet. The seller can then withdraw it to a mobile money number.",
    ],
  ]},
  { title: "Fees", body: [
    "Zola charges 8% of the item price, or 5% when the item costs more than FCFA 50,000. Standard delivery costs FCFA 1,000. Both are paid by the buyer, on top of the item price, and are shown before payment. The seller receives the full item price.",
    "If an item costs more than FCFA 1,000 to deliver, the buyer pays the difference.",
    "There is no delivery fee when the seller says there is nothing to deliver, such as a service.",
    "If a transaction is deleted or cancelled before payment, nothing is charged.",
  ]},
  { title: "Problems, complaints and disputes", body: [
    "If an order does not arrive or is not what was agreed, the buyer should not confirm delivery. Either side can open a dispute while the money is held and before delivery is confirmed.",
    "After confirming delivery, the buyer has 24 hours to make a complaint from the transaction page.",
    "While a dispute or complaint is open, the money stays with Zola. Zola contacts both sides, may ask for proof such as photos or messages, and decides what happens to the money it holds. Zola aims to be fair to both sides, and its decision on the money it holds is final.",
    "If Zola decides the buyer should get their money back, Zola returns the item price it is holding. Whether the Zola fee and the delivery fee are also returned depends on what went wrong, and Zola says so when it decides.",
    "If the item is not the right one (not what was agreed), Zola sends it back to the seller. To pay for that return, FCFA 1,000 is deducted from the buyer's original payment. The buyer can withdraw the rest of their refund once this has been deducted.",
    "Once Zola has released a payment to the seller, it can no longer be used to refund the buyer.",
  ]},
  { title: "Reporting a seller", body: [
    "A buyer can report the seller of any transaction they took part in, at any time, including after the transaction is completed. Reports go to Zola only. The seller is not told who reported them.",
    "Zola reviews every report and may contact the buyer and the seller. If Zola believes other buyers should be careful, it may flag the seller. While a seller is flagged, buyers see a warning on transactions with that seller, and the seller is told that their account has been flagged.",
    "A flag is a warning, not a final finding against the seller. Zola can remove it at any time, and a flagged seller can contact customer service to discuss it. Zola may also suspend or close accounts that break these terms.",
    "Only report what really happened. Making false reports to harm a seller is not allowed.",
  ]},
  { title: "What you may not use Zola for", body: [
    [
      "Anything illegal in Cameroon or where the buyer or seller lives.",
      "Weapons, drugs, stolen goods, counterfeit goods, or anything you do not have the right to sell.",
      "Fake transactions, moving money for someone else, or hiding where money comes from.",
      "Pretending to be someone else, or using someone else's phone number or mobile money account without permission.",
    ],
    "Zola may refuse, hold or cancel a transaction, and may close an account, if it believes these terms are being broken. Where the law requires it, Zola may report a transaction to the authorities.",
  ]},
  { title: "Payments and withdrawals", body: [
    "Payments and withdrawals go through mobile money, using our payment provider. Zola is not responsible for delays or failures caused by a mobile money operator.",
    "Check the number and the network before you withdraw. A withdrawal sent to the number you entered cannot be taken back by Zola.",
  ]},
  { title: "Our responsibility", body: [
    "Zola holds money and follows the steps above carefully, but it does not make or check the items and services that are sold. Zola is not responsible for their quality, safety or legality, or for what the buyer and seller agreed outside Zola.",
    "As far as the law allows, Zola's responsibility for any transaction is limited to the money it holds for that transaction.",
  ]},
  { title: "Closing your account", body: [
    `You can ask us to close your account at any time by WhatsApp on ${W} or by calling ${P}. An account with a transaction still in progress is closed once that transaction is finished.`,
  ]},
  { title: "Changes to these terms", body: [
    "We may update these terms. When we do, we change the date at the top of this page. If a change matters for how you use Zola, we will tell you by email or in the app. Using Zola after a change means you accept it.",
  ]},
  { title: "Law", body: [
    "These terms are governed by the laws of Cameroon.",
  ]},
  { title: "Contact", body: [
    `Questions about these terms: WhatsApp ${W} or call ${P}.`,
  ]},
];

const FR: LegalSection[] = [
  { title: "Ce que fait Zola", body: [
    "Zola (zolahq.com) aide les personnes qui achètent et vendent en ligne à se faire confiance. L'acheteur paie Zola au lieu de payer directement le vendeur. Zola garde l'argent jusqu'à ce que l'acheteur confirme l'arrivée de la commande et qu'une courte vérification soit passée, puis paie le vendeur.",
    "Zola n'est pas une boutique et ne vend pas les articles ou services des transactions. L'accord sur ce qui est vendu, son prix et son état est entre l'acheteur et le vendeur. Zola n'est pas une banque, et l'argent gardé par Zola ne produit pas d'intérêts.",
  ]},
  { title: "Votre compte", body: [
    "Vous devez avoir au moins 18 ans pour utiliser Zola.",
    [
      "Indiquez votre vrai nom, une adresse e-mail valide et un numéro de téléphone que vous utilisez.",
      "Chaque numéro de téléphone ne peut appartenir qu'à un seul compte Zola.",
      "Un même compte peut acheter et vendre. Vous pouvez passer de l'achat à la vente à tout moment.",
      "Gardez votre mot de passe secret. Vous êtes responsable de ce qui se passe sur votre compte.",
      "Prévenez-nous immédiatement si vous pensez que quelqu'un d'autre a utilisé votre compte.",
    ],
  ]},
  { title: "Comment se passe une transaction", body: [
    [
      "Le vendeur crée une transaction avec l'article ou le service, le prix, le délai de livraison et le numéro de l'acheteur. Si l'acheteur n'est pas encore sur Zola, Zola l'invite à s'inscrire.",
      "Un acheteur peut aussi lancer une transaction avec le numéro du vendeur. Elle n'avance qu'une fois que le vendeur a vérifié et confirmé les détails, et l'acheteur ne peut pas payer avant. L'acheteur peut la modifier jusqu'à la confirmation du vendeur, et l'annuler jusqu'à son paiement. Si le vendeur refuse, elle est annulée et rien n'est prélevé.",
      "Le vendeur peut modifier ou supprimer une transaction jusqu'au paiement de l'acheteur. Après le paiement, elle est verrouillée.",
      "L'acheteur paie Zola avec MTN Mobile Money ou Orange Money. Le total, frais compris, est affiché avant le paiement.",
      "Pour un bien, le vendeur remet l'article à Zola, qui le livre à l'acheteur. Pour un service, le vendeur réalise le travail convenu.",
      "L'acheteur confirme la livraison une fois la commande reçue et vérifiée.",
      "Après la confirmation, la transaction est en vérification pendant 24 heures. Zola peut appeler ou écrire à l'acheteur pour vérifier.",
      "Si aucun problème n'est signalé, Zola verse le prix de l'article dans le portefeuille Zola du vendeur. Le vendeur peut ensuite le retirer vers un numéro Mobile Money.",
    ],
  ]},
  { title: "Frais", body: [
    "Zola prend 8 % du prix de l'article, ou 5 % quand l'article coûte plus de FCFA 50,000. La livraison standard coûte FCFA 1,000. Ces deux montants sont payés par l'acheteur, en plus du prix de l'article, et affichés avant le paiement. Le vendeur reçoit la totalité du prix de l'article.",
    "Si la livraison d'un article coûte plus de FCFA 1,000, l'acheteur paie la différence.",
    "Aucun frais de livraison n'est ajouté quand le vendeur indique qu'il n'y a rien à livrer, par exemple pour un service.",
    "Si une transaction est supprimée ou annulée avant le paiement, rien n'est prélevé.",
  ]},
  { title: "Problèmes, réclamations et litiges", body: [
    "Si une commande n'arrive pas ou ne correspond pas à ce qui était convenu, l'acheteur ne doit pas confirmer la livraison. Chacune des parties peut ouvrir un litige tant que l'argent est gardé et avant la confirmation de livraison.",
    "Après avoir confirmé la livraison, l'acheteur a 24 heures pour faire une réclamation depuis la page de la transaction.",
    "Tant qu'un litige ou une réclamation est ouvert, l'argent reste chez Zola. Zola contacte les deux parties, peut demander des preuves comme des photos ou des messages, et décide de ce qui arrive à l'argent qu'il garde. Zola cherche à être juste envers les deux parties, et sa décision sur l'argent qu'il garde est définitive.",
    "Si Zola décide que l'acheteur doit être remboursé, Zola rend le prix de l'article qu'il garde. Le remboursement des frais Zola et de la livraison dépend de ce qui s'est passé, et Zola le précise au moment de sa décision.",
    "Si l'article n'est pas le bon (pas ce qui était convenu), Zola le renvoie au vendeur. Pour payer ce retour, FCFA 1,000 sont déduits du paiement initial de l'acheteur. L'acheteur peut retirer le reste de son remboursement une fois cette somme déduite.",
    "Une fois qu'un paiement a été versé au vendeur, il ne peut plus servir à rembourser l'acheteur.",
  ]},
  { title: "Signaler un vendeur", body: [
    "Un acheteur peut signaler le vendeur de toute transaction à laquelle il a participé, à tout moment, y compris après la fin de la transaction. Les signalements ne sont envoyés qu'à Zola. Le vendeur ne sait pas qui l'a signalé.",
    "Zola examine chaque signalement et peut contacter l'acheteur et le vendeur. Si Zola estime que d'autres acheteurs doivent être prudents, il peut signaler le vendeur. Tant qu'un vendeur est signalé, les acheteurs voient un avertissement sur les transactions avec lui, et le vendeur est informé que son compte a été signalé.",
    "Un signalement est un avertissement, pas une décision définitive contre le vendeur. Zola peut le retirer à tout moment, et un vendeur signalé peut contacter le service client pour en parler. Zola peut aussi suspendre ou fermer les comptes qui ne respectent pas ces conditions.",
    "Ne signalez que ce qui s'est vraiment passé. Faire de faux signalements pour nuire à un vendeur est interdit.",
  ]},
  { title: "Ce qui est interdit sur Zola", body: [
    [
      "Tout ce qui est illégal au Cameroun ou là où vivent l'acheteur ou le vendeur.",
      "Les armes, drogues, biens volés, contrefaçons, ou tout ce que vous n'avez pas le droit de vendre.",
      "Les fausses transactions, le transfert d'argent pour le compte d'autrui, ou la dissimulation de l'origine de l'argent.",
      "Se faire passer pour quelqu'un d'autre, ou utiliser le numéro ou le compte Mobile Money d'une autre personne sans son accord.",
    ],
    "Zola peut refuser, bloquer ou annuler une transaction, et fermer un compte, s'il estime que ces conditions ne sont pas respectées. Lorsque la loi l'exige, Zola peut signaler une transaction aux autorités.",
  ]},
  { title: "Paiements et retraits", body: [
    "Les paiements et retraits passent par Mobile Money, via notre prestataire de paiement. Zola n'est pas responsable des retards ou échecs causés par un opérateur Mobile Money.",
    "Vérifiez le numéro et le réseau avant de retirer. Un retrait envoyé au numéro que vous avez indiqué ne peut pas être récupéré par Zola.",
  ]},
  { title: "Notre responsabilité", body: [
    "Zola garde l'argent et suit avec soin les étapes ci-dessus, mais ne fabrique ni ne contrôle les articles et services vendus. Zola n'est pas responsable de leur qualité, de leur sécurité ou de leur légalité, ni de ce que l'acheteur et le vendeur ont convenu en dehors de Zola.",
    "Dans la mesure permise par la loi, la responsabilité de Zola pour une transaction est limitée à l'argent qu'il garde pour cette transaction.",
  ]},
  { title: "Fermer votre compte", body: [
    `Vous pouvez nous demander de fermer votre compte à tout moment, sur WhatsApp au ${W} ou en appelant le ${P}. Un compte avec une transaction en cours est fermé une fois cette transaction terminée.`,
  ]},
  { title: "Modifications de ces conditions", body: [
    "Nous pouvons mettre à jour ces conditions. Dans ce cas, nous changeons la date en haut de cette page. Si un changement compte pour votre utilisation de Zola, nous vous prévenons par e-mail ou dans l'application. Continuer à utiliser Zola après un changement vaut acceptation.",
  ]},
  { title: "Droit applicable", body: [
    "Ces conditions sont régies par le droit camerounais.",
  ]},
  { title: "Contact", body: [
    `Une question sur ces conditions : WhatsApp ${W} ou appelez le ${P}.`,
  ]},
];

export default function TermsPage() {
  const { lang } = getT();
  const fr = lang === "fr";
  return (
    <LegalPage
      title={fr ? "Conditions d'utilisation" : "Terms of use"}
      updated={fr ? "Mis à jour le 18 octobre 2026" : "Last updated 18 October 2026"}
      intro={fr
        ? "Ces conditions expliquent comment fonctionne Zola et ce que chacun s'engage à faire. En créant un compte ou en utilisant Zola, vous les acceptez."
        : "These terms explain how Zola works and what each side agrees to. By creating an account or using Zola, you accept them."}
      sections={fr ? FR : EN}
      other={{ href: "/privacy", label: fr ? "Lire la politique de confidentialité" : "Read the privacy policy" }}
    />
  );
}
