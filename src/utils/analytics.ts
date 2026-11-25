import type { BackupPayload, Transaction } from '../types/finance';

export interface SavingsSummary {
  totalBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalCount: number;
  depositCount: number;
  withdrawCount: number;
  todayNet: number;
  monthNet: number;
  averageDeposit: number;
}

export interface GrowthPoint {
  key: string;
  label: string;
  periodAmount: number;
  cumulativeAmount: number;
  count: number;
}

function toLocalDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toLocalMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function signedAmount(tx: Transaction): number {
  const amt = Number.isFinite(tx.amount) ? Math.abs(Math.round(tx.amount)) : 0;
  return tx.type === 'withdraw' ? -amt : amt;
}

export function calculateSummary(transactions: Transaction[], now: Date = new Date()): SavingsSummary {
  const todayKey = toLocalDayKey(now);
  const monthKey = toLocalMonthKey(now);

  let totalBalance = 0;
  let totalDeposited = 0;
  let totalWithdrawn = 0;
  let depositCount = 0;
  let withdrawCount = 0;
  let todayNet = 0;
  let monthNet = 0;

  for (const tx of transactions) {
    const absAmt = Number.isFinite(tx.amount) ? Math.abs(Math.round(tx.amount)) : 0;
    const delta = signedAmount(tx);
    totalBalance += delta;

    if (tx.type === 'withdraw') {
      totalWithdrawn += absAmt;
      withdrawCount += 1;
    } else {
      totalDeposited += absAmt;
      depositCount += 1;
    }

    const created = new Date(tx.createdAt);
    if (!Number.isNaN(created.getTime())) {
      if (toLocalDayKey(created) === todayKey) {
        todayNet += delta;
      }
      if (toLocalMonthKey(created) === monthKey) {
        monthNet += delta;
      }
    }
  }

  const totalCount = transactions.length;
  const averageDeposit = depositCount > 0 ? Math.round(totalDeposited / depositCount) : 0;

  return {
    totalBalance,
    totalDeposited,
    totalWithdrawn,
    totalCount,
    depositCount,
    withdrawCount,
    todayNet,
    monthNet,
    averageDeposit,
  };
}

export function buildGrowthSeries(
  transactions: Transaction[],
  granularity: 'day' | 'month',
  now: Date = new Date()
): GrowthPoint[] {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (granularity === 'day') {
    const daysCount = 14;
    const buckets = new Map<string, { label: string; periodAmount: number; count: number }>();

    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (daysCount - 1));
    for (let i = 0; i < daysCount; i += 1) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      const key = toLocalDayKey(d);
      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, { label, periodAmount: 0, count: 0 });
    }

    let baselineBeforeWindow = 0;
    const startKey = toLocalDayKey(startDate);

    for (const tx of sorted) {
      const d = new Date(tx.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = toLocalDayKey(d);
      const delta = signedAmount(tx);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.periodAmount += delta;
        bucket.count += 1;
      } else if (key < startKey) {
        baselineBeforeWindow += delta;
      }
    }

    let runningTotal = baselineBeforeWindow;
    const points: GrowthPoint[] = [];
    for (const [key, val] of buckets.entries()) {
      runningTotal += val.periodAmount;
      points.push({
        key,
        label: val.label,
        periodAmount: val.periodAmount,
        cumulativeAmount: runningTotal,
        count: val.count,
      });
    }
    return points;
  }

  const monthsCount = 6;
  const buckets = new Map<string, { label: string; periodAmount: number; count: number }>();
  const startMonth = new Date(now.getFullYear(), now.getMonth() - (monthsCount - 1), 1);

  for (let i = 0; i < monthsCount; i += 1) {
    const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
    const key = toLocalMonthKey(d);
    const label = `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
    buckets.set(key, { label, periodAmount: 0, count: 0 });
  }

  let baselineBeforeWindow = 0;
  const startKey = toLocalMonthKey(startMonth);

  for (const tx of sorted) {
    const d = new Date(tx.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = toLocalMonthKey(d);
    const delta = signedAmount(tx);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.periodAmount += delta;
      bucket.count += 1;
    } else if (key < startKey) {
      baselineBeforeWindow += delta;
    }
  }

  let runningTotal = baselineBeforeWindow;
  const points: GrowthPoint[] = [];
  for (const [key, val] of buckets.entries()) {
    runningTotal += val.periodAmount;
    points.push({
      key,
      label: val.label,
      periodAmount: val.periodAmount,
      cumulativeAmount: runningTotal,
      count: val.count,
    });
  }
  return points;
}

export function validateBackupPayload(
  raw: unknown
): { ok: true; payload: BackupPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'File sao lưu không phải là đối tượng JSON hợp lệ.' };
  }

  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.transactions)) {
    return { ok: false, error: 'Thiếu danh sách giao dịch (transactions) trong file sao lưu.' };
  }

  const sanitizedTransactions: Transaction[] = [];
  for (let i = 0; i < obj.transactions.length; i += 1) {
    const item = obj.transactions[i] as Record<string, unknown> | null;
    if (!item || typeof item !== 'object') {
      return { ok: false, error: `Giao dịch thứ ${i + 1} không hợp lệ.` };
    }
    const amount = Number(item.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: `Số tiền ở giao dịch thứ ${i + 1} không hợp lệ.` };
    }
    const type = item.type === 'withdraw' ? 'withdraw' : 'deposit';
    const method = item.method === 'camera' && type === 'deposit' ? 'camera' : 'manual';
    const createdAt =
      typeof item.createdAt === 'string' && !Number.isNaN(new Date(item.createdAt).getTime())
        ? item.createdAt
        : new Date().toISOString();

    sanitizedTransactions.push({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `restored-${Date.now()}-${i}`,
      type,
      method,
      amount: Math.round(amount),
      serialNumber:
        typeof item.serialNumber === 'string' && item.serialNumber.trim()
          ? item.serialNumber.trim().toUpperCase()
          : undefined,
      confidence:
        typeof item.confidence === 'number' && Number.isFinite(item.confidence)
          ? Math.max(0, Math.min(1, item.confidence))
          : undefined,
      note: typeof item.note === 'string' ? item.note : '',
      createdAt,
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : undefined,
    });
  }

  const rawGoal = obj.goal as Record<string, unknown> | undefined;
  const targetAmount =
    rawGoal && Number.isFinite(Number(rawGoal.targetAmount)) && Number(rawGoal.targetAmount) > 0
      ? Math.round(Number(rawGoal.targetAmount))
      : 10_000_000;
  const label =
    rawGoal && typeof rawGoal.label === 'string' && rawGoal.label.trim()
      ? rawGoal.label.trim()
      : 'Mục tiêu tiết kiệm';

  return {
    ok: true,
    payload: {
      version: typeof obj.version === 'number' ? obj.version : 2,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
      goal: { targetAmount, label },
      transactions: sanitizedTransactions,
    },
  };
}
