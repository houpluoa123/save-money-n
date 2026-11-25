import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Camera, Check, PenLine, Search, Trash2, X } from 'lucide-react';
import type { DepositMethod, Transaction, TransactionType } from '../types/finance';
import { formatVND, parseVNDInput } from '../utils/currency';

interface HistoryViewProps {
  transactions: Transaction[];
  onEditTransaction: (
    id: string,
    updates: { type: TransactionType; method: DepositMethod; amount: number; serialNumber?: string; note: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  onDeleteTransaction: (id: string) => Promise<void>;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  transactions,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'deposit' | 'withdraw' | 'camera'>('all');

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editSerial, setEditSerial] = useState('');
  const [editType, setEditType] = useState<TransactionType>('deposit');
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...transactions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((tx) => {
        if (filterMode === 'deposit' && tx.type !== 'deposit') return false;
        if (filterMode === 'withdraw' && tx.type !== 'withdraw') return false;
        if (filterMode === 'camera' && tx.method !== 'camera') return false;
        if (!q) return true;
        const hay = `${tx.note} ${tx.amount} ${tx.serialNumber ?? ''}`.toLowerCase();
        return hay.includes(q);
      });
  }, [transactions, search, filterMode]);

  const filteredNet = useMemo(
    () =>
      filtered.reduce(
        (sum, tx) => sum + (tx.type === 'withdraw' ? -tx.amount : tx.amount),
        0
      ),
    [filtered]
  );

  const startEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setEditAmount(String(tx.amount));
    setEditNote(tx.note);
    setEditSerial(tx.serialNumber ?? '');
    setEditType(tx.type);
    setEditError('');
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || savingEdit) return;
    const parsed = parseVNDInput(editAmount);
    if (parsed <= 0) {
      setEditError('Số tiền phải lớn hơn 0.');
      return;
    }
    setSavingEdit(true);
    try {
      const res = await onEditTransaction(editingTx.id, {
        type: editType,
        method: editType === 'withdraw' ? 'manual' : editingTx.method,
        amount: parsed,
        serialNumber: editType === 'deposit' && editSerial.trim() ? editSerial.trim().toUpperCase() : undefined,
        note: editNote.trim(),
      });
      if (!res.ok) {
        setEditError(res.error || 'Không thể cập nhật giao dịch.');
        return;
      }
      setEditingTx(null);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Lịch sử giao dịch</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
            {filtered.length} giao dịch · Tổng ròng lọc: {formatVND(filteredNet)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl" role="tablist" aria-label="Lọc theo loại giao dịch">
          {(
            [
              { id: 'all', label: 'Tất cả' },
              { id: 'deposit', label: 'Nạp vào' },
              { id: 'withdraw', label: 'Rút ra' },
              { id: 'camera', label: 'Quét Camera' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filterMode === tab.id}
              onClick={() => setFilterMode(tab.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                filterMode === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          aria-label="Tìm kiếm giao dịch theo ghi chú, số seri hoặc số tiền"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo ghi chú, số seri hoặc số tiền..."
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
        />
      </div>

      {editingTx && (
        <form
          onSubmit={handleSaveEdit}
          className="bg-white border border-emerald-300 rounded-2xl p-5 space-y-4 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Chỉnh sửa giao dịch</h3>
            <button
              type="button"
              onClick={() => setEditingTx(null)}
              aria-label="Đóng chỉnh sửa"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="edit-amount" className="block text-xs font-medium text-slate-700 mb-1">
                Số tiền (VNĐ)
              </label>
              <input
                id="edit-amount"
                type="text"
                inputMode="numeric"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value.replace(/[^\d]/g, ''))}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono text-sm text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="edit-type" className="block text-xs font-medium text-slate-700 mb-1">
                Loại giao dịch
              </label>
              <select
                id="edit-type"
                value={editType}
                onChange={(e) => setEditType(e.target.value as TransactionType)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
              >
                <option value="deposit">Nạp tiết kiệm</option>
                <option value="withdraw">Rút tiết kiệm</option>
              </select>
            </div>

            <div>
              <label htmlFor="edit-serial" className="block text-xs font-medium text-slate-700 mb-1">
                Số Seri (tùy chọn)
              </label>
              <input
                id="edit-serial"
                type="text"
                value={editSerial}
                disabled={editType === 'withdraw'}
                onChange={(e) => setEditSerial(e.target.value.toUpperCase())}
                placeholder="AB12345678"
                className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono text-sm text-slate-900 uppercase disabled:bg-slate-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-note" className="block text-xs font-medium text-slate-700 mb-1">
              Ghi chú
            </label>
            <input
              id="edit-note"
              type="text"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm text-slate-900"
            />
          </div>

          {editError && (
            <p role="alert" className="text-xs text-red-700 font-medium">
              {editError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingTx(null)}
              className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 px-4 text-center text-sm text-slate-500">
            Không tìm thấy giao dịch nào phù hợp.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((tx) => {
              const isWithdraw = tx.type === 'withdraw';
              const isCamera = !isWithdraw && tx.method === 'camera';
              return (
                <div
                  key={tx.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      {isWithdraw ? (
                        <ArrowDownLeft className="w-4 h-4 text-amber-700" aria-hidden="true" />
                      ) : isCamera ? (
                        <Camera className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {tx.note || (isWithdraw ? 'Rút tiết kiệm' : isCamera ? 'Quét tờ tiền Camera AI' : 'Nạp tiết kiệm')}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-1.5">
                        <span>{isWithdraw ? 'Rút ra' : isCamera ? 'Quét Camera' : 'Nhập tay'}</span>
                        {tx.serialNumber && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-slate-700">Seri: {tx.serialNumber}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(tx.createdAt).toLocaleString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span
                      className={`font-mono tabular-nums text-base font-bold whitespace-nowrap ${
                        isWithdraw ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {isWithdraw ? '-' : '+'}
                      {formatVND(tx.amount)}
                    </span>

                    {confirmDeleteId === tx.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            void onDeleteTransaction(tx.id);
                            setConfirmDeleteId(null);
                          }}
                          className="min-h-[38px] px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                        >
                          Xác nhận xóa
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[38px] px-2.5 rounded-lg border border-slate-300 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(tx)}
                          aria-label={`Sửa giao dịch ${formatVND(tx.amount)}`}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        >
                          <PenLine className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(tx.id)}
                          aria-label={`Xóa giao dịch ${formatVND(tx.amount)}`}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
