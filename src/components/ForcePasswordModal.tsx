import React, { useState } from 'react';
import { KeyRound, Lock, LogOut } from 'lucide-react';

interface ForcePasswordModalProps {
  onChangePassword: (oldPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  onLogout: () => void;
}

export const ForcePasswordModal: React.FC<ForcePasswordModalProps> = ({
  onChangePassword,
  onLogout,
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('Vui lòng điền đầy đủ cả 3 trường mật khẩu.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword === '123456') {
      setError('Mật khẩu mới không được trùng với mật khẩu mặc định 123456.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await onChangePassword(oldPassword, newPassword);
      if (!result.ok) {
        setError(result.error || 'Không thể đổi mật khẩu.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                Đổi mật khẩu lần đầu
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Bắt buộc cập nhật mật khẩu mới trước khi sử dụng ứng dụng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Thoát ra màn hình đăng nhập"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="force-old-pw" className="block text-sm font-medium text-slate-700 mb-1.5">
              Mật khẩu cũ
            </label>
            <input
              id="force-old-pw"
              type="password"
              autoComplete="current-password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Nhập mật khẩu hiện tại (123456)"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
            />
          </div>

          <div>
            <label htmlFor="force-new-pw" className="block text-sm font-medium text-slate-700 mb-1.5">
              Mật khẩu mới
            </label>
            <input
              id="force-new-pw"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự, khác 123456"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
            />
          </div>

          <div>
            <label htmlFor="force-confirm-pw" className="block text-sm font-medium text-slate-700 mb-1.5">
              Xác nhận mật khẩu mới
            </label>
            <input
              id="force-confirm-pw"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Lock className="w-4 h-4" aria-hidden="true" />
            <span>{submitting ? 'Đang lưu mật khẩu...' : 'Cập nhật mật khẩu & Mở khóa'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
