import React, { useState } from 'react';
import type { GrowthPoint } from '../utils/analytics';
import { formatCompactVND, formatVND } from '../utils/currency';

interface GrowthChartProps {
  points: GrowthPoint[];
  granularity: 'day' | 'month';
}

export const GrowthChart: React.FC<GrowthChartProps> = ({ points, granularity }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-slate-500">
        Chưa có dữ liệu biểu đồ
      </div>
    );
  }

  const width = 680;
  const height = 240;
  const padLeft = 58;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const minCumulative = Math.min(0, ...points.map((p) => p.cumulativeAmount));
  const maxCumulative = Math.max(100_000, ...points.map((p) => p.cumulativeAmount));
  const cumulativeRange = Math.max(100_000, maxCumulative - minCumulative);
  const maxAbsPeriod = Math.max(100_000, ...points.map((p) => Math.abs(p.periodAmount)));

  const stepX = points.length > 1 ? plotW / (points.length - 1) : plotW;
  const barWidth = Math.max(8, Math.min(26, (plotW / points.length) * 0.45));

  const coords = points.map((pt, idx) => {
    const x = padLeft + (points.length > 1 ? idx * stepX : plotW / 2);
    const ratio = (pt.cumulativeAmount - minCumulative) / cumulativeRange;
    const clampedY = Math.max(padTop, Math.min(padTop + plotH, padTop + plotH - ratio * plotH));
    const barH = Math.min(plotH * 0.65, (Math.abs(pt.periodAmount) / maxAbsPeriod) * (plotH * 0.65));
    return { x, y: clampedY, barH, isWithdrawDay: pt.periodAmount < 0, pt };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const yTicks = [0, 0.5, 1].map((ratio) => ({
    y: padTop + plotH * (1 - ratio),
    value: Math.round(minCumulative + cumulativeRange * ratio),
  }));

  const selected = activeIndex !== null ? coords[activeIndex] : coords[coords.length - 1];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-emerald-600 inline-block" aria-hidden="true" />
            <span>Tổng lũy kế</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-200 inline-block" aria-hidden="true" />
            <span>Biến động {granularity === 'day' ? 'trong ngày' : 'trong tháng'}</span>
          </span>
        </div>

        {selected && (
          <div className="font-mono tabular-nums text-slate-800">
            <span>{selected.pt.label}</span>
            <span aria-hidden="true" className="mx-1.5 text-slate-400">·</span>
            <span className="font-semibold text-emerald-700">{formatVND(selected.pt.cumulativeAmount)}</span>
            {selected.pt.periodAmount !== 0 && (
              <>
                <span aria-hidden="true" className="mx-1.5 text-slate-400">·</span>
                <span className={selected.pt.periodAmount < 0 ? 'text-amber-700' : 'text-slate-600'}>
                  {selected.pt.periodAmount > 0 ? `+${formatVND(selected.pt.periodAmount)}` : formatVND(selected.pt.periodAmount)}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block select-none"
          role="img"
          aria-label={`Biểu đồ tăng trưởng tiết kiệm theo ${granularity === 'day' ? 'ngày' : 'tháng'}`}
        >
          <defs>
            <linearGradient id="savingsAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {yTicks.map((tick, idx) => (
            <g key={idx}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={tick.y}
                y2={tick.y}
                stroke="#E2E8F0"
                strokeDasharray={idx === 0 ? undefined : '3 3'}
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-mono tabular-nums"
              >
                {formatCompactVND(tick.value)}
              </text>
            </g>
          ))}

          {coords.map((c, idx) => {
            const fill = c.isWithdrawDay
              ? activeIndex === idx
                ? '#F59E0B'
                : '#FDE68A'
              : activeIndex === idx
                ? '#34D399'
                : '#A7F3D0';
            return (
              <rect
                key={`bar-${c.pt.key}`}
                x={c.x - barWidth / 2}
                y={padTop + plotH - c.barH}
                width={barWidth}
                height={Math.max(0, c.barH)}
                rx={3}
                fill={fill}
              />
            );
          })}

          {areaPath && <path d={areaPath} fill="url(#savingsAreaGradient)" />}

          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#059669"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {coords.map((c, idx) => {
            const showLabel =
              granularity === 'month' ||
              idx === 0 ||
              idx === coords.length - 1 ||
              idx % 3 === 0;
            const isSelected = activeIndex === idx;

            return (
              <g
                key={c.pt.key}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => setActiveIndex(idx)}
                className="cursor-pointer"
              >
                <rect
                  x={c.x - Math.max(16, stepX / 2)}
                  y={padTop}
                  width={Math.max(32, stepX)}
                  height={plotH + 24}
                  fill="transparent"
                />
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isSelected ? 5 : 3}
                  fill={isSelected ? '#059669' : '#FFFFFF'}
                  stroke="#059669"
                  strokeWidth="2"
                />
                {showLabel && (
                  <text
                    x={c.x}
                    y={height - 10}
                    textAnchor="middle"
                    className={`text-[10px] font-mono tabular-nums ${
                      isSelected ? 'fill-slate-900 font-semibold' : 'fill-slate-500'
                    }`}
                  >
                    {c.pt.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
