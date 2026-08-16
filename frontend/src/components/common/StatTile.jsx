import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const TONE_CLASSES = {
  turf: 'bg-turf/10 text-turf-accessible',
  orange: 'bg-orange/10 text-orange-accessible',
  charcoal: 'bg-secondary/10 text-secondary',
  slate: 'bg-slate-100 text-slate-500',
};

// Shared "icon in a colored square + big number + label" tile. Same shape
// as the KPI row on Dashboard.js; PlayerProfile.js and PlayerHistory.js
// previously duplicated a lesser bare-icon version of this byte-for-byte.
export default function StatTile({ icon: Icon, value, label, tone = 'turf', className }) {
  return (
    <Card className={cn('border-slate-100', className)} data-testid="stat-tile">
      <CardContent className="p-4 text-center">
        {Icon && (
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2',
              TONE_CLASSES[tone] || TONE_CLASSES.turf
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
        <p className="text-xl font-bold text-slate-900 tabular-nums">{value}</p>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
