import { redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { getSession } from "@/lib/auth";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import HowItWorks from "@/components/HowItWorks";
import HeroCard from "@/components/HeroCard";

export default async function Home() {
  // Signed-in people go straight to their workspace, as before.
  const session = await getSession();
  if (session) {
    if (session.role === "admin") redirect("/admin");
    redirect("/dashboard");
  }

  return (
    <div className="home">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <h1 className="hero-title">Buy and sell online with confidence.</h1>
              <p className="hero-sub">
                Zola securely holds your payment until your transaction is completed,
                protecting both buyers and sellers every step of the way.
              </p>
              <div className="hero-cta">
                <Link href="/auth/register" className="btn btn-primary btn-lg">Start a transaction</Link>
                <Link href="#how" className="btn btn-secondary btn-lg">How Zola works</Link>
              </div>
              <ul className="hero-facts">
                <li><Check size={17} strokeWidth={2.5} /> The seller is paid only after the buyer confirms delivery</li>
                <li><Check size={17} strokeWidth={2.5} /> One clear fee, shown before anyone pays</li>
                <li><Check size={17} strokeWidth={2.5} /> Every step is recorded, with a transaction ID</li>
              </ul>
            </div>
            <HeroCard />
          </div>
        </section>

        {/* How Zola works */}
        <section id="how" className="section section-tint" style={{ scrollMarginTop: 64 }}>
          <div className="container">
            <div className="section-head">
              <h2 className="h2">How Zola works</h2>
              <p className="lead">
                The buyer pays Zola, not the seller. Zola holds the money until the order arrives,
                then releases it. Four steps, and you can always see where the money is.
              </p>
            </div>
            <HowItWorks />
          </div>
        </section>

        {/* Buyers and sellers */}
        <section className="section">
          <div className="container">
            <div className="section-head">
              <h2 className="h2">Protection for both sides of the deal</h2>
            </div>
            <div className="sides">
              <div className="side">
                <span className="tag">If you&apos;re buying</span>
                <h3 className="side-title">Your payment is protected by Zola until the transaction is completed.</h3>
                <ul className="side-list">
                  <li><Check size={19} strokeWidth={2.5} /><span><strong>Pay Zola, not a stranger.</strong> The seller sees that you&apos;ve paid, but can&apos;t touch the money yet.</span></li>
                  <li><Check size={19} strokeWidth={2.5} /><span><strong>Confirm when it arrives.</strong> The payment is released only after you confirm delivery.</span></li>
                  <li><Check size={19} strokeWidth={2.5} /><span><strong>Something wrong?</strong> Open a dispute. Your payment stays held while Zola reviews it.</span></li>
                </ul>
              </div>
              <div className="side">
                <span className="tag">If you&apos;re selling</span>
                <h3 className="side-title">The payment is secured before you ship anything.</h3>
                <ul className="side-list">
                  <li><Check size={19} strokeWidth={2.5} /><span><strong>Know the buyer has paid.</strong> Zola tells you the moment the payment is held.</span></li>
                  <li><Check size={19} strokeWidth={2.5} /><span><strong>Keep the full price.</strong> You receive the whole item price. The Zola fee is added to the buyer&apos;s total.</span></li>
                  <li><Check size={19} strokeWidth={2.5} /><span><strong>Withdraw to mobile money.</strong> Once a transaction is completed, the funds are in your Zola wallet.</span></li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Fees */}
        <section id="fees" className="section section-tint" style={{ scrollMarginTop: 64 }}>
          <div className="container fees-grid">
            <div>
              <h2 className="h2">One fee, shown before you pay</h2>
              <p className="lead">
                Zola charges 1.5% of the item price. It is added to the buyer&apos;s total and shown
                clearly before payment. The seller receives the full price they asked for.
              </p>
              <p className="lead" style={{ fontSize: 15.5, color: "var(--ink-3)" }}>
                No service can remove every risk from buying and selling online. What Zola does is keep
                the money in the middle until both sides have done what they agreed.
              </p>
            </div>
            <div className="receipt" aria-label="Example of how the fee works">
              <p className="receipt-title">Example</p>
              <div className="kv"><span>Item price</span><span>FCFA 100,000</span></div>
              <div className="kv"><span>Zola fee (1.5%)</span><span>FCFA 1,500</span></div>
              <div className="kv kv-total"><span>Buyer pays</span><span>FCFA 101,500</span></div>
              <div className="receipt-out"><span>Seller receives</span><strong>FCFA 100,000</strong></div>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="section">
          <div className="container">
            <div className="closing">
              <div>
                <h2 className="h2">Trust the transaction, even when you&apos;ve never met.</h2>
                <p>
                  Zola is built in Africa, where a great deal of trade happens between people who
                  have never met. It is made to work wherever buyers and sellers need to trust each other.
                </p>
              </div>
              <Link href="/auth/register" className="btn btn-primary btn-lg">Start a transaction</Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
