export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN');
}

export function generateQuoteNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `QT-${y}${m}${d}-${seq}`;
}

export function calcSubtotal(price: number, qty: number, discountPercent: number): number {
  return price * qty * (1 - discountPercent / 100);
}

export function calcTax(amount: number, taxRate: number): number {
  return amount * taxRate / 100;
}

export function calcProfit(saleAmount: number, costAmount: number): number {
  return saleAmount - costAmount;
}

export function calcProfitRate(saleAmount: number, costAmount: number): number {
  if (saleAmount === 0) return 0;
  return (saleAmount - costAmount) / saleAmount;
}

export function isInRange(dateStr: string, filter: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  switch (filter) {
    case 'today':
      return d.toDateString() === now.toDateString();
    case 'week': {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      return d >= weekStart;
    }
    case 'month':
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    case 'quarter': {
      const qtr = Math.floor(now.getMonth() / 3);
      return d.getFullYear() === now.getFullYear() && Math.floor(d.getMonth() / 3) === qtr;
    }
    default:
      return true;
  }
}
