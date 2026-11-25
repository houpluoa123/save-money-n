import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCompactVND, formatVND, parseVNDInput } from './currency';
import { buildGrowthSeries, calculateSummary, validateBackupPayload } from './analytics';
import { findDuplicateSerial, normalizeSerial } from './serial';
import type { Transaction } from '../types/finance';

test('currency formatting produces standard Vietnamese VND strings', () => {
  assert.equal(formatVND(1500000), '1.500.000 ₫');
  assert.equal(formatVND(50000), '50.000 ₫');
  assert.equal(formatVND(0), '0 ₫');
  assert.equal(formatCompactVND(1500000), '1,5 Tr');
  assert.equal(formatCompactVND(200000), '200k');
  assert.equal(parseVNDInput('500.000 đ'), 500000);
});

test('serial normalization and duplicate detection ignores formatting differences and withdrawals', () => {
  assert.equal(normalizeSerial('ab 1234-5678'), 'AB12345678');

  const existing: Transaction[] = [
    {
      id: 'tx-1',
      type: 'deposit',
      method: 'camera',
      amount: 500000,
      serialNumber: 'AA 12345678',
      createdAt: '2026-11-24T01:00:00.000Z',
      note: 'Quét camera',
    },
    {
      id: 'tx-2',
      type: 'withdraw',
      method: 'manual',
      amount: 100000,
      serialNumber: 'WW99999999',
      createdAt: '2026-11-24T02:00:00.000Z',
      note: 'Rút tiền',
    },
  ];

  const dup = findDuplicateSerial('aa-1234 5678', existing);
  assert.equal(dup?.id, 'tx-1');
  assert.equal(findDuplicateSerial('aa-1234 5678', existing, 'tx-1'), undefined);
  assert.equal(findDuplicateSerial('WW99999999', existing), undefined);
  assert.equal(findDuplicateSerial('BB99999999', existing), undefined);
});

test('summary and growth series compute deposit and withdrawal net balances accurately', () => {
  const now = new Date(2026, 10, 24, 12, 0, 0);
  const txs: Transaction[] = [
    {
      id: '1',
      type: 'deposit',
      method: 'manual',
      amount: 200000,
      note: 'Tháng trước',
      createdAt: new Date(2026, 9, 15, 10, 0, 0).toISOString(),
    },
    {
      id: '2',
      type: 'deposit',
      method: 'camera',
      amount: 500000,
      serialNumber: 'XY88888888',
      note: 'Hôm qua',
      createdAt: new Date(2026, 10, 23, 9, 0, 0).toISOString(),
    },
    {
      id: '3',
      type: 'withdraw',
      method: 'manual',
      amount: 100000,
      note: 'Chi tiêu hôm nay',
      createdAt: new Date(2026, 10, 24, 11, 0, 0).toISOString(),
    },
  ];

  const summary = calculateSummary(txs, now);
  assert.equal(summary.totalBalance, 600000);
  assert.equal(summary.totalDeposited, 700000);
  assert.equal(summary.totalWithdrawn, 100000);
  assert.equal(summary.depositCount, 2);
  assert.equal(summary.withdrawCount, 1);
  assert.equal(summary.todayNet, -100000);
  assert.equal(summary.monthNet, 400000);
  assert.equal(summary.averageDeposit, 350000);

  const daily = buildGrowthSeries(txs, 'day', now);
  assert.equal(daily.length, 14);
  assert.equal(daily[daily.length - 1].cumulativeAmount, 600000);
  assert.equal(daily[daily.length - 1].periodAmount, -100000);
  assert.equal(daily[daily.length - 2].periodAmount, 500000);

  const monthly = buildGrowthSeries(txs, 'month', now);
  assert.equal(monthly.length, 6);
  assert.equal(monthly[monthly.length - 1].cumulativeAmount, 600000);
  assert.equal(monthly[monthly.length - 1].periodAmount, 400000);
});

test('backup payload validator rejects malformed JSON and preserves camera metadata', () => {
  const bad = validateBackupPayload({ foo: 'bar' });
  assert.equal(bad.ok, false);

  const good = validateBackupPayload({
    version: 2,
    exportedAt: '2026-11-24T00:00:00.000Z',
    goal: { targetAmount: 20000000, label: 'Quỹ dự phòng' },
    transactions: [
      {
        id: 'a1',
        type: 'deposit',
        method: 'camera',
        serialNumber: 'ab 123456',
        confidence: 0.96,
        amount: 500000,
        note: 'Quét tờ 500k',
        createdAt: '2026-11-24T01:00:00.000Z',
      },
      {
        id: 'a2',
        type: 'withdraw',
        method: 'manual',
        amount: 100000,
        note: 'Mua sách',
        createdAt: '2026-11-24T02:00:00.000Z',
      },
    ],
  });
  assert.equal(good.ok, true);
  if (good.ok) {
    assert.equal(good.payload.transactions.length, 2);
    assert.equal(good.payload.transactions[0].method, 'camera');
    assert.equal(good.payload.transactions[0].serialNumber, 'AB 123456');
    assert.equal(good.payload.transactions[1].type, 'withdraw');
    assert.equal(good.payload.goal.targetAmount, 20000000);
  }
});
