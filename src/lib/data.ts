import { Trade } from "./types";

export const DEMO_TRADES: Trade[] = [
  {
    id: "ST-88213",
    title: "Sony A7 IV Mirrorless Camera",
    description: "Full kit with 28-70mm kit lens, 2x batteries, charger, original box. Minor dust on rear LCD, sensor is pristine.",
    amount: 1850,
    fee: 27.75,
    status: "funds_held",
    myRole: "buyer",
    createdAt: "2025-01-15T10:12:00Z",
    tracking: undefined,
    buyer: { name: "Jordan Lee", avatar: "JL", rating: 4.9, trades: 14 },
    seller: { name: "Maria Reyes", avatar: "MR", rating: 5.0, trades: 31 },
    events: [
      { id: "1", label: "Trade created", detail: "Jordan initiated the trade", time: "Jan 15, 10:12 AM", type: "info" },
      { id: "2", label: "Funds deposited", detail: "FCFA 1,850.00 locked in escrow vault", time: "Jan 15, 10:14 AM", type: "success" },
      { id: "3", label: "Seller notified", detail: "Maria received trade alert via email", time: "Jan 15, 10:14 AM", type: "info" },
    ],
  },
  {
    id: "ST-77109",
    title: "Vintage Rolex Submariner 1680",
    description: "1972 ref 1680, all original, service papers from 2022. No polishing. Tropical dial.",
    amount: 12400,
    fee: 186,
    status: "shipped",
    myRole: "seller",
    tracking: "UPS 1Z999AA1012345678",
    createdAt: "2025-01-13T14:30:00Z",
    buyer: { name: "Alex Kim", avatar: "AK", rating: 4.7, trades: 8 },
    seller: { name: "Jordan Lee", avatar: "JL", rating: 4.9, trades: 14 },
    events: [
      { id: "1", label: "Trade created", detail: "Alex initiated the trade", time: "Jan 13, 2:30 PM", type: "info" },
      { id: "2", label: "Funds deposited", detail: "FCFA 12,400.00 locked in escrow vault", time: "Jan 13, 2:45 PM", type: "success" },
      { id: "3", label: "Item shipped", detail: "Jordan shipped via UPS overnight", time: "Jan 14, 9:00 AM", type: "info" },
    ],
  },
  {
    id: "ST-65001",
    title: "2021 MacBook Pro 16\" M1 Max",
    description: "Space Gray, 32GB RAM, 1TB SSD. AppleCare through March 2026. No scratches.",
    amount: 2100,
    fee: 31.5,
    status: "complete",
    myRole: "buyer",
    createdAt: "2025-01-10T09:00:00Z",
    buyer: { name: "Jordan Lee", avatar: "JL", rating: 4.9, trades: 14 },
    seller: { name: "Priya Nair", avatar: "PN", rating: 4.8, trades: 22 },
    events: [
      { id: "1", label: "Trade created", detail: "Jordan initiated the trade", time: "Jan 10, 9:00 AM", type: "info" },
      { id: "2", label: "Funds deposited", detail: "FCFA 2,100.00 locked in escrow vault", time: "Jan 10, 9:05 AM", type: "success" },
      { id: "3", label: "Item shipped", detail: "Priya shipped via FedEx", time: "Jan 11, 11:00 AM", type: "info" },
      { id: "4", label: "Delivery confirmed", detail: "Jordan confirmed receipt", time: "Jan 12, 3:00 PM", type: "success" },
      { id: "5", label: "Funds released", detail: "FCFA 2,100.00 sent to Priya", time: "Jan 12, 3:01 PM", type: "success" },
    ],
  },
];

export function getTrade(id: string): Trade | undefined {
  return DEMO_TRADES.find((t) => t.id === id);
}
