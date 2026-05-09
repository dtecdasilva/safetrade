export type TradeStatus =
  | 'pending_payment'
  | 'funded'
  | 'shipped'
  | 'delivered'
  | 'complete'
  | 'disputed'
  | 'cancelled';

export interface TradeParty {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface TradeEvent {
  id: string;
  type: 'created' | 'funded' | 'shipped' | 'delivered' | 'released' | 'disputed' | 'cancelled' | 'message';
  label: string;
  description: string;
  timestamp: string;
  actor?: string;
}

export interface Trade {
  id: string;
  title: string;
  description: string;
  amount: number;
  fee: number;
  status: TradeStatus;
  buyer: TradeParty;
  seller: TradeParty;
  trackingNumber?: string;
  trackingCarrier?: string;
  createdAt: string;
  updatedAt: string;
  events: TradeEvent[];
  escrowReleased?: boolean;
  disputeReason?: string;
}
