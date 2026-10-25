import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import HowItWorks from "@/components/HowItWorks";
import { SupportCard } from "@/components/Support";
import { SUPPORT } from "@/lib/support";
import { getT } from "@/lib/i18n/server";

export function generateMetadata(): Metadata {
  return { title: getT().t("Help") };
}

const FAQ: { q: string; a: string[] }[] = [
  {
    q: "Where is my money while a transaction is in progress?",
    a: [
      "With Zola. When the buyer pays, the money goes to Zola and stays there. The seller can see that it has been paid, but it is only released after the buyer confirms delivery and the 24-hour review that follows.",
      "Every transaction page shows where the money is, what happens next, and who needs to act.",
    ],
  },
  {
    q: "How much does Zola cost?",
    a: [
      "Zola charges 8% of the item price, or 5% when the item costs more than FCFA 50,000. Delivery is priced by distance. Both are added to the buyer's total and shown before payment. The seller receives the full item price.",
      "For example, a FCFA 30,000 item has a FCFA 2,400 fee, and a FCFA 100,000 item has a FCFA 5,000 fee.",
      "The delivery fee only applies when there is something to deliver. For a service, or anything the seller hands over themselves, the seller switches delivery off and only the Zola fee is added.",
      "The delivery price depends on the distance from where the rider collects your order to where you want it. You see it as soon as you mark your spot on the map, before you pay.",
    ],
  },
  {
    q: "How does delivery work?",
    a: [
      "The seller does not send the item straight to the buyer. Once the buyer has paid, the seller sends the item to Zola, and Zola delivers it to the buyer.",
      `The buyer pays for delivery, not the seller. To arrange the hand-over, sellers WhatsApp ${SUPPORT.whatsapp} or call ${SUPPORT.phone}.`,
      "For services and anything else with nothing to deliver, the seller switches delivery off and simply marks the work as delivered.",
    ],
  },
  {
    q: "How do I start a transaction?",
    a: [
      "The seller creates the transaction with the item, the price, the delivery time and the buyer's phone number.",
      "If the buyer already has a Zola account with that number, Zola notifies them and they review the details and pay.",
      "If the buyer isn't on Zola yet, the seller adds the buyer's email. Zola invites the buyer by email and WhatsApp to create an account, and the transaction is waiting for them when they do.",
      "A buyer can start one too: switch to Buying, press New transaction and enter what you agreed and the seller's phone number. Zola sends it to the seller, who checks the details and confirms. Then you pay. If the seller isn't on Zola yet, add their email and we invite them. You can also send them the link on WhatsApp.",
    ],
  },
  {
    q: "Can I buy and sell with the same account?",
    a: [
      "Yes. Every Zola account can buy and sell. Use the Buying and Selling switch on your dashboard, or Switch to selling in the menu at the top. Your purchases and your sales are kept separate, and nothing is lost when you switch.",
    ],
  },
  {
    q: "How do I report a seller?",
    a: [
      "Open the transaction and press Report this seller. You can do it at any time, even after the transaction is completed. Only Zola sees your report: the seller is not told who reported them.",
      "Zola reviews every report. If other buyers should be careful, Zola flags the seller, and buyers then see a warning on transactions with them.",
    ],
  },
  {
    q: "How do I pay?",
    a: [
      "Open the transaction, choose MTN Mobile Money or Orange Money, and enter your number. A payment prompt is sent to your phone. Approve it, and the page updates once the payment is confirmed.",
      "Paid, but the transaction still says Payment pending? Press Check payment on the transaction and Zola asks the mobile money provider directly.",
    ],
  },
  {
    q: "When does the seller get paid?",
    a: [
      "When the buyer confirms delivery, the transaction is under review for 24 hours. Zola checks with the buyer, and if no problem is reported the payment is released to the seller's Zola wallet. From there the seller can withdraw to a mobile money number.",
    ],
  },
  {
    q: "What if my order doesn't arrive, or isn't what was agreed?",
    a: [
      "Don't confirm delivery. Open a dispute from the transaction page instead. Your payment stays held by Zola while the transaction is reviewed.",
    ],
  },
  {
    q: "I confirmed delivery, then found a problem. What now?",
    a: [
      "You have 24 hours after confirming. Open the transaction and choose Make a complaint, then tell us what went wrong. Your payment stays held, and Zola will call or text you.",
      "Zola may also call or text you during those 24 hours just to check the order arrived as agreed.",
      `After 24 hours the payment goes to the seller. If you still need help, WhatsApp ${SUPPORT.whatsapp} or call ${SUPPORT.phone}.`,
    ],
  },
  {
    q: "How do I reach customer service?",
    a: [
      `Message us on WhatsApp at ${SUPPORT.whatsapp}, or call ${SUPPORT.phone}. If it's about a transaction, have the transaction ID ready. You'll find it at the top of the transaction page.`,
    ],
  },
  {
    q: "Can a transaction be changed or deleted?",
    a: [
      "The seller can edit or delete a transaction until the buyer pays. A buyer who started a transaction can edit it until the seller confirms, and cancel it until they pay. Once the buyer has paid, it is locked and can't be changed, so both sides are working from the same agreement. It is also locked for a few minutes while a payment is in progress.",
    ],
  },
  {
    q: "How do withdrawals work?",
    a: [
      "Sellers can request a withdrawal from the Wallet page, up to their available balance. Zola sends it to the mobile money number you enter. You can have one withdrawal in progress at a time.",
    ],
  },
];


const FAQ_FR: { q: string; a: string[] }[] = [
  {
    q: "Où est mon argent pendant une transaction ?",
    a: [
      "Chez Zola. Quand l'acheteur paie, l'argent va chez Zola et y reste. Le vendeur voit que la transaction est payée, mais l'argent ne lui est versé qu'après la confirmation de livraison par l'acheteur et les 24 heures de vérification qui suivent.",
      "Chaque page de transaction indique où est l'argent, la suite, et qui doit agir.",
    ],
  },
  {
    q: "Combien coûte Zola ?",
    a: [
      "Zola prend 8 % du prix de l'article, ou 5 % quand l'article coûte plus de FCFA 50,000. La livraison est calculée selon la distance. Les deux sont ajoutés au total de l'acheteur et affichés avant le paiement. Le vendeur reçoit la totalité du prix de l'article.",
      "Par exemple, un article à FCFA 30,000 a FCFA 2,400 de frais, et un article à FCFA 100,000 a FCFA 5,000 de frais.",
      "Les frais de livraison ne s'appliquent que s'il y a quelque chose à livrer. Pour un service, ou un article que le vendeur remet lui-même, le vendeur désactive la livraison et seuls les frais Zola sont ajoutés.",
      "Le prix de la livraison dépend de la distance entre le lieu où le livreur récupère votre commande et votre lieu. Vous le voyez dès que vous placez votre repère sur la carte, avant de payer.",
    ],
  },
  {
    q: "Comment se passe la livraison ?",
    a: [
      "Le vendeur n'envoie pas l'article directement à l'acheteur. Une fois que l'acheteur a payé, le vendeur remet l'article à Zola, et Zola le livre à l'acheteur.",
      `C'est l'acheteur qui paie la livraison, pas le vendeur. Pour organiser la remise, le vendeur écrit sur WhatsApp au ${SUPPORT.whatsapp} ou appelle le ${SUPPORT.phone}.`,
      "Pour un service, ou tout ce qui n'a rien à livrer, le vendeur désactive la livraison et indique simplement que le travail est livré.",
    ],
  },
  {
    q: "Comment démarrer une transaction ?",
    a: [
      "Le vendeur crée la transaction avec l'article, le prix, le délai de livraison et le numéro de téléphone de l'acheteur.",
      "Si l'acheteur a déjà un compte Zola avec ce numéro, Zola le prévient : il vérifie les détails et paie.",
      "Si l'acheteur n'est pas encore sur Zola, le vendeur ajoute son e-mail. Zola invite l'acheteur par e-mail et WhatsApp à créer un compte, et la transaction l'attend une fois inscrit.",
      "Un acheteur peut aussi en lancer une : passez en mode Achat, appuyez sur Nouvelle transaction et indiquez ce que vous avez convenu et le numéro du vendeur. Zola l'envoie au vendeur, qui vérifie les détails et confirme. Ensuite, vous payez. Si le vendeur n'est pas encore sur Zola, ajoutez son e-mail et nous l'invitons. Vous pouvez aussi lui envoyer le lien sur WhatsApp.",
    ],
  },
  {
    q: "Puis-je acheter et vendre avec le même compte ?",
    a: [
      "Oui. Chaque compte Zola peut acheter et vendre. Utilisez le bouton Achat / Vente de votre tableau de bord, ou Passer à la vente dans le menu en haut. Vos achats et vos ventes restent séparés, et rien n'est perdu quand vous changez.",
    ],
  },
  {
    q: "Comment signaler un vendeur ?",
    a: [
      "Ouvrez la transaction et appuyez sur Signaler ce vendeur. Vous pouvez le faire à tout moment, même après la fin de la transaction. Seul Zola voit votre signalement : le vendeur ne sait pas qui l'a signalé.",
      "Zola examine chaque signalement. Si d'autres acheteurs doivent être prudents, Zola signale le vendeur, et les acheteurs voient alors un avertissement sur les transactions avec lui.",
    ],
  },
  {
    q: "Comment payer ?",
    a: [
      "Ouvrez la transaction, choisissez MTN Mobile Money ou Orange Money, et entrez votre numéro. Une demande de paiement arrive sur votre téléphone. Validez-la, et la page se met à jour dès que le paiement est confirmé.",
      "Vous avez payé mais la transaction indique toujours Paiement en attente ? Appuyez sur Vérifier le paiement sur la transaction : Zola demande directement à l'opérateur.",
    ],
  },
  {
    q: "Quand le vendeur est-il payé ?",
    a: [
      "Quand l'acheteur confirme la livraison, la transaction est en vérification pendant 24 heures. Zola vérifie auprès de l'acheteur et, si aucun problème n'est signalé, le paiement est versé dans le portefeuille Zola du vendeur. Le vendeur peut ensuite le retirer vers un numéro Mobile Money.",
    ],
  },
  {
    q: "Et si ma commande n'arrive pas, ou ne correspond pas à ce qui était convenu ?",
    a: [
      "Ne confirmez pas la livraison. Ouvrez plutôt un litige depuis la page de la transaction. Votre paiement reste bloqué chez Zola pendant l'examen.",
    ],
  },
  {
    q: "J'ai confirmé la livraison, puis j'ai trouvé un problème. Que faire ?",
    a: [
      "Vous avez 24 heures après la confirmation. Ouvrez la transaction, choisissez Faire une réclamation et expliquez le problème. Votre paiement reste bloqué, et Zola vous appellera ou vous écrira.",
      "Zola peut aussi vous appeler ou vous écrire pendant ces 24 heures, simplement pour vérifier que la commande est arrivée comme convenu.",
      `Après 24 heures, le paiement est versé au vendeur. Si vous avez encore besoin d'aide, écrivez sur WhatsApp au ${SUPPORT.whatsapp} ou appelez le ${SUPPORT.phone}.`,
    ],
  },
  {
    q: "Comment joindre le service client ?",
    a: [
      `Écrivez-nous sur WhatsApp au ${SUPPORT.whatsapp}, ou appelez le ${SUPPORT.phone}. S'il s'agit d'une transaction, ayez son ID sous la main : il se trouve en haut de la page de la transaction.`,
    ],
  },
  {
    q: "Peut-on modifier ou supprimer une transaction ?",
    a: [
      "Le vendeur peut modifier ou supprimer une transaction jusqu'au paiement de l'acheteur. Un acheteur qui a lancé une transaction peut la modifier jusqu'à la confirmation du vendeur, et l'annuler jusqu'à son paiement. Une fois payée, elle est verrouillée et ne peut plus changer, pour que chacun s'en tienne au même accord. Elle est aussi verrouillée quelques minutes pendant un paiement en cours.",
    ],
  },
  {
    q: "Comment fonctionnent les retraits ?",
    a: [
      "Les vendeurs demandent un retrait depuis la page Portefeuille, dans la limite de leur solde disponible. Zola l'envoie au numéro Mobile Money indiqué. Un seul retrait peut être en cours à la fois.",
    ],
  },
];

export default async function HelpPage() {
  const session = await getSession();
  const { t, lang } = getT();
  const faq = lang === "fr" ? FAQ_FR : FAQ;

  return (
    <div className="page">
      {session ? <Navbar user={{ name: session.name, role: session.role }} /> : <SiteHeader />}

      <main className="container main">
        <div style={{ maxWidth: 640, marginBottom: 36 }}>
          <h1 className="page-title">{t("Help")}</h1>
          <p className="lead" style={{ marginTop: 8 }}>
            {t("Zola protects both buyers and sellers by securely holding payment until the transaction is completed.")}
          </p>
        </div>

        <div style={{ maxWidth: 800, marginBottom: 44 }}>
          <SupportCard />
        </div>

        <section aria-labelledby="how-title" style={{ marginBottom: 48 }}>
          <h2 id="how-title" className="h2" style={{ fontSize: 24, marginBottom: 22 }}>{t("How Zola works")}</h2>
          <HowItWorks />
        </section>

        <section aria-labelledby="faq-title" style={{ maxWidth: 800 }}>
          <h2 id="faq-title" className="h2" style={{ fontSize: 24, marginBottom: 16 }}>{t("Common questions")}</h2>
          <div className="card" style={{ overflow: "hidden" }}>
            {faq.map((item) => (
              <details key={item.q} className="faq">
                <summary>{item.q}</summary>
                <div className="faq-body">
                  {item.a.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </details>
            ))}
          </div>
          {!session && (
            <p style={{ marginTop: 24, fontSize: 15.5 }}>
              {t("Ready to begin?")} <Link href="/auth/register" style={{ fontWeight: 600 }}>{t("Create an account")}</Link> {t("or")}{" "}
              <Link href="/auth/login" style={{ fontWeight: 600 }}>{t("sign in")}</Link>.
            </p>
          )}
        </section>
      </main>

      {!session && <SiteFooter />}
    </div>
  );
}
