import React, { useEffect, useState } from 'react';
import {
  Camera,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  MessageSquareText,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
  UserPlus,
  Users,
} from 'lucide-react';
import type { AdminAISettings, AIProviderMode, AuthUser, UserRole } from '../types/finance';

interface AdminPanelViewProps {
  currentUser: AuthUser;
  users: AuthUser[];
  aiSettings: AdminAISettings;
  onCreateUser: (input: {
    username: string;
    displayName: string;
    password: string;
    role: UserRole;
  }) => Promise<{ ok: boolean; error?: string }>;
  onUpdateUserPermissions: (
    userId: string,
    updates: { isLocked?: boolean; canUseCamera?: boolean; canUseChat?: boolean }
  ) => Promise<{ ok: boolean; error?: string }>;
  onBulkPermission: (
    feature: 'camera' | 'chat',
    enabled: boolean
  ) => Promise<{ ok: boolean; error?: string }>;
  onResetUserPassword: (
    userId: string,
    newPassword: string,
    confirmPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onChangeOwnPassword: (oldPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  onDeleteUser: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  onSaveAISettings: (
    settings: AdminAISettings & { clearApiKey?: boolean }
  ) => Promise<{ ok: boolean; error?: string }>;
  onLoadModels: (input: {
    provider: AIProviderMode;
    apiKey: string;
    baseUrl: string;
  }) => Promise<{ ok: boolean; models?: string[]; error?: string }>;
}

interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  id,
  checked,
  disabled = false,
  label,
  onChange,
}) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    } ${checked ? 'bg-emerald-600' : 'bg-slate-300'}`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  currentUser,
  users,
  aiSettings,
  onCreateUser,
  onUpdateUserPermissions,
  onBulkPermission,
  onResetUserPassword,
  onChangeOwnPassword,
  onDeleteUser,
  onSaveAISettings,
  onLoadModels,
}) => {
  // User creation form state
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [creatingUser, setCreatingUser] = useState(false);
  const [userMsg, setUserMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Per-row states
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<'camera' | 'chat' | null>(null);
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetOldPasswordInput, setResetOldPasswordInput] = useState('');
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resetConfirmPasswordInput, setResetConfirmPasswordInput] = useState('');
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);

  // Admin AI Configuration & Login Notice state
  const [provider, setProvider] = useState<AIProviderMode>(aiSettings.provider);
  const [baseUrl, setBaseUrl] = useState(aiSettings.baseUrl || 'https://api-vn.knualabs.icu/v1');
  const [model, setModel] = useState(aiSettings.model || 'claude-opus-5');
  const [visionModel, setVisionModel] = useState(aiSettings.visionModel || 'auto');
  const [allowUserCamera, setAllowUserCamera] = useState<boolean>(Boolean(aiSettings.allowUserCamera));
  const [allowUserChat, setAllowUserChat] = useState<boolean>(Boolean(aiSettings.allowUserChat));
  const [loginNoticeText, setLoginNoticeText] = useState(
    aiSettings.loginNoticeText || 'Tài khoản do Quản trị viên cấp (không hỗ trợ tự đăng ký). Nếu chưa có tài khoản, vui lòng'
  );
  const [loginDiscordLabel, setLoginDiscordLabel] = useState(
    aiSettings.loginDiscordLabel || 'nhắn tin trực tiếp cho Admin qua Discord'
  );
  const [loginDiscordUrl, setLoginDiscordUrl] = useState(
    aiSettings.loginDiscordUrl || 'https://discord.com'
  );
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingAI, setSavingAI] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    setProvider(aiSettings.provider);
    setBaseUrl(aiSettings.baseUrl || 'https://api-vn.knualabs.icu/v1');
    setModel(aiSettings.model || 'claude-opus-5');
    setVisionModel(aiSettings.visionModel || 'auto');
    setAllowUserCamera(Boolean(aiSettings.allowUserCamera));
    setAllowUserChat(Boolean(aiSettings.allowUserChat));
    setLoginNoticeText(
      aiSettings.loginNoticeText || 'Tài khoản do Quản trị viên cấp (không hỗ trợ tự đăng ký). Nếu chưa có tài khoản, vui lòng'
    );
    setLoginDiscordLabel(
      aiSettings.loginDiscordLabel || 'nhắn tin trực tiếp cho Admin qua Discord'
    );
    setLoginDiscordUrl(aiSettings.loginDiscordUrl || 'https://discord.com');
  }, [aiSettings]);

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingUser) return;
    setUserMsg(null);
    setCreatingUser(true);
    try {
      const res = await onCreateUser({
        username: newUsername.trim().toLowerCase(),
        displayName: newDisplayName.trim(),
        password: newPassword,
        role: newRole,
      });
      if (!res.ok) {
        setUserMsg({ type: 'err', text: res.error || 'Không tạo được tài khoản.' });
        return;
      }
      setNewUsername('');
      setNewDisplayName('');
      setNewPassword('');
      setNewRole('user');
      setUserMsg({ type: 'ok', text: 'Đã cấp tài khoản mới trong cơ sở dữ liệu.' });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleTogglePermission = async (
    userId: string,
    updates: { isLocked?: boolean; canUseCamera?: boolean; canUseChat?: boolean }
  ) => {
    setPendingUserId(userId);
    setUserMsg(null);
    try {
      const res = await onUpdateUserPermissions(userId, updates);
      if (!res.ok) {
        setUserMsg({ type: 'err', text: res.error || 'Không cập nhật được quyền tài khoản.' });
      }
    } finally {
      setPendingUserId(null);
    }
  };

  const handleBulkToggle = async (feature: 'camera' | 'chat', enabled: boolean) => {
    setBulkBusy(feature);
    setUserMsg(null);
    try {
      const res = await onBulkPermission(feature, enabled);
      if (!res.ok) {
        setUserMsg({ type: 'err', text: res.error || 'Không cập nhật được toàn hệ thống.' });
        return;
      }
      setUserMsg({
        type: 'ok',
        text:
          feature === 'camera'
            ? `Đã ${enabled ? 'bật' : 'tắt'} quyền Camera AI cho toàn bộ người dùng.`
            : `Đã ${enabled ? 'bật' : 'tắt'} quyền Trợ lý Chat AI cho toàn bộ người dùng.`,
      });
    } finally {
      setBulkBusy(null);
    }
  };

  const handleResetPw = async (userId: string) => {
    const isSelf = userId === currentUser.id;
    setUserMsg(null);
    if (isSelf && !resetOldPasswordInput) {
      setUserMsg({ type: 'err', text: 'Vui lòng nhập mật khẩu cũ để đổi mật khẩu.' });
      return;
    }
    if (!resetPasswordInput || resetPasswordInput.length < 6) {
      setUserMsg({ type: 'err', text: 'Mật khẩu mới phải tối thiểu 6 ký tự.' });
      return;
    }
    if (resetPasswordInput !== resetConfirmPasswordInput) {
      setUserMsg({ type: 'err', text: 'Xác nhận mật khẩu mới chưa khớp.' });
      return;
    }
    const res = isSelf
      ? await onChangeOwnPassword(resetOldPasswordInput, resetPasswordInput)
      : await onResetUserPassword(userId, resetPasswordInput, resetConfirmPasswordInput);
    if (!res.ok) {
      setUserMsg({ type: 'err', text: res.error || 'Không thể cập nhật mật khẩu.' });
      return;
    }
    setResetTargetId(null);
    setResetOldPasswordInput('');
    setResetPasswordInput('');
    setResetConfirmPasswordInput('');
    setUserMsg({
      type: 'ok',
      text: isSelf ? 'Đã đổi mật khẩu tài khoản của bạn.' : 'Đã đặt lại mật khẩu cho tài khoản.',
    });
  };

  const handleSaveAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingAI) return;
    setAiMsg(null);
    setSavingAI(true);
    try {
      const res = await onSaveAISettings({
        provider,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || 'https://api-vn.knualabs.icu/v1',
        model: model.trim() || 'claude-opus-5',
        visionModel: visionModel.trim() || 'auto',
        allowUserCamera,
        allowUserChat,
        loginNoticeText: loginNoticeText.trim(),
        loginDiscordLabel: loginDiscordLabel.trim(),
        loginDiscordUrl: loginDiscordUrl.trim(),
      });
      if (!res.ok) {
        setAiMsg({ type: 'err', text: res.error || 'Không lưu được cấu hình AI.' });
        return;
      }
      setApiKey('');
      setAiMsg({ type: 'ok', text: 'Đã lưu cấu hình AI và thông báo đăng nhập vào cơ sở dữ liệu.' });
    } finally {
      setSavingAI(false);
    }
  };

  const handleClearSavedKey = async () => {
    setSavingAI(true);
    setAiMsg(null);
    try {
      const res = await onSaveAISettings({
        provider,
        apiKey: '',
        clearApiKey: true,
        baseUrl: baseUrl.trim() || 'https://api-vn.knualabs.icu/v1',
        model: model.trim() || 'claude-opus-5',
        visionModel: visionModel.trim() || 'auto',
        allowUserCamera,
        allowUserChat,
        loginNoticeText: loginNoticeText.trim(),
        loginDiscordLabel: loginDiscordLabel.trim(),
        loginDiscordUrl: loginDiscordUrl.trim(),
      });
      if (res.ok) {
        setAiMsg({ type: 'ok', text: 'Đã xóa API Key tùy chỉnh đã lưu trong DB.' });
      } else {
        setAiMsg({ type: 'err', text: res.error || 'Không xóa được API Key.' });
      }
    } finally {
      setSavingAI(false);
    }
  };

  const handleFetchModels = async () => {
    setLoadingModels(true);
    setAiMsg(null);
    try {
      const res = await onLoadModels({
        provider,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || 'https://api-vn.knualabs.icu/v1',
      });
      if (!res.ok) {
        setAiMsg({ type: 'err', text: res.error || 'Không tải được danh sách model.' });
        return;
      }
      setAvailableModels(res.models ?? []);
    } finally {
      setLoadingModels(false);
    }
  };

  const nonAdminUsers = users.filter((u) => u.role !== 'admin');
  const allCameraEnabled = nonAdminUsers.length > 0 ? nonAdminUsers.every((u) => u.canUseCamera) : allowUserCamera;
  const allChatEnabled = nonAdminUsers.length > 0 ? nonAdminUsers.every((u) => u.canUseChat) : allowUserChat;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Bảng điều khiển Quản trị</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Quản lý tài khoản, phân quyền Camera / Chat AI theo từng người dùng và cấu hình API phía máy chủ
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Section 1: User Management & Per-User AI Permissions */}
        <section className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">1. Quản lý người dùng &amp; Phân quyền AI</h3>
              <p className="text-xs text-slate-500">Cấp tài khoản mới, khóa/mở khóa và bật/tắt tính năng AI</p>
            </div>
          </div>

          {/* System-wide quick toggles */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-800">Bật / tắt nhanh toàn hệ thống (áp dụng tất cả User)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white border border-slate-200 px-3.5 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Camera className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-800 truncate">Camera AI quét tiền</span>
                </div>
                <ToggleSwitch
                  id="bulk-camera-toggle"
                  checked={allCameraEnabled}
                  disabled={bulkBusy === 'camera'}
                  label="Bật hoặc tắt Camera AI cho toàn bộ người dùng"
                  onChange={(next) => void handleBulkToggle('camera', next)}
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl bg-white border border-slate-200 px-3.5 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquareText className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-800 truncate">Trợ lý Chat AI</span>
                </div>
                <ToggleSwitch
                  id="bulk-chat-toggle"
                  checked={allChatEnabled}
                  disabled={bulkBusy === 'chat'}
                  label="Bật hoặc tắt Trợ lý Chat AI cho toàn bộ người dùng"
                  onChange={(next) => void handleBulkToggle('chat', next)}
                />
              </div>
            </div>
          </div>

          {/* Create new user form */}
          <form onSubmit={handleCreateUserSubmit} className="rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              <span>Tạo tài khoản mới</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="admin-new-username" className="block text-xs font-medium text-slate-700 mb-1">
                  Tên đăng nhập
                </label>
                <input
                  id="admin-new-username"
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="vd: minh_anh"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="admin-new-display" className="block text-xs font-medium text-slate-700 mb-1">
                  Tên hiển thị
                </label>
                <input
                  id="admin-new-display"
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="vd: Minh Anh"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="admin-new-pw" className="block text-xs font-medium text-slate-700 mb-1">
                  Mật khẩu
                </label>
                <input
                  id="admin-new-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="admin-new-role" className="block text-xs font-medium text-slate-700 mb-1">
                  Vai trò
                </label>
                <select
                  id="admin-new-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                >
                  <option value="user">Người dùng (User)</option>
                  <option value="admin">Quản trị viên (Admin)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingUser}
              className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              <span>{creatingUser ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}</span>
            </button>
          </form>

          {userMsg && (
            <p
              role="status"
              className={`text-xs font-medium ${userMsg.type === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}
            >
              {userMsg.text}
            </p>
          )}

          {/* User list */}
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {users.map((u) => {
              const isSelf = u.id === currentUser.id;
              const isUserAdmin = u.role === 'admin';
              const isTargetRootAdmin = Boolean(u.isRootAdmin || u.username === 'admin');
              const isRowBusy = pendingUserId === u.id;
              const canManageTarget = !isSelf && !isTargetRootAdmin;

              return (
                <div key={u.id} className="p-4 space-y-3 bg-white">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {u.displayName}{' '}
                        <span className="font-mono text-xs font-normal text-slate-500">(@{u.username})</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {isTargetRootAdmin
                          ? 'Quản trị gốc (được bảo vệ)'
                          : isUserAdmin
                            ? 'Quản trị viên'
                            : 'Người dùng'}
                        {u.isLocked ? ' · Đang bị khóa' : ''}
                        {u.mustChangePassword ? ' · Chờ đổi MK lần đầu' : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {canManageTarget && (
                        <button
                          type="button"
                          disabled={isRowBusy}
                          onClick={() => void handleTogglePermission(u.id, { isLocked: !u.isLocked })}
                          className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1 cursor-pointer ${
                            u.isLocked
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                          }`}
                        >
                          {u.isLocked ? (
                            <>
                              <Unlock className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Mở khóa</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Khóa</span>
                            </>
                          )}
                        </button>
                      )}

                      {(isSelf || canManageTarget) && (
                        <button
                          type="button"
                          onClick={() => {
                            setResetTargetId(resetTargetId === u.id ? null : u.id);
                            setResetOldPasswordInput('');
                            setResetPasswordInput('');
                            setResetConfirmPasswordInput('');
                            setConfirmDeleteUserId(null);
                          }}
                          className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isSelf ? 'Đổi mật khẩu' : 'Đặt lại MK'}</span>
                        </button>
                      )}

                      {!isSelf && isTargetRootAdmin && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-800">
                          Không thể khóa / xóa
                        </span>
                      )}

                      {canManageTarget && (
                        confirmDeleteUserId === u.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                void onDeleteUser(u.id);
                                setConfirmDeleteUserId(null);
                              }}
                              className="min-h-[34px] px-2.5 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                            >
                              Xác nhận xóa
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUserId(null)}
                              className="min-h-[34px] px-2 rounded-lg border border-slate-200 text-xs text-slate-600 cursor-pointer"
                            >
                              Hủy
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteUserId(u.id)}
                            aria-label={`Xóa tài khoản ${u.username}`}
                            className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Per-user AI Feature Switches */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-2">
                      <span className="text-xs text-slate-700 font-medium">Camera AI quét tiền</span>
                      <ToggleSwitch
                        id={`user-cam-${u.id}`}
                        checked={isUserAdmin ? true : u.canUseCamera}
                        disabled={isUserAdmin || isRowBusy}
                        label={`Quyền Camera AI cho ${u.username}`}
                        onChange={(next) => void handleTogglePermission(u.id, { canUseCamera: next })}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-2">
                      <span className="text-xs text-slate-700 font-medium">Trợ lý Chat AI</span>
                      <ToggleSwitch
                        id={`user-chat-${u.id}`}
                        checked={isUserAdmin ? true : u.canUseChat}
                        disabled={isUserAdmin || isRowBusy}
                        label={`Quyền Trợ lý Chat AI cho ${u.username}`}
                        onChange={(next) => void handleTogglePermission(u.id, { canUseChat: next })}
                      />
                    </div>
                  </div>

                  {resetTargetId === u.id && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {isSelf && (
                        <input
                          type="password"
                          value={resetOldPasswordInput}
                          onChange={(e) => setResetOldPasswordInput(e.target.value)}
                          placeholder="Mật khẩu cũ"
                          aria-label={`Mật khẩu cũ cho ${u.username}`}
                          className="sm:col-span-2 h-9 px-3 rounded-lg border border-slate-300 text-xs"
                        />
                      )}
                      <input
                        type="password"
                        value={resetPasswordInput}
                        onChange={(e) => setResetPasswordInput(e.target.value)}
                        placeholder="Mật khẩu mới (>= 6 ký tự)"
                        aria-label={`Mật khẩu mới cho ${u.username}`}
                        className="h-9 px-3 rounded-lg border border-slate-300 text-xs"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          value={resetConfirmPasswordInput}
                          onChange={(e) => setResetConfirmPasswordInput(e.target.value)}
                          placeholder="Xác nhận mật khẩu mới"
                          aria-label={`Xác nhận mật khẩu mới cho ${u.username}`}
                          className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => void handleResetPw(u.id)}
                          className="h-9 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold shrink-0 cursor-pointer"
                        >
                          Lưu
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 2: Server-Side AI Configuration */}
        <form
          onSubmit={handleSaveAI}
          className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">2. Cấu hình AI &amp; API Key (Server-side)</h3>
              <p className="text-xs text-slate-500">Bảo mật key ở máy chủ, mặc định claude-opus-5</p>
            </div>
          </div>

          <div>
            <label htmlFor="admin-ai-provider" className="block text-xs font-medium text-slate-700 mb-1.5">
              Nhà cung cấp AI
            </label>
            <select
              id="admin-ai-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as AIProviderMode)}
              className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
            >
              <option value="server">Mặc định Server (Env: Claude Opus 5 / Gemini)</option>
              <option value="anthropic">Anthropic API trực tiếp</option>
              <option value="openai_compatible">OpenAI-Compatible (Custom URL)</option>
              <option value="gemini">Google Gemini API</option>
              <option value="openai">OpenAI API</option>
            </select>
          </div>

          {(provider === 'openai_compatible' || provider === 'server') && (
            <div>
              <label htmlFor="admin-ai-baseurl" className="block text-xs font-medium text-slate-700 mb-1.5">
                API Base URL
              </label>
              <input
                id="admin-ai-baseurl"
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api-vn.knualabs.icu/v1"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 font-mono text-xs text-slate-900"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label htmlFor="admin-ai-model" className="block text-xs font-medium text-slate-700">
                Model ID chính
              </label>
              <button
                type="button"
                onClick={() => void handleFetchModels()}
                disabled={loadingModels}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                {loadingModels ? 'Đang tải...' : 'Tải models'}
              </button>
            </div>
            <input
              id="admin-ai-model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="claude-opus-5"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 font-mono text-xs text-slate-900"
            />
          </div>

          {availableModels.length > 0 && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
              <p className="text-[11px] font-medium text-slate-600">Chọn nhanh Model:</p>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {availableModels.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModel(m)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border cursor-pointer ${
                      model === m
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-500'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label htmlFor="admin-ai-vision-model" className="text-xs font-medium text-slate-700">
                Model Quét Camera AI (chụp ít lỗi nhất)
              </label>
              <button
                type="button"
                onClick={() => setVisionModel('auto')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer whitespace-nowrap shrink-0"
              >
                Chọn tự động tốt nhất
              </button>
            </div>
            <input
              id="admin-ai-vision-model"
              type="text"
              value={visionModel}
              onChange={(e) => setVisionModel(e.target.value)}
              placeholder="auto (tự chọn model nhận diện ảnh ổn định nhất)"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 font-mono text-xs text-slate-900"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[
                { id: 'auto', label: 'auto (khuyên dùng)' },
                { id: 'gemini-4-hydrogen', label: 'gemini-4-hydrogen' },
                { id: 'gemini-3.8-flash', label: 'gemini-3.8-flash' },
                { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
                { id: 'claude-sonnet-4-20250514', label: 'claude-sonnet-4' },
                { id: 'gpt-4o', label: 'gpt-4o' },
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setVisionModel(preset.id)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono border cursor-pointer ${
                    (visionModel || 'auto').toLowerCase() === preset.id
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-emerald-500'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
              Để <span className="font-mono font-semibold">auto</span> để tự bỏ qua model chỉ xử lý chữ (như claude-opus-5) và tự chuyển qua Gemini / Vision ổn định nhất khi chụp.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label htmlFor="admin-ai-apikey" className="text-xs font-medium text-slate-700">
                Anthropic / AI API Key {aiSettings.hasSavedApiKey ? '(đã lưu trong DB)' : '(tùy chọn)'}
              </label>
              {aiSettings.hasSavedApiKey && (
                <button
                  type="button"
                  onClick={() => void handleClearSavedKey()}
                  className="text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer"
                >
                  Xóa key đã lưu
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="admin-ai-apikey"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={aiSettings.hasSavedApiKey ? 'Để trống nếu giữ nguyên key cũ' : 'Nhập API Key lưu trên máy chủ'}
                className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-slate-300 font-mono text-xs text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                aria-label={showKey ? 'Ẩn API Key' : 'Hiện API Key'}
                className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-slate-500 hover:text-slate-900"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 space-y-3">
            <p className="text-xs font-semibold text-slate-900">
              Thông báo đăng nhập &amp; Link Discord cấp tài khoản
            </p>
            <div>
              <label htmlFor="admin-login-notice-text" className="block text-xs font-medium text-slate-700 mb-1">
                Nội dung lời nhắc ở banner đăng nhập
              </label>
              <input
                id="admin-login-notice-text"
                type="text"
                value={loginNoticeText}
                onChange={(e) => setLoginNoticeText(e.target.value)}
                placeholder="Tài khoản do Quản trị viên cấp..."
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs text-slate-900"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="admin-discord-label" className="block text-xs font-medium text-slate-700 mb-1">
                  Chữ link gạch dưới
                </label>
                <input
                  id="admin-discord-label"
                  type="text"
                  value={loginDiscordLabel}
                  onChange={(e) => setLoginDiscordLabel(e.target.value)}
                  placeholder="nhắn tin trực tiếp cho Admin qua Discord"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="admin-discord-url" className="block text-xs font-medium text-slate-700 mb-1">
                  Link trang Discord
                </label>
                <input
                  id="admin-discord-url"
                  type="url"
                  value={loginDiscordUrl}
                  onChange={(e) => setLoginDiscordUrl(e.target.value)}
                  placeholder="https://discord.com/users/..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono text-xs text-slate-900"
                />
              </div>
            </div>
          </div>

          {aiMsg && (
            <p
              role="status"
              className={`text-xs font-medium ${aiMsg.type === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}
            >
              {aiMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={savingAI}
            className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>{savingAI ? 'Đang lưu...' : 'Lưu cấu hình AI & Thông báo'}</span>
          </button>

          <p className="text-[11px] text-slate-500 flex items-start gap-1.5 leading-relaxed">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              API Key được giữ an toàn phía máy chủ. Trợ lý AI được giới hạn nghiêm ngặt chỉ tư vấn về tài chính &amp; tiết kiệm VNĐ.
            </span>
          </p>
        </form>
      </div>
    </div>
  );
};
