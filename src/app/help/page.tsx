import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import HowItWorks from "@/components/HowItWorks";
import { SupportCard } from "@/components/Support";
import { SUPPORT } from "@/lib/support";

export const metadata: Metadata = { title: "Help" };

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
      "Zola charges 8% of the item price, or 5% when the item costs more than FCFA 50,000. Delivery is FCFA 1,000. Both are added to the buyer's total and shown before payment. The seller receives the full item price.",
      "For example, a FCFA 30,000 item has a FCFA 2,400 fee, and a FCFA 100,000 item has a FCFA 5,000 fee.",
      "The delivery fee only applies when there is something to deliver. For a service, or anything the seller hands over themselves, the seller switches delivery off and only the Zola fee is added.",
      "The FCFA 1,000 covers a standard delivery. If your item costs more than that to deliver, you will have to pay the difference.",
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
    ],
  },
  {
    q: "How do I pay?",
    a: [
      "Open the transaction, choose MTN Mobile Money or Orange Money, and enter your number. A payment prompt is sent to your phone. Approve it, and the page updates once the payment is confirmed.",
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
      "The seller can edit or delete a transaction until the buyer pays. Once the buyer has paid, it is locked and can't be changed, so both sides are working from the same agreement. It is also locked for a few minutes while a payment is in progress.",
    ],
  },
  {
    q: "How do withdrawals work?",
    a: [
      "Sellers can request a withdrawal from the Wallet page, up to their available balance. Zola sends it to the mobile money number you enter. You can have one withdrawal in progress at a time.",
    ],
  },
];

export default async function HelpPage() {
  const session = await getSession();

  return (
    <div className="page">
      {session ? <Navbar user={{ name: session.name, role: session.role }} /> : <SiteHeader />}

      <main className="container main">
        <div style={{ maxWidth: 640, marginBottom: 36 }}>
          <h1 className="page-title">Help</h1>
          <p className="lead" style={{ marginTop: 8 }}>
            Zola protects both buyers and sellers by securely holding payment until the transaction is completed.
          </p>
        </div>

        <div style={{ maxWidth: 800, marginBottom: 44 }}>
          <SupportCard />
        </div>

        <section aria-labelledby="how-title" style={{ marginBottom: 48 }}>
          <h2 id="how-title" className="h2" style={{ fontSize: 24, marginBottom: 22 }}>How Zola works</h2>
          <HowItWorks />
        </section>

        <section aria-labelledby="faq-title" style={{ maxWidth: 800 }}>
          <h2 id="faq-title" className="h2" style={{ fontSize: 24, marginBottom: 16 }}>Common questions</h2>
          <div className="card" style={{ overflow: "hidden" }}>
            {FAQ.map((item) => (
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
              Ready to begin? <Link href="/auth/register" style={{ fontWeight: 600 }}>Create an account</Link> or{" "}
              <Link href="/auth/login" style={{ fontWeight: 600 }}>sign in</Link>.
            </p>
          )}
        </section>
      </main>

      {!session && <SiteFooter />}
    </div>
  );
}
