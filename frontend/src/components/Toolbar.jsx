import React from 'react';

export default function Toolbar({ title, count, search, filters, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {count !== undefined && (
          <span className="font-mono text-[12px] bg-paper2 text-steel px-2 py-0.5 rounded-sm">
            {count}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 flex-1 sm:justify-end">
        {search && (
          <div className="w-full sm:w-[40%] max-w-[320px]">
            {search}
          </div>
        )}
        {filters && (
          <div className="flex items-center gap-2">
            {filters}
          </div>
        )}
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
