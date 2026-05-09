export type TradeStatus =
  | "pending_payment"
  | "funds_held"
  | "shipped"
  | "delivered"
  | "complete"
  | "disputed"
  | "cancelled";

export type TradeRole = "buyer" | "seller";

export interface Party {
  name: string;
  avatar: string;
  rating: number;
  trades: number;
}

export interface TradeEvent {
  id: string;
  label: string;
  detail: string;
  time: string;
  type: "success" | "info" | "warn" | "danger";
}

export interface Trade {
  id: string;
  title: string;
  description: string;
  amount: number;
  fee: number;
  status: TradeStatus;
  buyer: Party;
  seller: Party;
  myRole: TradeRole;
  tracking?: string;
  createdAt: string;
  events: TradeEvent[];
}

export const STATUS_META: Record<TradeStatus, { label: string; color: string; bg: string }> = {
  pending_payment: { label: "Pending payment", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  funds_held:      { label: "Funds in escrow", color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  shipped:         { label: "Shipped", color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  delivered:       { label: "Delivered", color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  complete:        { label: "Complete", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  disputed:        { label: "Disputed", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  cancelled:       { label: "Cancelled", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};
