import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  History,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import type {
  AdminAISettings,
  AIProviderMode,
  AppTab,
  AuthUser,
  BackupPayload,
  ChatMessage,
  DepositMethod,
  DuplicateSerialInfo,
  LoginNoticeConfig,
  SavingsGoal,
  ScanResult,
  SecurityAlert,
  Transaction,
  TransactionType,
  UserRole,
} from './types/finance';
import { calculateSummary } from './utils/analytics';
import { formatVND } from './utils/currency';
import { LoginView } from './components/LoginView';
import { ForcePasswordModal } from './components/ForcePasswordModal';
import { DashboardView } from './components/DashboardView';
import { SavingsEntryView } from './components/SavingsEntryView';
import { HistoryView } from './components/HistoryView';
import { AdvisorChatView } from './components/AdvisorChatView';
import { SettingsView } from './components/SettingsView';
import { AdminPanelView } from './components/AdminPanelView';

const DEFAULT_GOAL: SavingsGoal = {
  targetAmount: 10_000_000,
  label: 'Quỹ tiết kiệm cá nhân',
};

const DEFAULT_LOGIN_NOTICE: LoginNoticeConfig = {
  noticeText:
    'Tài khoản do Quản trị viên cấp (không hỗ trợ tự đăng ký). Nếu chưa có tài khoản, vui lòng',
  discordLabel: 'nhắn tin trực tiếp cho Admin qua Discord',
  discordUrl: 'https://discord.com',
};

const DEFAULT_ADMIN_AI_SETTINGS: AdminAISettings = {
  provider: 'server',
  apiKey: '',
  hasSavedApiKey: false,
  baseUrl: 'https://api-vn.knualabs.icu/v1',
  model: 'claude-opus-5',
  visionModel: 'auto',
  allowUserCamera: false,
  allowUserChat: true,
  loginNoticeText: DEFAULT_LOGIN_NOTICE.noticeText,
  loginDiscordLabel: DEFAULT_LOGIN_NOTICE.discordLabel,
  loginDiscordUrl: DEFAULT_LOGIN_NOTICE.discordUrl,
};

export default function App() {
  // Strictly in-memory + HttpOnly cookie session (NO localStorage / sessionStorage)
  const [bootstrapping, setBootstrapping] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [sessionNotice, setSessionNotice] = useState('');
  const [loginNotice, setLoginNotice] = useState<LoginNoticeConfig>(DEFAULT_LOGIN_NOTICE);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goal, setGoal] = useState<SavingsGoal>(DEFAULT_GOAL);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [adminUsers, setAdminUsers] = useState<AuthUser[]>([]);
  const [adminAISettings, setAdminAISettings] = useState<AdminAISettings>(DEFAULT_ADMIN_AI_SETTINGS);

  const resetSession = useCallback((notice = '') => {
    setToken(null);
    setCurrentUser(null);
    setSessionNotice(notice);
    setTransactions([]);
    setGoal(DEFAULT_GOAL);
    setChatMessages([]);
    setSecurityAlerts([]);
    setAdminUsers([]);
    setAdminAISettings(DEFAULT_ADMIN_AI_SETTINGS);
    setActiveTab('dashboard');
  }, []);

  const apiFetch = useCallback(
    async <T,>(
      url: string,
      options: RequestInit = {},
      overrideToken?: string
    ): Promise<{ ok: boolean; status: number; data?: T; error?: string; code?: string }> => {
      const activeToken = overrideToken ?? token;
      const headers = new Headers(options.headers);
      if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
      }
      if (activeToken && activeToken !== 'cookie-session') {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }

      try {
        const res = await fetch(url, {
          ...options,
          headers,
          credentials: 'include',
        });
        const json = (await res.json().catch(() => ({}))) as T & {
          error?: string;
          code?: string;
        };

        if (res.status === 403 && json.code === 'ACCOUNT_LOCKED' && activeToken) {
          resetSession(json.error || 'Tài khoản của bạn đã bị khóa bởi Quản trị viên.');
        } else if (res.status === 401 && activeToken) {
          resetSession();
        }

        if (!res.ok) {
          return {
            ok: false,
            status: res.status,
            data: json,
            code: json.code,
            error: json.error || `Lỗi máy chủ (${res.status}).`,
          };
        }
        return { ok: true, status: res.status, data: json };
      } catch {
        return {
          ok: false,
          status: 0,
          error: 'Không thể kết nối tới máy chủ. Vui lòng thử lại.',
        };
      }
    },
    [token, resetSession]
  );

  const loadProtectedData = useCallback(
    async (activeToken: string, activeUser: AuthUser) => {
      setLoadingWorkspace(true);
      try {
        const canChat = activeUser.role === 'admin' || activeUser.canUseChat;
        const isAdmin = activeUser.role === 'admin';

        const [txRes, goalRes, alertsRes, chatRes, usersRes, aiRes] = await Promise.all([
          apiFetch<{ transactions: Transaction[] }>('/api/transactions', {}, activeToken),
          apiFetch<{ goal: SavingsGoal }>('/api/goal', {}, activeToken),
          apiFetch<{ alerts: SecurityAlert[] }>('/api/security-alerts', {}, activeToken),
          canChat
            ? apiFetch<{ messages: ChatMessage[] }>('/api/advisor/messages', {}, activeToken)
            : Promise.resolve({ ok: true, status: 200, data: { messages: [] as ChatMessage[] } }),
          isAdmin
            ? apiFetch<{ users: AuthUser[] }>('/api/admin/users', {}, activeToken)
            : Promise.resolve({ ok: true, status: 200, data: { users: [] as AuthUser[] } }),
          isAdmin
            ? apiFetch<{ settings: AdminAISettings }>('/api/admin/ai-settings', {}, activeToken)
            : Promise.resolve({ ok: true, status: 200, data: { settings: DEFAULT_ADMIN_AI_SETTINGS } }),
        ]);

        if (txRes.ok && txRes.data) setTransactions(txRes.data.transactions);
        if (goalRes.ok && goalRes.data) setGoal(goalRes.data.goal);
        if (alertsRes.ok && alertsRes.data) setSecurityAlerts(alertsRes.data.alerts);
        if (chatRes.ok && chatRes.data) setChatMessages(chatRes.data.messages);
        if (usersRes.ok && usersRes.data) setAdminUsers(usersRes.data.users);
        if (aiRes.ok && aiRes.data) setAdminAISettings(aiRes.data.settings);
      } finally {
        setLoadingWorkspace(false);
      }
    },
    [apiFetch]
  );

  // Restore session across page reloads from server HttpOnly cookie + load login notice
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    (async () => {
      try {
        const [noticeResp, meResp] = await Promise.all([
          fetch('/api/public/login-notice', { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null) as Promise<LoginNoticeConfig | null>,
          fetch('/api/auth/session', { credentials: 'include' })
            .then(async (r) => ({
              status: r.status,
              ok: r.ok,
              body: (await r.json().catch(() => ({}))) as {
                authenticated?: boolean;
                user?: AuthUser | null;
                error?: string;
                code?: string;
              },
            }))
            .catch(() => null),
        ]);

        if (noticeResp && noticeResp.noticeText && noticeResp.discordUrl) {
          setLoginNotice(noticeResp);
        }

        if (meResp?.ok && meResp.body.authenticated && meResp.body.user) {
          setToken('cookie-session');
          setCurrentUser(meResp.body.user);
          if (!meResp.body.user.mustChangePassword) {
            await loadProtectedData('cookie-session', meResp.body.user);
          }
        } else if (meResp?.status === 403 && meResp.body.code === 'ACCOUNT_LOCKED') {
          setSessionNotice(
            meResp.body.error || 'Tài khoản của bạn đã bị khóa bởi Quản trị viên.'
          );
        }
      } finally {
        setBootstrapping(false);
      }
    })();
  }, [loadProtectedData]);

  // Real-time session lock check + live security alert polling for logged-in users
  useEffect(() => {
    if (!token || !currentUser || currentUser.mustChangePassword) return;

    let cancelled = false;
    const checkSessionAndAlerts = async () => {
      if (cancelled) return;
      const res = await apiFetch<{ user: AuthUser; unreadAlertsCount?: number }>('/api/auth/me');
      if (cancelled || !res.ok || !res.data?.user) return;

      const fresh = res.data.user;
      setCurrentUser((prev) => {
        if (!prev) return fresh;
        if (
          prev.canUseCamera === fresh.canUseCamera &&
          prev.canUseChat === fresh.canUseChat &&
          prev.role === fresh.role &&
          prev.displayName === fresh.displayName &&
          prev.mustChangePassword === fresh.mustChangePassword
        ) {
          return prev;
        }
        return fresh;
      });

      const unreadCount = res.data.unreadAlertsCount ?? 0;
      if (unreadCount > 0) {
        const alertsRes = await apiFetch<{ alerts: SecurityAlert[] }>('/api/security-alerts');
        if (!cancelled && alertsRes.ok && alertsRes.data) {
          setSecurityAlerts(alertsRes.data.alerts);
        }
      }
    };

    const intervalId = window.setInterval(() => {
      void checkSessionAndAlerts();
    }, 10_000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkSessionAndAlerts();
      }
    };
    const handleFocus = () => {
      void checkSessionAndAlerts();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [token, currentUser, apiFetch]);

  const canUseCamera = currentUser ? currentUser.role === 'admin' || currentUser.canUseCamera : false;
  const canUseChat = currentUser ? currentUser.role === 'admin' || currentUser.canUseChat : false;
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (!currentUser) return;
    if (activeTab === 'advisor' && !canUseChat) {
      setActiveTab('dashboard');
    } else if (activeTab === 'admin' && !isAdmin) {
      setActiveTab('dashboard');
    }
  }, [activeTab, canUseChat, isAdmin, currentUser]);

  const navItems = useMemo(() => {
    const items: Array<{
      id: AppTab;
      label: string;
      mobileLabel: string;
      icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    }> = [
      { id: 'dashboard', label: 'Tổng quan', mobileLabel: 'Tổng quan', icon: LayoutDashboard },
      {
        id: 'entry',
        label: canUseCamera ? 'Quét & Nạp tiền' : 'Nạp / Rút tiền',
        mobileLabel: canUseCamera ? 'Quét / Nạp' : 'Nạp / Rút',
        icon: Camera,
      },
      { id: 'history', label: 'Lịch sử giao dịch', mobileLabel: 'Lịch sử', icon: History },
    ];
    if (canUseChat) {
      items.push({ id: 'advisor', label: 'Trợ lý AI', mobileLabel: 'Trợ lý AI', icon: MessageSquareText });
    }
    items.push({ id: 'settings', label: 'Cài đặt & Sao lưu', mobileLabel: 'Cài đặt', icon: Settings });
    if (isAdmin) {
      items.push({ id: 'admin', label: 'Quản trị', mobileLabel: 'Quản trị', icon: ShieldCheck });
    }
    return items;
  }, [canUseCamera, canUseChat, isAdmin]);

  const summary = useMemo(() => calculateSummary(transactions), [transactions]);
  const unreadAlerts = useMemo(
    () => securityAlerts.filter((a) => !a.isRead),
    [securityAlerts]
  );

  // --- Auth Handlers ---
  const handleLogin = async (username: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok || !res.data) {
      return { ok: false, error: res.error || 'Tên đăng nhập hoặc mật khẩu không chính xác.' };
    }
    setSessionNotice('');
    setToken(res.data.token);
    setCurrentUser(res.data.user);
    if (!res.data.user.mustChangePassword) {
      await loadProtectedData(res.data.token, res.data.user);
    }
    return { ok: true };
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => undefined);
    resetSession();
  };

  const handleChangePassword = async (
    oldPassword: string,
    newPassword: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await apiFetch<{ user: AuthUser }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    if (!res.ok || !res.data) {
      return { ok: false, error: res.error || 'Không thể đổi mật khẩu.' };
    }
    const wasForced = Boolean(currentUser?.mustChangePassword);
    setCurrentUser(res.data.user);
    if (wasForced && token) {
      await loadProtectedData(token, res.data.user);
    }
    return { ok: true };
  };

  // --- Security Alerts Handlers ---
  const handleMarkAlertRead = async (alertId: string) => {
    const res = await apiFetch(`/api/security-alerts/${alertId}/read`, { method: 'PATCH' });
    if (res.ok) {
      setSecurityAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, isRead: true } : a))
      );
    }
  };

  const handleMarkAllAlertsRead = async () => {
    const res = await apiFetch('/api/security-alerts/read-all', { method: 'POST' });
    if (res.ok) {
      setSecurityAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    }
  };

  // --- Savings & Goal Handlers ---
  const handleScanBill = async (
    imageDataUrl: string
  ): Promise<{
    ok: boolean;
    result?: ScanResult;
    fallbackModel?: string;
    duplicateWarning?: DuplicateSerialInfo | null;
    error?: string;
  }> => {
    const res = await apiFetch<{
      result: ScanResult;
      fallbackModel?: string;
      duplicateWarning?: DuplicateSerialInfo | null;
    }>('/api/ai/scan-bill', {
      method: 'POST',
      body: JSON.stringify({ imageDataUrl }),
    });
    if (!res.ok || !res.data) {
      return { ok: false, error: res.error || 'Không thể quét ảnh tờ tiền.' };
    }
    return {
      ok: true,
      result: res.data.result,
      fallbackModel: res.data.fallbackModel,
      duplicateWarning: res.data.duplicateWarning ?? null,
    };
  };

  const handleSubmitTransaction = async (input: {
    type: TransactionType;
    method: DepositMethod;
    amount: number;
    serialNumber?: string;
    confidence?: number;
    note: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    const res = await apiFetch<{ transaction: Transaction }>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!res.ok || !res.data) {
      return { ok: false, error: res.error || 'Không thể lưu giao dịch.' };
    }
    setTransactions((prev) => [res.data!.transaction, ...prev]);
    return { ok: true };
  };

  const handleEditTransaction = async (
    id: string,
    updates: { type: TransactionType; method: DepositMethod; amount: number; serialNumber?: string; note: string }
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await apiFetch<{ ok: boolean; updatedAt: string }>(`/api/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      return { ok: false, error: res.error || 'Không thể cập nhật giao dịch.' };
    }
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === id
          ? {
              ...tx,
              type: updates.type,
              method: updates.type === 'withdraw' ? 'manual' : updates.method,
              amount: updates.amount,
              serialNumber: updates.type === 'deposit' ? updates.serialNumber : undefined,
              note: updates.note,
              updatedAt: res.data?.updatedAt || new Date().toISOString(),
            }
          : tx
      )
    );
    return { ok: true };
  };

  const handleDeleteTransaction = async (id: string) => {
    const res = await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    }
  };

  const handleUpdateGoal = async (nextGoal: SavingsGoal) => {
    const res = await apiFetch<{ goal: SavingsGoal }>('/api/goal', {
      method: 'PUT',
      body: JSON.stringify(nextGoal),
    });
    if (res.ok && res.data) {
      setGoal(res.data.goal);
    }
  };

  // --- Financial AI Advisor Handlers ---
  const handleSendAdvisorMessage = async (message: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await apiFetch<{ userMessage: ChatMessage; assistantMessage: ChatMessage }>('/api/advisor/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    if (!res.ok || !res.data) {
      return { ok: false, error: res.error || 'Không thể nhận phản hồi từ Trợ lý AI.' };
    }
    setChatMessages((prev) => [...prev, res.data!.userMessage, res.data!.assistantMessage]);
    return { ok: true };
  };

  const handleClearAdvisorMessages = async () => {
    const res = await apiFetch('/api/advisor/messages', { method: 'DELETE' });
    if (res.ok) {
      setChatMessages([]);
    }
  };

  // --- Backup & Reset Handlers ---
  const handleRestoreBackup = async (
    payload: BackupPayload,
    mode: 'replace' | 'merge'
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await apiFetch('/api/transactions/import', {
      method: 'POST',
      body: JSON.stringify({
        transactions: payload.transactions,
        goal: payload.goal,
        mode,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: res.error || 'Khôi phục dữ liệu thất bại.' };
    }
    if (token && currentUser) {
      await loadProtectedData(token, currentUser);
    }
    return { ok: true };
  };

  const handleResetAllData = async () => {
    const res = await apiFetch('/api/transactions', { method: 'DELETE' });
    if (res.ok) {
      setTransactions([]);
      setGoal(DEFAULT_GOAL);
    }
  };

  // --- Admin Handlers ---
  const handleCreateUser = async (input: {
    username: string;
    displayName: string;
    password: string;
    role: UserRole;
  }): Promise<{ ok: boolean; error?: string }> => {
    const res = await apiFetch<{ user: AuthUser }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!res.ok || !res.data) {
      return { ok: false, error: res.error || 'Không tạo được tài khoản.' };
    }
    setAdminUsers((prev) => [...prev, res.data!.user]);
    return { ok: true };
  };

  const handleUpdateUserPermissions = async (
    userId: string,
    updates: { isLocked?: boolean; canUseCamera?: boolean; canUseChat?: boolean }
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await apiFetch<{ user: AuthUser }>(`/api/admin/users/${userId}/permissions`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    if (!res.ok || !res.data) {
      return { ok: false, error: res.error || 'Không cập nhật được phân quyền.' };
    }
    setAdminUsers((prev) => prev.map((u) => (u.id === userId ? res.data!.user : u)));
    return { ok: true };
  };

  const handleBulkPermission = async (
    feature: 'camera' | 'chat',
    enabled: boolean
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await apiFetch('/api/admin/permissions/bulk', {
      method: 'POST',
      body: JSON.stringify({ feature, enabled }),
    });
    if (!res.ok) {
      return { ok: false, error: res.error || 'Không cập nhật được toàn hệ thống.' };
    }
    setAdminUsers((prev) =>
      prev.map((u) =>
        u.role === 'admin'
          ? u
          : {
              ...u,
              canUseCamera: feature === 'camera' ? enabled : u.canUseCamera,
              canUseChat: feature === 'chat' ? enabled : u.canUseChat,
            }
      )
    );
    setAdminAISettings((prev) => ({
      ...prev,
      allowUserCamera: feature === 'camera' ? enabled : prev.allowUserCamera,
      allowUserChat: feature === 'chat' ? enabled : prev.allowUserChat,
    }));
    return { ok: true };
  };

  const handleResetUserPassword = async (
    userId: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await apiFetch(`/api/admin/users/${userId}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword, confirmPassword }),
    });
    if (!res.ok) {
      return { ok: false, error: res.error || 'Không đặt lại được mật khẩu.' };
    }
    setAdminUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, mustChangePassword: false } : u))
    );
    return { ok: true };
  };

  const handleDeleteUser = async (userId: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    if (!res.ok) {
      return { ok: false, error: res.error || 'Không xóa được tài khoản.' };
    }
    setAdminUsers((prev) => prev.filter((u) => u.id !== userId));
    return { ok: true };
  };

  const handleSaveAISettings = async (
    settings: AdminAISettings & { clearApiKey?: boolean }
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await apiFetch<{ settings: AdminAISettings }>('/api/admin/ai-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    if (!res.ok || !res.data) {
      return { ok: false, error: res.error || 'Không lưu được cấu hình AI.' };
    }
    setAdminAISettings(res.data.settings);
    if (
      res.data.settings.loginNoticeText &&
      res.data.settings.loginDiscordLabel &&
      res.data.settings.loginDiscordUrl
    ) {
      setLoginNotice({
        noticeText: res.data.settings.loginNoticeText,
        discordLabel: res.data.settings.loginDiscordLabel,
        discordUrl: res.data.settings.loginDiscordUrl,
      });
    }
    return { ok: true };
  };

  const handleLoadModels = async (input: {
    provider: AIProviderMode;
    apiKey: string;
    baseUrl: string;
  }): Promise<{ ok: boolean; models?: string[]; error?: string }> => {
    const res = await apiFetch<{ models: string[] }>('/api/admin/ai-models', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!res.ok || !res.data) {
      return { ok: false, error: res.error || 'Không tải được danh sách model.' };
    }
    return { ok: true, models: res.data.models };
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center mx-auto">
            <Wallet className="w-5 h-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-slate-600">Đang khôi phục phiên đăng nhập...</p>
        </div>
      </div>
    );
  }

  if (!token || !currentUser) {
    return (
      <LoginView
        onLogin={handleLogin}
        sessionNotice={sessionNotice}
        onClearSessionNotice={() => setSessionNotice('')}
        loginNotice={loginNotice}
      />
    );
  }

  if (currentUser.mustChangePassword) {
    return (
      <ForcePasswordModal
        onChangePassword={handleChangePassword}
        onLogout={() => void handleLogout()}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-slate-200/90 z-30">
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap block">
              Ví Tiết Kiệm
            </span>
            <span className="text-[11px] text-slate-500 truncate block">
              @{currentUser.username} · {isAdmin ? 'Admin' : 'User'}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1" aria-label="Điều hướng chính">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-emerald-50 text-emerald-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-600' : 'text-slate-500'}`}
                  aria-hidden={true}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-3">
          <div>
            <p className="text-xs text-slate-500">Số dư hiện tại</p>
            <p className="font-mono tabular-nums text-sm font-bold text-slate-900 mt-0.5">
              {formatVND(summary.totalBalance)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" aria-hidden="true" />
          </div>
          <span className="font-display text-base font-bold text-slate-900 truncate whitespace-nowrap">
            Ví Tiết Kiệm
          </span>
        </div>

        <button
          type="button"
          onClick={() => void handleLogout()}
          aria-label="Đăng xuất"
          className="min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Thoát</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 md:pl-64 pb-24 md:pb-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {unreadAlerts.length > 0 && (
            <section
              role="alert"
              aria-label="Cảnh báo an toàn chống lấy tiền"
              className="rounded-2xl bg-red-50 border border-red-300 p-4 sm:p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-red-900">
                    Cảnh báo an toàn chống lấy tiền ({unreadAlerts.length})
                  </h2>
                </div>
                {unreadAlerts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void handleMarkAllAlertsRead()}
                    className="min-h-[34px] px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Đã kiểm tra tất cả
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {unreadAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-xl bg-white border border-red-200 px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs text-red-900 leading-relaxed font-medium">
                        {alert.message}
                      </p>
                      <p className="text-[11px] font-mono tabular-nums text-red-700">
                        Seri: {alert.serialNumber} · {formatVND(alert.amount)} ·{' '}
                        {new Date(alert.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleMarkAlertRead(alert.id)}
                      className="min-h-[36px] px-3 rounded-lg border border-red-200 hover:bg-red-50 text-xs font-semibold text-red-800 flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Đã kiểm tra</span>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {loadingWorkspace ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Đang đồng bộ dữ liệu từ cơ sở dữ liệu...
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  displayName={currentUser.displayName}
                  canUseChat={canUseChat}
                  transactions={transactions}
                  goal={goal}
                  onUpdateGoal={handleUpdateGoal}
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === 'entry' && (
                <SavingsEntryView
                  canUseCamera={canUseCamera}
                  transactions={transactions}
                  onScanBill={handleScanBill}
                  onSubmitTransaction={handleSubmitTransaction}
                />
              )}

              {activeTab === 'history' && (
                <HistoryView
                  transactions={transactions}
                  onEditTransaction={handleEditTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                />
              )}

              {activeTab === 'advisor' && canUseChat && (
                <AdvisorChatView
                  totalBalance={summary.totalBalance}
                  goal={goal}
                  messages={chatMessages}
                  onSendMessage={handleSendAdvisorMessage}
                  onClearMessages={handleClearAdvisorMessages}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  currentUser={currentUser}
                  onChangePassword={handleChangePassword}
                  transactions={transactions}
                  goal={goal}
                  onRestoreBackup={handleRestoreBackup}
                  onResetAllData={handleResetAllData}
                  onNavigate={isAdmin ? setActiveTab : undefined}
                />
              )}

              {activeTab === 'admin' && isAdmin && (
                <AdminPanelView
                  currentUser={currentUser}
                  users={adminUsers}
                  aiSettings={adminAISettings}
                  onCreateUser={handleCreateUser}
                  onUpdateUserPermissions={handleUpdateUserPermissions}
                  onBulkPermission={handleBulkPermission}
                  onResetUserPassword={handleResetUserPassword}
                  onChangeOwnPassword={handleChangePassword}
                  onDeleteUser={handleDeleteUser}
                  onSaveAISettings={handleSaveAISettings}
                  onLoadModels={handleLoadModels}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Điều hướng di động"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="flex items-center justify-around h-16 px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 px-0.5 transition-colors cursor-pointer ${
                  active ? 'text-emerald-700 font-semibold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden={true} />
                <span className="text-[10px] leading-none whitespace-nowrap">
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
