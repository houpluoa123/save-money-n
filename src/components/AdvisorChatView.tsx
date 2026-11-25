import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquareText, Send, Sparkles, Trash2 } from 'lucide-react';
import type { ChatMessage, SavingsGoal } from '../types/finance';
import { formatVND } from '../utils/currency';

interface AdvisorChatViewProps {
  totalBalance: number;
  goal: SavingsGoal;
  messages: ChatMessage[];
  onSendMessage: (message: string) => Promise<{ ok: boolean; error?: string }>;
  onClearMessages: () => Promise<void>;
}

const SUGGESTED_PROMPTS = [
  'Với số dư hiện tại tôi nên phân bổ tiết kiệm như thế nào?',
  'Lập kế hoạch giúp tôi tiết kiệm thêm 10 triệu trong 3 tháng tới',
  'Mẹo cắt giảm chi tiêu hàng tháng mà không ảnh hưởng sinh hoạt',
  'Đặt mục tiêu quỹ dự phòng khẩn cấp bao nhiêu là hợp lý?',
];

export const AdvisorChatView: React.FC<AdvisorChatViewProps> = ({
  totalBalance,
  goal,
  messages,
  onSendMessage,
  onClearMessages,
}) => {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending]);

  const submitPrompt = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError('');
    setInput('');
    setSending(true);
    try {
      const res = await onSendMessage(trimmed);
      if (!res.ok) {
        setError(res.error || 'Không thể kết nối Trợ lý AI Tài chính.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitPrompt(input);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <MessageSquareText className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Trợ lý AI Tài chính</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              Số dư hiện tại: <span className="font-semibold text-emerald-700">{formatVND(totalBalance)}</span> · Mục tiêu: {formatVND(goal.targetAmount)}
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          confirmClear ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void onClearMessages();
                  setConfirmClear(false);
                }}
                className="min-h-[38px] px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                Xác nhận xóa
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="min-h-[38px] px-3 rounded-xl border border-slate-300 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Hủy
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Xóa hội thoại</span>
            </button>
          )
        )}
      </div>

      <div className="bg-white border border-slate-200/90 rounded-2xl flex flex-col h-[calc(100vh-270px)] min-h-[420px] max-h-[680px]">
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="py-8 max-w-lg mx-auto text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Tư vấn kế hoạch tiết kiệm theo số dư thực tế
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Trợ lý tự động nắm số dư quỹ tiết kiệm của bạn trong cơ sở dữ liệu để gợi ý phân bổ và kế hoạch tích lũy phù hợp.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-left">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={sending}
                    onClick={() => void submitPrompt(prompt)}
                    className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:border-emerald-500 hover:bg-emerald-50/40 text-xs text-slate-700 font-medium transition-colors cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-800 border border-slate-200/60'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })
          )}

          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-100 border border-slate-200/60 px-4 py-3 text-xs text-slate-600 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-700" aria-hidden="true" />
                <span>Đang phân tích số dư &amp; soạn tư vấn...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {error && (
          <div
            role="alert"
            className="mx-4 mb-2 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-3 sm:p-4 border-t border-slate-100 flex items-center gap-2">
          <input
            type="text"
            aria-label="Nhập câu hỏi tư vấn tiết kiệm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            placeholder="Hỏi cách phân bổ số tiền, đặt mục tiêu tiết kiệm..."
            className="flex-1 h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Gửi câu hỏi tài chính"
            className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Gửi</span>
          </button>
        </form>
      </div>
    </div>
  );
};
