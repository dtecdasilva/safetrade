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
  pending_payment: { label: "Payment pending", color: "#7A5300", bg: "#FEF6E0" },
  funds_held:      { label: "Paid",            color: "#05593F", bg: "#E6F7F1" },
  shipped:         { label: "Shipped",         color: "#334E68", bg: "#F1F5F9" },
  delivered:       { label: "Delivered",       color: "#05593F", bg: "#E6F7F1" },
  complete:        { label: "Completed",       color: "#FFFFFF", bg: "#087F5B" },
  disputed:        { label: "Disputed",        color: "#A93232", bg: "#FCEEEE" },
  cancelled:       { label: "Cancelled",       color: "#54708A", bg: "#F1F5F9" },
};
