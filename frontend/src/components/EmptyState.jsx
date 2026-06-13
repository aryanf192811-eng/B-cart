import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border-[0.5px] border-rule rounded-md w-full h-full min-h-[300px]">
      <div className="w-12 h-12 rounded-full bg-paper2 flex items-center justify-center text-steel mb-4">
        {Icon && <Icon size={24} strokeWidth={1.5} />}
      </div>
      <h3 className="text-[14px] font-semibold text-ink mb-1">{title}</h3>
      {description && (
        <p className="text-[13px] text-steel max-w-sm mb-6">{description}</p>
      )}
      {action && (
        <div>{action}</div>
      )}
    </div>
  );
}
