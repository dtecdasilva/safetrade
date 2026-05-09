import { TradeStatus } from './types';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function getStatusLabel(status: TradeStatus): string {
  const labels: Record<TradeStatus, string> = {
    pending_payment: 'Pending payment',
    funded: 'Funds held',
    shipped: 'Shipped',
    delivered: 'Delivered',
    complete: 'Complete',
    disputed: 'Disputed',
    cancelled: 'Cancelled',
  };
  return labels[status];
}

export function getStatusColors(status: TradeStatus): string {
  switch (status) {
    case 'complete': return 'bg-brand-50 text-brand-700';
    case 'funded': return 'bg-blue-50 text-blue-700';
    case 'shipped': return 'bg-amber-50 text-amber-700';
    case 'delivered': return 'bg-teal-50 text-teal-700';
    case 'disputed': return 'bg-red-50 text-red-700';
    case 'cancelled': return 'bg-gray-100 text-gray-600';
    default: return 'bg-gray-100 text-gray-600';
  }
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function getTradeProgress(status: TradeStatus): number {
  const map: Record<TradeStatus, number> = {
    pending_payment: 0,
    funded: 1,
    shipped: 2,
    delivered: 3,
    complete: 4,
    disputed: 2,
    cancelled: 0,
  };
  return map[status];
}
