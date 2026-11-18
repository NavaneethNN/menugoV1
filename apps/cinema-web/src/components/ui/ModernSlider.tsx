'use client';

import React, { useState } from 'react';

export interface ModernSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
  formatValue?: (val: number) => string;
  className?: string;
  showTooltip?: boolean;
}

export function ModernSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  unit = '',
  formatValue,
  className = '',
  showTooltip = true
}: ModernSliderProps) {
  const [isHovered, setIsHovered] = useState(false);
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const displayVal = formatValue ? formatValue(value) : `${value}${unit ? ` ${unit}` : ''}`;

  return (
    <div className={`w-full select-none ${className}`}>
      {/* Optional Top Label & Current Value Pill */}
      {label && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-700 tracking-tight">{label}</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-red-50 text-red-700 border border-red-200/80 text-xs font-black">
            {displayVal}
          </span>
        </div>
      )}

      {/* Modern Slider Track Container */}
      <div
        className="relative py-2 flex items-center cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Track Base */}
        <div className="w-full h-2 rounded-full bg-slate-200 relative overflow-hidden">
          {/* Active Gradient Fill */}
          <div
            className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full transition-all duration-75"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Real Native Hidden Input for Keyboard and Touch Accessibility */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          aria-label={label || 'Adjustment slider'}
        />

        {/* Custom Glowing Modern Thumb Indicator */}
        <div
          className={`absolute w-5 h-5 rounded-full bg-white border-2 border-red-600 shadow-md shadow-red-600/30 pointer-events-none transition-transform z-10 ${
            isHovered ? 'scale-125' : 'scale-100'
          }`}
          style={{
            left: `calc(${percentage}% - 10px)`
          }}
        />

        {/* Floating Value Tooltip Bubble */}
        {showTooltip && isHovered && (
          <div
            className="absolute -top-7 transform -translate-x-1/2 pointer-events-none z-30 px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-black shadow-lg"
            style={{ left: `${percentage}%` }}
          >
            {displayVal}
          </div>
        )}
      </div>

      {/* Min / Max Labels */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold px-0.5 mt-0.5">
        <span>{formatValue ? formatValue(min) : `${min}${unit}`}</span>
        <span>{formatValue ? formatValue(max) : `${max}${unit}`}</span>
      </div>
    </div>
  );
}
