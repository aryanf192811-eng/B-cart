import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Drawer({ isOpen, onClose, title, subtitle, children, footer }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div 
        className="fixed inset-0" style={{ background: 'rgba(15,20,25,0.45)' }}
        onClick={onClose}
      ></div>

      {/* Panel */}
      <div className="relative bg-white border-l-[0.5px] border-rule w-full max-w-[420px] h-full flex flex-col shadow-none transform transition-transform">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b-[0.5px] border-rule">
          <div>
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {subtitle && <div className="mt-1">{subtitle}</div>}
          </div>
          <button 
            onClick={onClose}
            className="text-steel hover:text-ink transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t-[0.5px] border-rule flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
