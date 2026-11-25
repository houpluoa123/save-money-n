import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import type {
  DepositMethod,
  DuplicateSerialInfo,
  ScanResult,
  Transaction,
  TransactionType,
} from '../types/finance';
import { formatVND, parseVNDInput, QUICK_DENOMINATIONS } from '../utils/currency';
import { findDuplicateSerial } from '../utils/serial';

interface SavingsEntryViewProps {
  canUseCamera: boolean;
  transactions: Transaction[];
  onScanBill: (imageDataUrl: string) => Promise<{
    ok: boolean;
    result?: ScanResult;
    fallbackModel?: string;
    duplicateWarning?: DuplicateSerialInfo | null;
    error?: string;
  }>;
  onSubmitTransaction: (input: {
    type: TransactionType;
    method: DepositMethod;
    amount: number;
    serialNumber?: string;
    confidence?: number;
    note: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

function compressImageToDataUrl(fileOrVideo: File | HTMLVideoElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Trình duyệt không hỗ trợ xử lý ảnh.'));
      return;
    }

    const drawSource = (source: CanvasImageSource, w: number, h: number) => {
      const maxDim = 1280;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };

    if (fileOrVideo instanceof HTMLVideoElement) {
      if (!fileOrVideo.videoWidth || !fileOrVideo.videoHeight) {
        reject(new Error('Camera chưa sẵn sàng khung hình.'));
        return;
      }
      drawSource(fileOrVideo, fileOrVideo.videoWidth, fileOrVideo.videoHeight);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => drawSource(img, img.width, img.height);
      img.onerror = () => reject(new Error('Không thể đọc file ảnh đã chọn.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh.'));
    reader.readAsDataURL(fileOrVideo);
  });
}

export const SavingsEntryView: React.FC<SavingsEntryViewProps> = ({
  canUseCamera,
  transactions,
  onScanBill,
  onSubmitTransaction,
}) => {
  const [txType, setTxType] = useState<TransactionType>('deposit');
  const [entryMethod, setEntryMethod] = useState<DepositMethod>('manual');
  const [amountInput, setAmountInput] = useState('');
  const [serialInput, setSerialInput] = useState('');
  const [confidence, setConfidence] = useState<number | undefined>(undefined);
  const [noteInput, setNoteInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturedPreview, setCapturedPreview] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanInfo, setScanInfo] = useState('');
  const [serverDuplicate, setServerDuplicate] = useState<DuplicateSerialInfo | null>(null);

  const parsedAmount = parseVNDInput(amountInput);

  const duplicateMatch = useMemo(() => {
    if (txType !== 'deposit' || !serialInput.trim()) return undefined;
    const localDup = findDuplicateSerial(serialInput, transactions);
    if (localDup) return localDup;
    if (
      serverDuplicate &&
      serverDuplicate.serialNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase() ===
        serialInput.replace(/[^A-Z0-9]/gi, '').toUpperCase()
    ) {
      return serverDuplicate;
    }
    return undefined;
  }, [txType, serialInput, transactions, serverDuplicate]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!canUseCamera || txType === 'withdraw') {
      stopCamera();
      setEntryMethod('manual');
    }
  }, [canUseCamera, txType]);

  const startCamera = async () => {
    setCameraError('');
    setFormError('');
    setSuccessBanner('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Trình duyệt không hỗ trợ truy cập Camera trực tiếp. Hãy chọn tải ảnh lên.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setCameraError('Không thể mở Camera. Vui lòng cấp quyền Camera cho trình duyệt hoặc chọn ảnh từ máy.');
    }
  };

  const analyzeImage = async (dataUrl: string) => {
    setCapturedPreview(dataUrl);
    setScanning(true);
    setCameraError('');
    setScanInfo('');
    setFormError('');
    setSuccessBanner('');

    try {
      const res = await onScanBill(dataUrl);
      if (!res.ok || !res.result) {
        setCameraError(res.error || 'Không nhận diện được tờ tiền.');
        return;
      }

      const r = res.result;
      setServerDuplicate(res.duplicateWarning ?? null);
      setEntryMethod('camera');
      setTxType('deposit');
      if (r.amount > 0) {
        setAmountInput(String(r.amount));
      }
      setSerialInput(r.serialNumber || '');
      setConfidence(r.confidence);
      if (r.notes && !noteInput.trim()) {
        setNoteInput(r.notes);
      }

      const confPct = Math.round(r.confidence * 100);
      const modelHint = res.fallbackModel ? ` (${res.fallbackModel})` : '';
      setScanInfo(
        r.serialNumber
          ? `Đã nhận diện${modelHint}: ${formatVND(r.amount)} · Seri ${r.serialNumber} · Độ tin cậy ${confPct}%`
          : `Đã nhận diện mệnh giá ${formatVND(r.amount)} (Độ tin cậy ${confPct}%). Chưa thấy rõ số seri, bạn có thể chụp lại hoặc nhập tay.`
      );
    } finally {
      setScanning(false);
    }
  };

  const handleCaptureFrame = async () => {
    if (!videoRef.current) return;
    try {
      const dataUrl = await compressImageToDataUrl(videoRef.current);
      stopCamera();
      await analyzeImage(dataUrl);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Không chụp được ảnh từ Camera.');
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      stopCamera();
      await analyzeImage(dataUrl);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Không xử lý được ảnh đã chọn.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    setSuccessBanner('');

    if (parsedAmount <= 0) {
      setFormError('Vui lòng nhập hoặc chọn số tiền VNĐ lớn hơn 0.');
      return;
    }

    if (duplicateMatch) {
      setFormError(
        `Số seri ${duplicateMatch.serialNumber} đã tồn tại trong giao dịch ngày ${new Date(
          duplicateMatch.createdAt
        ).toLocaleDateString('vi-VN')}. Không thể nạp trùng 1 tờ tiền.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const activeMethod: DepositMethod =
        txType === 'deposit' && canUseCamera && entryMethod === 'camera' ? 'camera' : 'manual';

      const res = await onSubmitTransaction({
        type: txType,
        method: activeMethod,
        amount: parsedAmount,
        serialNumber: txType === 'deposit' && serialInput.trim() ? serialInput.trim().toUpperCase() : undefined,
        confidence: activeMethod === 'camera' ? confidence : undefined,
        note:
          noteInput.trim() ||
          (txType === 'withdraw'
            ? 'Rút tiết kiệm'
            : activeMethod === 'camera'
              ? 'Quét tờ tiền Camera AI'
              : 'Nạp tiết kiệm'),
      });
      if (!res.ok) {
        setFormError(res.error || 'Không thể lưu giao dịch.');
        return;
      }
      setSuccessBanner(
        txType === 'withdraw'
          ? `Đã ghi nhận rút ${formatVND(parsedAmount)} khỏi quỹ tiết kiệm.`
          : `Đã nạp thành công ${formatVND(parsedAmount)} vào quỹ tiết kiệm.`
      );
      setAmountInput('');
      setSerialInput('');
      setConfidence(undefined);
      setNoteInput('');
      setCapturedPreview('');
      setScanInfo('');
      setServerDuplicate(null);
      setEntryMethod('manual');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Ghi chép Tiết kiệm</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {canUseCamera
              ? 'Quét tờ tiền bằng Camera AI (nhận diện mệnh giá + số seri) hoặc nhập thủ công VNĐ'
              : 'Chọn nạp thêm hoặc rút tiền từ sổ tiết kiệm cá nhân (VNĐ)'}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl" role="tablist" aria-label="Loại giao dịch">
          <button
            type="button"
            role="tab"
            aria-selected={txType === 'deposit'}
            onClick={() => {
              setTxType('deposit');
              setFormError('');
              setSuccessBanner('');
            }}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
              txType === 'deposit'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            <span>Nạp tiết kiệm</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={txType === 'withdraw'}
            onClick={() => {
              setTxType('withdraw');
              setEntryMethod('manual');
              setFormError('');
              setSuccessBanner('');
            }}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
              txType === 'withdraw'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" aria-hidden="true" />
            <span>Rút tiết kiệm</span>
          </button>
        </div>
      </div>

      {successBanner && (
        <div
          role="status"
          className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3.5 text-sm text-emerald-900 flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
          <span className="font-medium">{successBanner}</span>
        </div>
      )}

      {canUseCamera && txType === 'deposit' && (
        <section className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <Camera className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Quét tờ tiền bằng Camera AI</h3>
                <p className="text-xs text-slate-500">
                  Tự đọc mệnh giá &amp; số seri (nếu bị che 1 góc, AI sẽ tự quan sát góc còn lại trên tờ tiền)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!cameraOpen ? (
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={scanning}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" aria-hidden="true" />
                  <span>Mở Camera sau</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                  <span>Tắt Camera</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                <span>Chọn ảnh tờ tiền</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleUploadImage}
                className="hidden"
                aria-label="Chọn ảnh tờ tiền để quét"
              />
            </div>
          </div>

          {cameraOpen && (
            <div className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 relative">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full max-h-72 object-cover"
              />
              <div className="p-3 bg-slate-900 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-300">
                  Đặt tờ tiền rõ nét trong khung hình (ít nhất 1 góc số seri không bị che)
                </p>
                <button
                  type="button"
                  onClick={handleCaptureFrame}
                  disabled={scanning}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Camera className="w-4 h-4" aria-hidden="true" />
                  <span>Chụp &amp; Quét AI</span>
                </button>
              </div>
            </div>
          )}

          {capturedPreview && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl bg-slate-50 border border-slate-200 p-3">
              <img
                src={capturedPreview}
                alt="Ảnh tờ tiền vừa chụp"
                className="w-full sm:w-40 h-24 object-cover rounded-lg border border-slate-200 shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                {scanning ? (
                  <p className="text-xs font-medium text-slate-700 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" aria-hidden="true" />
                    <span>AI đang phân tích mệnh giá và dò số seri ở các góc tờ tiền...</span>
                  </p>
                ) : scanInfo ? (
                  <p className="text-xs font-medium text-emerald-800">{scanInfo}</p>
                ) : null}

                {!scanning && (
                  <button
                    type="button"
                    onClick={() => void analyzeImage(capturedPreview)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Quét lại ảnh này</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {cameraError && (
            <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
              {cameraError}
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 bg-white border border-slate-200/90 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">1. Chọn nhanh mệnh giá VNĐ</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chạm để điền nhanh hoặc cộng thêm vào ô số tiền
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {QUICK_DENOMINATIONS.map((denom) => {
              const isSelected = parsedAmount === denom;
              return (
                <button
                  key={denom}
                  type="button"
                  onClick={() => {
                    setAmountInput(String(denom));
                    setFormError('');
                    setSuccessBanner('');
                  }}
                  className={`min-h-[54px] rounded-xl border px-3 py-2 text-center font-mono tabular-nums text-sm font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-emerald-500 hover:bg-emerald-50/50'
                  }`}
                >
                  {formatVND(denom)}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">Hoặc cộng thêm nhanh:</p>
            <div className="flex flex-wrap gap-2">
              {[50000, 100000, 500000, 1000000].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => setAmountInput(String(parsedAmount + inc))}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-mono font-medium text-slate-800 cursor-pointer"
                >
                  +{inc >= 1000000 ? `${inc / 1000000}Tr` : `${inc / 1000}k`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="lg:col-span-6 bg-white border border-slate-200/90 rounded-2xl p-5 space-y-4"
          noValidate
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              2. Chi tiết giao dịch ({txType === 'withdraw' ? 'Rút ra' : 'Nạp vào'})
            </h3>
            {canUseCamera && txType === 'deposit' && (
              <span className="text-xs font-medium text-slate-500">
                Hình thức: {entryMethod === 'camera' ? 'Quét Camera' : 'Nhập tay'}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="entry-amount" className="block text-sm font-medium text-slate-700 mb-1.5">
              Số tiền (VNĐ)
            </label>
            <input
              id="entry-amount"
              type="text"
              inputMode="numeric"
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value.replace(/[^\d]/g, ''));
                setFormError('');
                setSuccessBanner('');
              }}
              placeholder="Ví dụ: 500000"
              className="w-full h-12 px-3.5 rounded-xl border border-slate-300 bg-white font-mono tabular-nums text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
            />
            <p className="mt-1 text-xs font-mono tabular-nums text-slate-500">
              Hiển thị: <span className="text-slate-900 font-semibold">{formatVND(parsedAmount)}</span>
            </p>
          </div>

          {canUseCamera && txType === 'deposit' && (
            <div>
              <label htmlFor="entry-serial" className="block text-sm font-medium text-slate-700 mb-1.5">
                Số Seri tờ tiền (tự điền khi quét hoặc nhập để chống trùng)
              </label>
              <input
                id="entry-serial"
                type="text"
                value={serialInput}
                onChange={(e) => {
                  setSerialInput(e.target.value.toUpperCase());
                  setFormError('');
                }}
                placeholder="Ví dụ: AB12345678"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white font-mono text-sm text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
              />
            </div>
          )}

          {duplicateMatch && (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-300 px-3.5 py-3 text-xs text-red-800 flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                {'isOtherOwner' in duplicateMatch && duplicateMatch.isOtherOwner ? (
                  <>
                    <p className="font-semibold text-red-900">
                      Cảnh báo an toàn chống lấy tiền: Số seri {duplicateMatch.serialNumber}
                    </p>
                    <p className="mt-0.5">
                      Tờ tiền này ({formatVND(duplicateMatch.amount)}) thuộc quyền sở hữu của tài khoản khác. Hệ thống đã chặn giao dịch và gửi cảnh báo về tài khoản chủ sở hữu.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">Cảnh báo trùng số seri: {duplicateMatch.serialNumber}</p>
                    <p className="mt-0.5">
                      Tờ tiền này ({formatVND(duplicateMatch.amount)}) đã được nạp vào lúc{' '}
                      {new Date(duplicateMatch.createdAt).toLocaleString('vi-VN')}.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="entry-note" className="block text-sm font-medium text-slate-700 mb-1.5">
              Ghi chú
            </label>
            <input
              id="entry-note"
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder={
                txType === 'withdraw'
                  ? 'Ví dụ: Mua đồ dùng, Chi tiêu khẩn cấp...'
                  : 'Ví dụ: Lương tháng, Tiền thưởng, Tiết kiệm tuần...'
              }
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
            />
          </div>

          {formError && (
            <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || scanning || Boolean(duplicateMatch)}
            className={`w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 ${
              txType === 'withdraw'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            <span>
              {submitting
                ? 'Đang lưu...'
                : txType === 'withdraw'
                  ? 'Xác nhận rút tiết kiệm'
                  : 'Xác nhận nạp tiết kiệm'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
