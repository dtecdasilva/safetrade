"use client";
import { useEffect, useState } from "react";
import { MoneyRail, Pill } from "@/components/ui";

/**
 * The example transaction on the home page. It loads as "payment pending"
 * and, a moment later, shows the payment arriving safely with Zola.
 */
export default function HeroCard() {
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setPaid(true), reduce ? 0 : 1300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="hero-stage">
      <div className="hero-card">
        <div className="hero-card-top">
          <Pill tone={paid ? "ok" : "wait"}>{paid ? "Paid" : "Payment pending"}</Pill>
          <span className="tx-id">Transaction ID <strong>8F3A2B1C</strong></span>
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-2)", margin: "18px 0 2px" }}>
          Wireless headphones, new in box
        </p>
        <p className="hero-amount">FCFA 185,000</p>

        <div style={{ marginTop: 26 }}>
          <MoneyRail at={paid ? "zola" : "buyer"} />
        </div>
        <p className={`hero-where ${paid ? "is-held" : "is-waiting"}`} aria-live="polite">
          {paid ? "FCFA 185,000 is safely held by Zola" : "Waiting for the buyer to pay Zola"}
        </p>

        <div className="answers" style={{ marginTop: 18 }}>
          <div className="answer">
            <p className="answer-q">What happens next</p>
            <p className="answer-a">{paid ? "The seller ships the order." : "The buyer pays Zola."}</p>
          </div>
          <div className="answer">
            <p className="answer-q">Who needs to act</p>
            <p className="answer-a">{paid ? "The seller" : "The buyer"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
