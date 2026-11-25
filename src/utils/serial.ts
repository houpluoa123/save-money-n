import type { Transaction } from '../types/finance';

export function normalizeSerial(serial: string): string {
  return serial
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

export function findDuplicateSerial(
  serialInput: string,
  transactions: Transaction[],
  excludeTransactionId?: string
): Transaction | undefined {
  const normalized = normalizeSerial(serialInput);
  if (!normalized) return undefined;

  return transactions.find((tx) => {
    if (excludeTransactionId && tx.id === excludeTransactionId) return false;
    if (tx.type === 'withdraw') return false;
    if (!tx.serialNumber) return false;
    return normalizeSerial(tx.serialNumber) === normalized;
  });
}
