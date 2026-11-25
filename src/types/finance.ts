export type TransactionType = 'deposit' | 'withdraw';

export type DepositMethod = 'camera' | 'manual';

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  isRootAdmin?: boolean;
  mustChangePassword: boolean;
  isLocked: boolean;
  canUseCamera: boolean;
  canUseChat: boolean;
  createdAt?: string;
}

export interface LoginNoticeConfig {
  noticeText: string;
  discordLabel: string;
  discordUrl: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  method: DepositMethod;
  amount: number;
  serialNumber?: string;
  confidence?: number;
  note: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DuplicateSerialInfo {
  id: string;
  amount: number;
  serialNumber: string;
  createdAt: string;
  isOtherOwner?: boolean;
}

export interface SecurityAlert {
  id: string;
  actorUsername: string;
  actorDisplayName: string;
  serialNumber: string;
  amount: number;
  method: 'camera' | 'manual';
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ScanResult {
  amount: number;
  serialNumber: string;
  confidence: number;
  currency?: string;
  notes?: string;
}

export type AIProviderMode = 'server' | 'anthropic' | 'openai_compatible' | 'gemini' | 'openai';

export interface AdminAISettings {
  provider: AIProviderMode;
  apiKey: string;
  hasSavedApiKey?: boolean;
  baseUrl: string;
  model: string;
  visionModel: string;
  allowUserCamera: boolean;
  allowUserChat: boolean;
  loginNoticeText?: string;
  loginDiscordLabel?: string;
  loginDiscordUrl?: string;
}

export interface SavingsGoal {
  targetAmount: number;
  label: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface BackupPayload {
  version: number;
  exportedAt: string;
  goal: SavingsGoal;
  transactions: Transaction[];
}

export type AppTab = 'dashboard' | 'entry' | 'history' | 'advisor' | 'settings' | 'admin';
