import React from 'react';

export default function PageLoader() {
  return (
    <div className="flex justify-center py-20" role="status" aria-live="polite">
      <div className="w-8 h-8 border-4 border-turf border-t-transparent rounded-full animate-spin" />
      <span className="sr-only">Cargando...</span>
    </div>
  );
}
