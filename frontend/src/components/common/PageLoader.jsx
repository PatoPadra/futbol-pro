import React from 'react';

export default function PageLoader({ label = 'Cargando...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-9 h-9 border-4 border-turf border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
