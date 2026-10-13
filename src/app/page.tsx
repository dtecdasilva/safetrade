import { redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import HowItWorks from "@/components/HowItWorks";
import HeroCard from "@/components/HeroCard";

/** A point in a list: bold lead-in, then the rest of the sentence. */
function Point({ lead, text }: { lead: string; text: string }) {
  return <li><Check size={19} strokeWidth={2.5} /><span><strong>{lead}</strong> {text}</span></li>;
}

export default async function Home() {
  // Signed-in people go straight to their workspace, as before.
  const session = await getSession();
  if (session) {
    if (session.role === "admin") redirect("/admin");
    redirect("/dashboard");
  }
  const { t } = getT();

  return (
    <div className="home">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <h1 className="hero-title">{t("Buy and sell online with confidence.")}</h1>
              <p className="hero-sub">
                {t("Zola securely holds your payment until your transaction is completed, protecting both buyers and sellers every step of the way.")}
              </p>
              <div className="hero-cta">
                <Link href="/auth/register" className="btn btn-primary btn-lg">{t("Start a transaction")}</Link>
                <Link href="#how" className="btn btn-secondary btn-lg">{t("How Zola works")}</Link>
              </div>
              <ul className="hero-facts">
                <li><Check size={17} strokeWidth={2.5} /> {t("The seller is paid only after the buyer confirms delivery")}</li>
                <li><Check size={17} strokeWidth={2.5} /> {t("Fees and delivery shown before anyone pays")}</li>
                <li><Check size={17} strokeWidth={2.5} /> {t("Every step is recorded, with a transaction ID")}</li>
              </ul>
            </div>
            <HeroCard />
          </div>
        </section>

        {/* How Zola works */}
        <section id="how" className="section section-tint" style={{ scrollMarginTop: 64 }}>
          <div className="container">
            <div className="section-head">
              <h2 className="h2">{t("How Zola works")}</h2>
              <p className="lead">
                {t("The buyer pays Zola, not the seller. Zola holds the money until the order arrives, then releases it. Four steps, and you can always see where the money is.")}
              </p>
            </div>
            <HowItWorks />
          </div>
        </section>

        {/* Buyers and sellers */}
        <section className="section">
          <div className="container">
            <div className="section-head">
              <h2 className="h2">{t("Protection for both sides of the deal")}</h2>
            </div>
            <div className="sides">
              <div className="side">
                <span className="tag">{t("If you're buying")}</span>
                <h3 className="side-title">{t("Your payment is protected by Zola until the transaction is completed.")}</h3>
                <ul className="side-list">
                  <Point lead={t("Pay Zola, not a stranger.")} text={t("The seller sees that you've paid, but can't touch the money yet.")} />
                  <Point lead={t("Confirm when it arrives.")} text={t("You then have 24 hours to tell us if anything is wrong before the seller is paid.")} />
                  <Point lead={t("Something wrong?")} text={t("Open a dispute. Your payment stays held while Zola reviews it.")} />
                </ul>
              </div>
              <div className="side">
                <span className="tag">{t("If you're selling")}</span>
                <h3 className="side-title">{t("The payment is secured before you send anything.")}</h3>
                <ul className="side-list">
                  <Point lead={t("Know the buyer has paid.")} text={t("Zola tells you the moment the payment is held.")} />
                  <Point lead={t("Keep the full price.")} text={t("You receive the whole item price. The Zola fee and delivery are added to the buyer's total.")} />
                  <Point lead={t("Withdraw to mobile money.")} text={t("Once a transaction is completed, the funds are in your Zola wallet.")} />
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Fees */}
        <section id="fees" className="section section-tint" style={{ scrollMarginTop: 64 }}>
          <div className="container fees-grid">
            <div>
              <h2 className="h2">{t("The full cost, shown before you pay")}</h2>
              <p className="lead">
                {t("Zola charges 8% of the item price, or 5% when the item costs more than FCFA 50,000, plus FCFA 1,000 for delivery. Both are added to the buyer's total and shown clearly before payment. The seller receives the full price they asked for.")}
              </p>
              <p className="lead" style={{ fontSize: 15.5 }}>
                {t("Sellers send the item to Zola and Zola delivers it. The FCFA 1,000 covers a standard delivery. If your item costs more than that to deliver, you will have to pay the difference. For services with nothing to deliver, no delivery fee is added.")}
              </p>
              <p className="lead" style={{ fontSize: 15.5, color: "var(--ink-3)" }}>
                {t("No service can remove every risk from buying and selling online. What Zola does is keep the money in the middle until both sides have done what they agreed.")}
              </p>
            </div>
            <div className="receipt" aria-label={t("Example of how the fee works")}>
              <p className="receipt-title">{t("Example")}</p>
              <div className="kv"><span>{t("Item price")}</span><span>FCFA 30,000</span></div>
              <div className="kv"><span>{t("Zola fee ({rate})", { rate: "8%" })}</span><span>FCFA 2,400</span></div>
              <div className="kv"><span>{t("Delivery")}</span><span>FCFA 1,000</span></div>
              <div className="kv kv-total"><span>{t("Buyer pays")}</span><span>FCFA 33,400</span></div>
              <div className="receipt-out"><span>{t("Seller receives")}</span><strong>FCFA 30,000</strong></div>
              <p className="hint" style={{ marginTop: 12 }}>
                {t("Above FCFA 50,000 the fee is 5%: on a FCFA 100,000 item it is FCFA 5,000.")}
              </p>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="section">
          <div className="container">
            <div className="closing">
              <div>
                <h2 className="h2">{t("Trust the transaction, even when you've never met.")}</h2>
                <p>
                  {t("Zola is built in Africa, where a great deal of trade happens between people who have never met. It is made to work wherever buyers and sellers need to trust each other.")}
                </p>
              </div>
              <Link href="/auth/register" className="btn btn-primary btn-lg">{t("Start a transaction")}</Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
