import React, { useRef, useState } from 'react';
import {
  Download,
  KeyRound,
  Lock,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import type { AppTab, AuthUser, BackupPayload, SavingsGoal, Transaction } from '../types/finance';
import { validateBackupPayload } from '../utils/analytics';
import { formatVND } from '../utils/currency';

interface SettingsViewProps {
  currentUser: AuthUser;
  onChangePassword: (oldPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  transactions: Transaction[];
  goal: SavingsGoal;
  onRestoreBackup: (payload: BackupPayload, mode: 'replace' | 'merge') => Promise<{ ok: boolean; error?: string }>;
  onResetAllData: () => Promise<void>;
  onNavigate?: (tab: AppTab) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onChangePassword,
  transactions,
  goal,
  onRestoreBackup,
  onResetAllData,
  onNavigate,
}) => {
  // Change password state
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Backup/Restore state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupPayload | null>(null);
  const [importingBackup, setImportingBackup] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Reset confirmation
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPw) return;
    setPwMsg(null);
    if (!oldPw || !newPw || !confirmPw) {
      setPwMsg({ type: 'err', text: 'Vui lòng điền đủ 3 trường mật khẩu.' });
      return;
    }
    if (newPw.length < 6) {
      setPwMsg({ type: 'err', text: 'Mật khẩu mới cần tối thiểu 6 ký tự.' });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'err', text: 'Xác nhận mật khẩu mới chưa khớp.' });
      return;
    }
    setSavingPw(true);
    try {
      const res = await onChangePassword(oldPw, newPw);
      if (!res.ok) {
        setPwMsg({ type: 'err', text: res.error || 'Đổi mật khẩu thất bại.' });
        return;
      }
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
      setPwMsg({ type: 'ok', text: 'Đã cập nhật mật khẩu mới vào cơ sở dữ liệu.' });
    } finally {
      setSavingPw(false);
    }
  };

  const handleExportJson = () => {
    const payload: BackupPayload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      goal,
      transactions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `so-tiet-kiem-${currentUser.username}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setBackupMsg({
      type: 'ok',
      text: `Đã xuất file sao lưu JSON gồm ${transactions.length} giao dịch.`,
    });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setBackupMsg(null);
    setPendingBackup(null);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const validated = validateBackupPayload(parsed);
        if (!validated.ok) {
          setBackupMsg({ type: 'err', text: validated.error });
          return;
        }
        setPendingBackup(validated.payload);
      } catch {
        setBackupMsg({ type: 'err', text: 'File không đúng định dạng JSON.' });
      }
    };
    reader.readAsText(file);
  };

  const applyBackup = async (mode: 'replace' | 'merge') => {
    if (!pendingBackup || importingBackup) return;
    setImportingBackup(true);
    setBackupMsg(null);
    try {
      const res = await onRestoreBackup(pendingBackup, mode);
      if (!res.ok) {
        setBackupMsg({ type: 'err', text: res.error || 'Khôi phục thất bại.' });
        return;
      }
      setPendingBackup(null);
      setBackupMsg({
        type: 'ok',
        text:
          mode === 'replace'
            ? 'Đã khôi phục (ghi đè) toàn bộ dữ liệu vào cơ sở dữ liệu.'
            : 'Đã gộp thêm các giao dịch từ bản sao lưu vào cơ sở dữ liệu.',
      });
    } finally {
      setImportingBackup(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Cài đặt cá nhân &amp; Sao lưu</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Đổi mật khẩu tài khoản và sao lưu / khôi phục dữ liệu trong cơ sở dữ liệu
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Thông tin tài khoản</h3>
              <p className="text-xs text-slate-500">Toàn bộ dữ liệu được lưu trực tiếp trên cơ sở dữ liệu Turso</p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Tên hiển thị</span>
              <span className="font-semibold text-slate-900">{currentUser.displayName}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Tên đăng nhập</span>
              <span className="font-mono font-semibold text-slate-900">@{currentUser.username}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Vai trò</span>
              <span className="font-semibold text-emerald-700">
                {currentUser.role === 'admin' ? 'Quản trị viên (Admin)' : 'Người dùng'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Quét Camera AI</span>
              <span className="font-medium text-slate-800">
                {currentUser.canUseCamera ? 'Đang được bật' : 'Tắt (do Admin quản lý)'}
              </span>
            </div>
          </div>

          {currentUser.role === 'admin' && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              <span>Mở Quản trị (Tạo tài khoản, AI &amp; Camera)</span>
            </button>
          )}
        </div>

        <form
          onSubmit={handlePasswordSubmit}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-slate-700" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Đổi mật khẩu tài khoản</h3>
              <p className="text-xs text-slate-500">Mật khẩu được mã hóa scrypt an toàn trên máy chủ</p>
            </div>
          </div>

          <div>
            <label htmlFor="settings-old-pw" className="block text-xs font-medium text-slate-700 mb-1.5">
              Mật khẩu cũ
            </label>
            <input
              id="settings-old-pw"
              type="password"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="settings-new-pw" className="block text-xs font-medium text-slate-700 mb-1.5">
              Mật khẩu mới
            </label>
            <input
              id="settings-new-pw"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="settings-confirm-pw" className="block text-xs font-medium text-slate-700 mb-1.5">
              Xác nhận mật khẩu mới
            </label>
            <input
              id="settings-confirm-pw"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900"
            />
          </div>

          {pwMsg && (
            <p
              role="alert"
              className={`text-xs font-medium ${pwMsg.type === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}
            >
              {pwMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={savingPw}
            className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <KeyRound className="w-4 h-4" aria-hidden="true" />
            <span>{savingPw ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}</span>
          </button>
        </form>
      </div>

      <section className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Sao lưu &amp; Khôi phục dữ liệu (JSON)</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Xuất file JSON để lưu trữ dự phòng hoặc nhập lại vào tài khoản của bạn trên cơ sở dữ liệu
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExportJson}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Xuất sao lưu JSON ({transactions.length} giao dịch)</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            <span>Nhập file JSON khôi phục</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
            aria-label="Chọn file sao lưu JSON"
          />
        </div>

        {pendingBackup && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <p className="text-xs text-slate-800 font-medium">
              File hợp lệ: <span className="font-mono font-bold">{pendingBackup.transactions.length}</span> giao dịch · Tổng ròng{' '}
              <span className="font-mono font-bold text-emerald-700">
                {formatVND(
                  pendingBackup.transactions.reduce(
                    (s, t) => s + (t.type === 'withdraw' ? -t.amount : t.amount),
                    0
                  )
                )}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={importingBackup}
                onClick={() => void applyBackup('replace')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
              >
                Ghi đè toàn bộ dữ liệu hiện tại
              </button>
              <button
                type="button"
                disabled={importingBackup}
                onClick={() => void applyBackup('merge')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-800 text-xs font-semibold cursor-pointer"
              >
                Gộp thêm giao dịch chưa có
              </button>
              <button
                type="button"
                onClick={() => setPendingBackup(null)}
                className="min-h-[40px] px-3 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Hủy
              </button>
            </div>
          </div>
        )}

        {backupMsg && (
          <p
            role="status"
            className={`text-xs font-medium ${backupMsg.type === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}
          >
            {backupMsg.text}
          </p>
        )}

        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Xóa toàn bộ lịch sử giao dịch và đưa mục tiêu tài khoản này về mặc định trong cơ sở dữ liệu.
          </p>
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={resetting}
                onClick={async () => {
                  setResetting(true);
                  try {
                    await onResetAllData();
                    setConfirmReset(false);
                    setBackupMsg({
                      type: 'ok',
                      text: 'Đã xóa toàn bộ giao dịch và đưa mục tiêu tài khoản này về mặc định.',
                    });
                  } finally {
                    setResetting(false);
                  }
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
              >
                {resetting ? 'Đang xóa...' : 'Xác nhận xóa sạch'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 cursor-pointer"
              >
                Hủy
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Xóa dữ liệu cá nhân</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
