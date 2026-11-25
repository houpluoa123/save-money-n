export const QUICK_DENOMINATIONS = [10000, 20000, 50000, 100000, 200000, 500000] as const;

const vndFormatter = new Intl.NumberFormat('vi-VN');

export function formatVND(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '0 ₫';
  }
  const rounded = Math.round(amount);
  return `${vndFormatter.format(rounded)} ₫`;
}

export function formatCompactVND(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) {
    return '0 ₫';
  }
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '').replace('.', ',')} Tỷ`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '').replace('.', ',')} Tr`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)}k`;
  }
  return `${sign}${Math.round(abs)} ₫`;
}

export function parseVNDInput(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) {
    return 0;
  }
  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.min(parsed, 100_000_000_000);
}
