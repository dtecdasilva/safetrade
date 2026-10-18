import type { Metadata } from "next";
import LegalPage, { LegalSection } from "@/components/LegalPage";
import { getT } from "@/lib/i18n/server";
import { SUPPORT } from "@/lib/support";

export function generateMetadata(): Metadata {
  return { title: getT().t("Privacy policy") };
}

const W = SUPPORT.whatsapp, P = SUPPORT.phone;

const EN: LegalSection[] = [
  { title: "Who we are", body: [
    `Zola (zolahq.com) holds payments between buyers and sellers until a transaction is completed. This policy explains what information we keep about you and why. To ask anything about it, WhatsApp ${W} or call ${P}.`,
  ]},
  { title: "What we collect", body: [
    [
      "Your account: name, email address, phone number, whether you buy or sell, what you sell (if you told us), and your language. Your password is stored scrambled, so nobody at Zola can read it.",
      "If you sign in with Google: your name, email address and Google account ID. We do not get your Google password.",
      "Your transactions: the item or service, description, prices, delivery details, the other person's name, and what happens at each step, including complaints and our notes.",
      "Payments and withdrawals: the mobile money number and network you use, amounts and payment references. We never see or keep your mobile money PIN.",
      "Messages we send you, such as notifications, emails and WhatsApp messages, and notes from our calls with you about a transaction.",
      "Reports: what you tell us when you report a seller, and reports other buyers make about you as a seller, with our notes and whether your account is flagged.",
      "Basic technical information needed to keep the site working and secure, such as when you signed in.",
    ],
  ]},
  { title: "Why we use it", body: [
    [
      "To run your transactions: take payments, hold them, deliver goods and pay sellers.",
      "To keep you informed by email, WhatsApp and in the app, and to call or text you during a review, complaint or dispute.",
      "To handle returns: when an item is not the right one, we use the transaction details to send it back to the seller and refund the buyer, minus FCFA 1,000 for the return delivery.",
      "To prevent fraud and misuse, and to settle problems between buyers and sellers.",
      "To meet our legal obligations and keep financial records.",
    ],
    "We do not sell your information, and we do not use it for advertising.",
  ]},
  { title: "Who sees it", body: [
    [
      "The other person in a transaction sees your name. Whoever creates a transaction already knows the other person's phone number, and the email of someone they invite.",
      "If you report a seller, only Zola sees your report. The seller is not told who reported them. If we flag a seller, buyers see a warning, but not the reports themselves.",
      "Zola's team, to run transactions and help you.",
      "Companies that provide our services: Google Firebase (where our data is stored), Vercel (where the site runs), Fapshi (mobile money payments), Resend (emails), Meta (WhatsApp messages) and Google (if you sign in with Google). They use your information only to provide that service.",
      "Authorities, when the law requires it.",
    ],
    "Some of these companies store information outside Cameroon.",
  ]},
  { title: "How long we keep it", body: [
    "We keep your account information while your account is open. We keep transaction and payment records for as long as we need them for accounting, legal obligations and to handle any later dispute, even after an account is closed.",
  ]},
  { title: "Cookies and storage", body: [
    "We use one cookie to keep you signed in and one to remember your language. Your light or dark theme choice is saved in your browser. We do not use advertising or tracking cookies.",
  ]},
  { title: "Your choices", body: [
    [
      "You can update your name, email and phone number in your Profile at any time.",
      `You can ask for a copy of your information, ask us to correct it, or ask us to close your account, by WhatsApp on ${W} or by calling ${P}.`,
    ],
  ]},
  { title: "Security", body: [
    "The site uses an encrypted connection (HTTPS), passwords are stored scrambled, and only people who need it can see your information. No system is perfectly secure, so keep your password private and tell us straight away if something looks wrong.",
  ]},
  { title: "Children", body: [
    "Zola is not for anyone under 18, and we do not knowingly keep information about children.",
  ]},
  { title: "Changes to this policy", body: [
    "We may update this policy. When we do, we change the date at the top of this page, and we tell you by email or in the app if the change matters to you.",
  ]},
];

const FR: LegalSection[] = [
  { title: "Qui nous sommes", body: [
    `Zola (zolahq.com) garde les paiements entre acheteurs et vendeurs jusqu'à la fin d'une transaction. Cette politique explique quelles informations nous gardons sur vous et pourquoi. Pour toute question, écrivez sur WhatsApp au ${W} ou appelez le ${P}.`,
  ]},
  { title: "Ce que nous collectons", body: [
    [
      "Votre compte : nom, adresse e-mail, numéro de téléphone, si vous achetez ou vendez, ce que vous vendez (si vous nous l'avez dit), et votre langue. Votre mot de passe est stocké sous forme brouillée : personne chez Zola ne peut le lire.",
      "Si vous vous connectez avec Google : votre nom, votre adresse e-mail et l'identifiant de votre compte Google. Nous ne recevons pas votre mot de passe Google.",
      "Vos transactions : l'article ou le service, la description, les prix, les détails de livraison, le nom de l'autre partie, et ce qui se passe à chaque étape, y compris les réclamations et nos notes.",
      "Paiements et retraits : le numéro et le réseau Mobile Money que vous utilisez, les montants et les références de paiement. Nous ne voyons et ne gardons jamais votre code PIN Mobile Money.",
      "Les messages que nous vous envoyons (notifications, e-mails, messages WhatsApp) et les notes de nos appels avec vous au sujet d'une transaction.",
      "Les signalements : ce que vous nous dites quand vous signalez un vendeur, et les signalements d'autres acheteurs à votre sujet en tant que vendeur, avec nos notes et le fait que votre compte soit signalé ou non.",
      "Les informations techniques de base nécessaires au bon fonctionnement et à la sécurité du site, comme l'heure de votre connexion.",
    ],
  ]},
  { title: "Pourquoi nous les utilisons", body: [
    [
      "Pour faire fonctionner vos transactions : encaisser les paiements, les garder, livrer les biens et payer les vendeurs.",
      "Pour vous tenir informé par e-mail, WhatsApp et dans l'application, et pour vous appeler ou vous écrire pendant une vérification, une réclamation ou un litige.",
      "Pour gérer les retours : quand un article n'est pas le bon, nous utilisons les détails de la transaction pour le renvoyer au vendeur et rembourser l'acheteur, moins FCFA 1,000 pour la livraison du retour.",
      "Pour prévenir la fraude et les abus, et régler les problèmes entre acheteurs et vendeurs.",
      "Pour respecter nos obligations légales et tenir nos registres financiers.",
    ],
    "Nous ne vendons pas vos informations et ne les utilisons pas pour de la publicité.",
  ]},
  { title: "Qui les voit", body: [
    [
      "L'autre partie d'une transaction voit votre nom. Celui qui crée une transaction connaît déjà le numéro de l'autre partie, et l'e-mail de la personne qu'il invite.",
      "Si vous signalez un vendeur, seul Zola voit votre signalement. Le vendeur ne sait pas qui l'a signalé. Si nous signalons un vendeur, les acheteurs voient un avertissement, mais pas les signalements eux-mêmes.",
      "L'équipe Zola, pour faire fonctionner les transactions et vous aider.",
      "Les entreprises qui fournissent nos services : Google Firebase (où nos données sont stockées), Vercel (où le site fonctionne), Fapshi (paiements Mobile Money), Resend (e-mails), Meta (messages WhatsApp) et Google (si vous vous connectez avec Google). Elles n'utilisent vos informations que pour fournir ce service.",
      "Les autorités, lorsque la loi l'exige.",
    ],
    "Certaines de ces entreprises stockent des informations en dehors du Cameroun.",
  ]},
  { title: "Combien de temps nous les gardons", body: [
    "Nous gardons les informations de votre compte tant qu'il est ouvert. Nous gardons les données de transactions et de paiements aussi longtemps que nécessaire pour la comptabilité, nos obligations légales et le traitement d'un éventuel litige, même après la fermeture d'un compte.",
  ]},
  { title: "Cookies et stockage", body: [
    "Nous utilisons un cookie pour garder votre session ouverte et un autre pour mémoriser votre langue. Votre choix de thème clair ou sombre est enregistré dans votre navigateur. Nous n'utilisons pas de cookies publicitaires ni de suivi.",
  ]},
  { title: "Vos choix", body: [
    [
      "Vous pouvez modifier votre nom, votre e-mail et votre numéro dans votre Profil à tout moment.",
      `Vous pouvez demander une copie de vos informations, leur correction ou la fermeture de votre compte, sur WhatsApp au ${W} ou en appelant le ${P}.`,
    ],
  ]},
  { title: "Sécurité", body: [
    "Le site utilise une connexion chiffrée (HTTPS), les mots de passe sont stockés sous forme brouillée, et seules les personnes qui en ont besoin peuvent voir vos informations. Aucun système n'est parfaitement sûr : gardez votre mot de passe secret et prévenez-nous immédiatement si quelque chose vous semble anormal.",
  ]},
  { title: "Mineurs", body: [
    "Zola n'est pas destiné aux moins de 18 ans, et nous ne gardons pas sciemment d'informations sur des mineurs.",
  ]},
  { title: "Modifications de cette politique", body: [
    "Nous pouvons mettre à jour cette politique. Dans ce cas, nous changeons la date en haut de cette page, et nous vous prévenons par e-mail ou dans l'application si le changement vous concerne.",
  ]},
];

export default function PrivacyPage() {
  const { lang } = getT();
  const fr = lang === "fr";
  return (
    <LegalPage
      title={fr ? "Politique de confidentialité" : "Privacy policy"}
      updated={fr ? "Mise à jour le 18 octobre 2026" : "Last updated 18 October 2026"}
      intro={fr
        ? "Vos informations servent à faire fonctionner vos transactions et à vous protéger, et à rien d'autre."
        : "Your information is used to run your transactions and keep you safe, and for nothing else."}
      sections={fr ? FR : EN}
      other={{ href: "/terms", label: fr ? "Lire les conditions d'utilisation" : "Read the terms of use" }}
    />
  );
}
