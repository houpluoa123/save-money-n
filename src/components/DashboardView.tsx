import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Edit3, MessageSquareText, Plus } from 'lucide-react';
import type { AppTab, SavingsGoal, Transaction } from '../types/finance';
import { buildGrowthSeries, calculateSummary } from '../utils/analytics';
import { formatVND, parseVNDInput } from '../utils/currency';
import { GrowthChart } from './GrowthChart';

interface DashboardViewProps {
  displayName: string;
  canUseChat: boolean;
  transactions: Transaction[];
  goal: SavingsGoal;
  onUpdateGoal: (goal: SavingsGoal) => Promise<void>;
  onNavigate: (tab: AppTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  displayName,
  canUseChat,
  transactions,
  goal,
  onUpdateGoal,
  onNavigate,
}) => {
  const [granularity, setGranularity] = useState<'day' | 'month'>('day');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalAmountInput, setGoalAmountInput] = useState(String(goal.targetAmount));
  const [goalLabelInput, setGoalLabelInput] = useState(goal.label);
  const [savingGoal, setSavingGoal] = useState(false);

  const summary = useMemo(() => calculateSummary(transactions), [transactions]);
  const series = useMemo(
    () => buildGrowthSeries(transactions, granularity),
    [transactions, granularity]
  );

  const goalProgress =
    goal.targetAmount > 0
      ? Math.max(0, Math.min(100, Math.round((summary.totalBalance / goal.targetAmount) * 100)))
      : 0;

  const recentTxs = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [transactions]
  );

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseVNDInput(goalAmountInput);
    if (parsedAmount <= 0 || savingGoal) return;
    setSavingGoal(true);
    try {
      await onUpdateGoal({
        targetAmount: parsedAmount,
        label: goalLabelInput.trim() || 'Quỹ tiết kiệm cá nhân',
      });
      setEditingGoal(false);
    } finally {
      setSavingGoal(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Xin chào, {displayName}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tổng hợp số dư tiết kiệm được đồng bộ trực tiếp trong cơ sở dữ liệu
          </p>
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 bg-slate-900 text-white rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <p className="text-sm text-slate-300 font-medium">Số dư tiết kiệm hiện tại</p>
            <p
              data-testid="total-balance"
              className="mt-2 text-3xl sm:text-4xl font-bold font-mono tabular-nums tracking-tight text-white"
            >
              {formatVND(summary.totalBalance)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
              <span>{summary.totalCount} giao dịch</span>
              <span aria-hidden="true">·</span>
              <span>Nạp: {formatVND(summary.totalDeposited)}</span>
              <span aria-hidden="true">·</span>
              <span>Rút: {formatVND(summary.totalWithdrawn)}</span>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800">
            <div className="flex items-center justify-between gap-2 text-xs mb-2">
              <span className="text-slate-300 truncate">{goal.label}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono tabular-nums text-emerald-400 font-medium">
                  {goalProgress}% · {formatVND(goal.targetAmount)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setGoalAmountInput(String(goal.targetAmount));
                    setGoalLabelInput(goal.label);
                    setEditingGoal((prev) => !prev);
                  }}
                  aria-label="Chỉnh sửa mục tiêu tiết kiệm"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${goalProgress}%` }}
              />
            </div>

            {editingGoal && (
              <form onSubmit={handleSaveGoal} className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  type="text"
                  aria-label="Tên mục tiêu"
                  value={goalLabelInput}
                  onChange={(e) => setGoalLabelInput(e.target.value)}
                  placeholder="Tên mục tiêu"
                  className="sm:col-span-5 h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Số tiền mục tiêu VNĐ"
                  value={goalAmountInput}
                  onChange={(e) => setGoalAmountInput(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="10000000"
                  className="sm:col-span-4 h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={savingGoal}
                  className="sm:col-span-3 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingGoal ? 'Đang lưu...' : 'Lưu'}</span>
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-500">Biến động hôm nay</span>
            <p
              className={`mt-3 text-xl sm:text-2xl font-bold font-mono tabular-nums ${
                summary.todayNet < 0 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {summary.todayNet > 0 ? `+${formatVND(summary.todayNet)}` : formatVND(summary.todayNet)}
            </p>
            <span className="mt-2 text-xs text-slate-500">Trong ngày hôm nay</span>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-500">Biến động tháng này</span>
            <p
              className={`mt-3 text-xl sm:text-2xl font-bold font-mono tabular-nums ${
                summary.monthNet < 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {summary.monthNet > 0 ? `+${formatVND(summary.monthNet)}` : formatVND(summary.monthNet)}
            </p>
            <span className="mt-2 text-xs text-slate-500">
              Trung bình nạp{' '}
              <span className="font-mono tabular-nums whitespace-nowrap">
                {formatVND(summary.averageDeposit)}/lần
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('entry')}
            className="col-span-2 min-h-[56px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-4 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold">Ghi chép Nạp / Rút tiết kiệm</p>
                <p className="text-xs text-emerald-100">Chọn nhanh mệnh giá hoặc nhập số tiền VNĐ</p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Biểu đồ tăng trưởng tiết kiệm</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi xu hướng tích lũy số dư theo ngày hoặc theo tháng
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl" role="tablist" aria-label="Chế độ xem biểu đồ">
            <button
              type="button"
              role="tab"
              aria-selected={granularity === 'day'}
              onClick={() => setGranularity('day')}
              className={`min-h-[36px] px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                granularity === 'day'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Theo ngày
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={granularity === 'month'}
              onClick={() => setGranularity('month')}
              className={`min-h-[36px] px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                granularity === 'month'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Theo tháng
            </button>
          </div>
        </div>

        <GrowthChart points={series} granularity={granularity} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className={`${canUseChat ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-semibold text-slate-900">Giao dịch gần đây</h2>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="min-h-[36px] px-2 text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap cursor-pointer"
            >
              Xem tất cả
            </button>
          </div>

          {recentTxs.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-600">Chưa có giao dịch tiết kiệm nào trong tài khoản của bạn.</p>
              <button
                type="button"
                onClick={() => onNavigate('entry')}
                className="mt-3 min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Tạo giao dịch đầu tiên
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTxs.map((tx) => {
                const isWithdraw = tx.type === 'withdraw';
                return (
                  <div key={tx.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        {isWithdraw ? (
                          <ArrowDownLeft className="w-4 h-4 text-amber-700" aria-hidden="true" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {tx.note || (isWithdraw ? 'Rút tiết kiệm' : 'Nạp tiết kiệm')}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {isWithdraw ? 'Rút ra' : tx.method === 'camera' ? 'Quét Camera' : 'Nạp vào'}
                          {tx.serialNumber ? ` · ${tx.serialNumber}` : ''}
                          <span aria-hidden="true"> · </span>
                          {new Date(tx.createdAt).toLocaleString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-mono tabular-nums text-sm font-semibold whitespace-nowrap shrink-0 ${
                        isWithdraw ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {isWithdraw ? '-' : '+'}
                      {formatVND(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {canUseChat && (
          <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <MessageSquareText className="w-5 h-5" aria-hidden="true" />
              </div>
              <h2 className="text-base font-semibold text-slate-900">Trợ lý AI Tài chính</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tư vấn kế hoạch tiết kiệm, phân bổ quỹ dự phòng và đạt mục tiêu dựa trực tiếp trên số dư VNĐ hiện tại của bạn.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('advisor')}
              className="mt-6 min-h-[44px] w-full rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <MessageSquareText className="w-4 h-4" aria-hidden="true" />
              <span>Hỏi Trợ lý Tài chính</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
