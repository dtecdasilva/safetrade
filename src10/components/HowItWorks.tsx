import React from "react";
import { MoneyRail } from "@/components/ui";
import { MoneyAt } from "@/lib/zola";

const STEPS: { title: string; text: string; at: MoneyAt; note: string; held: boolean }[] = [
  {
    title: "Create a transaction",
    text: "Buyer and seller agree on the transaction details.",
    at: "none",
    note: "No money has moved",
    held: false,
  },
  {
    title: "Buyer pays Zola",
    text: "The buyer sends payment to Zola instead of directly to the seller.",
    at: "zola",
    note: "Zola is holding the money",
    held: true,
  },
  {
    title: "Seller delivers",
    text: "The seller ships or delivers the agreed product or service.",
    at: "zola",
    note: "The money stays with Zola",
    held: true,
  },
  {
    title: "Zola releases the payment",
    text: "Once the buyer confirms delivery, Zola releases the funds to the seller.",
    at: "seller",
    note: "The seller has the money",
    held: true,
  },
];

/** The four-step explanation of how a Zola transaction works. */
export default function HowItWorks() {
  return (
    <ol className="how-grid">
      {STEPS.map((s, i) => (
        <li key={s.title} className="how-step">
          <div className="how-rail">
            <MoneyRail at={s.at} mini />
            <p className={`how-rail-note${s.held ? " is-held" : ""}`}>{s.note}</p>
          </div>
          <span className="how-num" aria-hidden="true">{i + 1}</span>
          <h3 className="how-title">{s.title}</h3>
          <p className="how-text">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}
