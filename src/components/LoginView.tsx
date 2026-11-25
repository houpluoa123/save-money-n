import React, { useState } from 'react';
import { AlertTriangle, Bell, Eye, EyeOff, Lock, Wallet, X } from 'lucide-react';
import type { LoginNoticeConfig } from '../types/finance';

interface LoginViewProps {
  onLogin: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  sessionNotice?: string;
  onClearSessionNotice?: () => void;
  loginNotice: LoginNoticeConfig;
}

function getSafeExternalUrl(raw: string): string {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // Fallback below
  }
  return 'https://discord.com';
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  sessionNotice,
  onClearSessionNotice,
  loginNotice,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const safeDiscordUrl = getSafeExternalUrl(loginNotice.discordUrl || 'https://discord.com');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (onClearSessionNotice) onClearSessionNotice();
    if (!username.trim() || !password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await onLogin(username.trim(), password);
      if (!res.ok) {
        setError(res.error || 'Tên đăng nhập hoặc mật khẩu không chính xác.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Ví Tiết Kiệm Cá Nhân
            </h1>
            <p className="text-sm text-slate-500">
              Quản lý quỹ tiết kiệm VNĐ đồng bộ cơ sở dữ liệu
            </p>
          </div>
        </div>

        {sessionNotice && (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-900">Thông báo trạng thái tài khoản</p>
              <p className="text-xs text-red-700 mt-0.5 leading-relaxed">{sessionNotice}</p>
            </div>
            {onClearSessionNotice && (
              <button
                type="button"
                onClick={onClearSessionNotice}
                aria-label="Đóng thông báo khóa tài khoản"
                className="text-red-500 hover:text-red-800 p-0.5 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div
          role="region"
          aria-label="Thông báo cấp tài khoản"
          className="mb-5 rounded-xl bg-amber-50/80 border border-amber-200/90 px-4 py-3.5 text-sm text-slate-800 flex items-start gap-3"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <Bell className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
              Thông báo
            </p>
            <p className="text-xs text-slate-700 mt-1 leading-relaxed">
              {loginNotice.noticeText}{' '}
              <a
                href={safeDiscordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-emerald-800 underline underline-offset-4 decoration-2 hover:text-emerald-950 break-words"
              >
                {loginNotice.discordLabel}
              </a>{' '}
              để được cấp tài khoản.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="login-username" className="block text-sm font-medium text-slate-700 mb-1.5">
              Tên đăng nhập
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
              placeholder="Nhập tên đăng nhập (vd: admin)"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                placeholder="Nhập mật khẩu"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Lock className="w-4 h-4" aria-hidden="true" />
            <span>{submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
