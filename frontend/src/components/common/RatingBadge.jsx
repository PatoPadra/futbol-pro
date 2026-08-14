import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRatingTone } from '@/utils/ratings';

const SIZE_CLASSES = {
  sm: 'h-5 px-1.5 text-[11px] gap-0.5',
  md: 'h-6 px-2 text-xs gap-1',
  lg: 'h-8 px-2.5 text-sm gap-1',
};

// Filled color chip for a 1-10 rating (Sofascore-style: solid color + bold
// number, not just colored text) — for compact spots like a list row or a
// player card. For a larger in-place value display (e.g. a stepper next to
// a slider), use getRatingTone() directly for the softer tint treatment.
export default function RatingBadge({ value, size = 'md', showIcon = true, className, ...props }) {
  const tone = getRatingTone(value);
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold text-white tabular-nums',
        tone.solid,
        SIZE_CLASSES[size] || SIZE_CLASSES.md,
        className
      )}
      title={tone.label}
      {...props}
    >
      {showIcon && <Star className="w-3 h-3 fill-current shrink-0" />}
      {value != null ? Number(value).toFixed(1) : '—'}
    </span>
  );
}
