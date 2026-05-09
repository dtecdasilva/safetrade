import { Trade } from './types';

export const MOCK_USER = {
  id: 'user-1',
  name: 'Jordan Lee',
  email: 'jordan@example.com',
};

export const MOCK_TRADES: Trade[] = [
  {
    id: 'ST-88213',
    title: 'Sony A7 IV Camera',
    description: 'Like new, only used 3 times. Comes with original box, 2 batteries, charger, and 64GB SD card. No scratches on sensor or body.',
    amount: 1850,
    fee: 27.75,
    status: 'funded',
    buyer: { id: 'user-1', name: 'Jordan Lee', email: 'jordan@example.com' },
    seller: { id: 'user-2', name: 'Maria Reyes', email: 'maria@example.com' },
    createdAt: '2025-04-30T10:12:00Z',
    updatedAt: '2025-04-30T10:12:00Z',
    events: [
      {
        id: 'ev-1',
        type: 'created',
        label: 'Trade created',
        description: 'Jordan created the trade and invited Maria as seller',
        timestamp: '2025-04-30T10:12:00Z',
        actor: 'Jordan Lee',
      },
      {
        id: 'ev-2',
        type: 'funded',
        label: 'Escrow funded',
        description: '$1,850.00 locked into SafeTrade escrow vault',
        timestamp: '2025-04-30T10:14:00Z',
        actor: 'Jordan Lee',
      },
    ],
  },
  {
    id: 'ST-76541',
    title: 'MacBook Pro 16" M3 Pro',
    description: '16" MacBook Pro, M3 Pro chip, 36GB RAM, 512GB SSD. Space Black. AppleCare+ until 2026.',
    amount: 2400,
    fee: 36,
    status: 'shipped',
    buyer: { id: 'user-3', name: 'Alex Osei', email: 'alex@example.com' },
    seller: { id: 'user-1', name: 'Jordan Lee', email: 'jordan@example.com' },
    trackingNumber: '1Z9999W99999999999',
    trackingCarrier: 'UPS',
    createdAt: '2025-04-28T09:00:00Z',
    updatedAt: '2025-04-29T14:30:00Z',
    events: [
      {
        id: 'ev-3',
        type: 'created',
        label: 'Trade created',
        description: 'Alex created the trade and invited Jordan as seller',
        timestamp: '2025-04-28T09:00:00Z',
        actor: 'Alex Osei',
      },
      {
        id: 'ev-4',
        type: 'funded',
        label: 'Escrow funded',
        description: '$2,400.00 locked into SafeTrade escrow vault',
        timestamp: '2025-04-28T09:22:00Z',
        actor: 'Alex Osei',
      },
      {
        id: 'ev-5',
        type: 'shipped',
        label: 'Item shipped',
        description: 'Jordan marked item as shipped via UPS · 1Z9999W99999999999',
        timestamp: '2025-04-29T14:30:00Z',
        actor: 'Jordan Lee',
      },
    ],
  },
  {
    id: 'ST-65102',
    title: 'Vintage Rolex Submariner',
    description: '1970s Submariner, all original, serviced 2023. Box and papers included.',
    amount: 8500,
    fee: 127.5,
    status: 'complete',
    buyer: { id: 'user-1', name: 'Jordan Lee', email: 'jordan@example.com' },
    seller: { id: 'user-4', name: 'Sophie Müller', email: 'sophie@example.com' },
    createdAt: '2025-04-20T08:00:00Z',
    updatedAt: '2025-04-25T16:00:00Z',
    events: [
      {
        id: 'ev-6', type: 'created', label: 'Trade created',
        description: 'Jordan created the trade', timestamp: '2025-04-20T08:00:00Z', actor: 'Jordan Lee',
      },
      {
        id: 'ev-7', type: 'funded', label: 'Escrow funded',
        description: '$8,500.00 locked into escrow', timestamp: '2025-04-20T08:30:00Z', actor: 'Jordan Lee',
      },
      {
        id: 'ev-8', type: 'shipped', label: 'Item shipped',
        description: 'Sophie shipped via FedEx', timestamp: '2025-04-22T10:00:00Z', actor: 'Sophie Müller',
      },
      {
        id: 'ev-9', type: 'delivered', label: 'Delivery confirmed',
        description: 'Jordan confirmed receipt', timestamp: '2025-04-25T15:45:00Z', actor: 'Jordan Lee',
      },
      {
        id: 'ev-10', type: 'released', label: 'Funds released',
        description: '$8,500.00 sent to Sophie', timestamp: '2025-04-25T15:45:00Z', actor: 'System',
      },
    ],
    escrowReleased: true,
  },
  {
    id: 'ST-59871',
    title: 'iPhone 15 Pro Max 256GB',
    description: 'Natural Titanium, 256GB. Bought in Dec 2024. Excellent condition, no cracks.',
    amount: 950,
    fee: 14.25,
    status: 'disputed',
    buyer: { id: 'user-1', name: 'Jordan Lee', email: 'jordan@example.com' },
    seller: { id: 'user-5', name: 'Kwame Asante', email: 'kwame@example.com' },
    createdAt: '2025-04-15T12:00:00Z',
    updatedAt: '2025-04-19T11:00:00Z',
    events: [
      {
        id: 'ev-11', type: 'created', label: 'Trade created',
        description: 'Jordan created trade', timestamp: '2025-04-15T12:00:00Z', actor: 'Jordan Lee',
      },
      {
        id: 'ev-12', type: 'funded', label: 'Escrow funded',
        description: '$950.00 locked', timestamp: '2025-04-15T12:10:00Z', actor: 'Jordan Lee',
      },
      {
        id: 'ev-13', type: 'shipped', label: 'Item shipped',
        description: 'Kwame shipped via DHL', timestamp: '2025-04-16T09:00:00Z', actor: 'Kwame Asante',
      },
      {
        id: 'ev-14', type: 'disputed', label: 'Dispute opened',
        description: 'Jordan reported item does not match description — screen has cracks',
        timestamp: '2025-04-19T11:00:00Z', actor: 'Jordan Lee',
      },
    ],
    disputeReason: 'Item received does not match listing description. Screen has visible cracks not mentioned by seller.',
  },
];

export function getTradeById(id: string): Trade | undefined {
  return MOCK_TRADES.find(t => t.id === id);
}

export function getMyTrades(userId: string): Trade[] {
  return MOCK_TRADES.filter(t => t.buyer.id === userId || t.seller.id === userId);
}
