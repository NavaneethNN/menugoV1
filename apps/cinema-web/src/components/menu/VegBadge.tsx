'use client';

import React from 'react';

/**
 * Indian FSSAI-compliant Veg / Non-Veg Badges
 * High-contrast, pixel-perfect square with rounded corners and centered circle dot.
 */
export function VegBadge({ className = '' }: { className?: string }) {
  return (
    <div
      className={`w-4 h-4 rounded-[4px] border-[1.5px] border-emerald-600 flex items-center justify-center p-[2px] bg-white shrink-0 shadow-xs ${className}`}
      title="Vegetarian"
      aria-label="Vegetarian"
    >
      <div className="w-2 h-2 rounded-full bg-emerald-600" />
    </div>
  );
}

export function NonVegBadge({ className = '' }: { className?: string }) {
  return (
    <div
      className={`w-4 h-4 rounded-[4px] border-[1.5px] border-rose-700 flex items-center justify-center p-[2px] bg-white shrink-0 shadow-xs ${className}`}
      title="Non-Vegetarian"
      aria-label="Non-Vegetarian"
    >
      <div className="w-2 h-2 rounded-full bg-rose-700" />
    </div>
  );
}
