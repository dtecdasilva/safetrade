import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import HowItWorks from "@/components/HowItWorks";

export const metadata: Metadata = { title: "Help" };

const FAQ: { q: string; a: string[] }[] = [
  {
    q: "Where is my money while a transaction is in progress?",
    a: [
      "With Zola. When the buyer pays, the money goes to Zola and stays there. The seller can see that it has been paid, but it is only released after the buyer confirms delivery.",
      "Every transaction page shows where the money is, what happens next, and who needs to act.",
    ],
  },
  {
    q: "How much does Zola cost?",
    a: [
      "Zola charges 1.5% of the item price. The fee is added to the buyer's total and shown before payment. The seller receives the full item price.",
    ],
  },
  {
    q: "How do I start a transaction?",
    a: [
      "The seller creates the transaction with the item, the price, the delivery time and the buyer's phone number. The buyer needs a Zola account registered with that number.",
      "Zola then notifies the buyer, who reviews the details and pays.",
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
      "After the buyer confirms delivery, Zola releases the payment to the seller's Zola wallet. From there the seller can withdraw to a mobile money number.",
    ],
  },
  {
    q: "What if my order doesn't arrive, or isn't what was agreed?",
    a: [
      "Don't confirm delivery. Open a dispute from the transaction page instead. Your payment stays held by Zola while the transaction is reviewed.",
    ],
  },
  {
    q: "Can a transaction be changed or deleted?",
    a: [
      "The seller can edit or delete a transaction until the buyer pays. After payment, the details are locked so both sides are working from the same agreement.",
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
