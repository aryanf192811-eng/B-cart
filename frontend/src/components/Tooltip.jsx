import { Info } from 'lucide-react';

export default function Tooltip({ children, content, icon = true }) {
  return (
    <div className="relative group inline-flex items-center gap-1.5 cursor-help">
      {children}
      {icon && <Info size={14} className="text-steel hover:text-ink transition-colors" />}
      
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[250px] bg-ink text-white text-[12px] p-2 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-ink"></div>
      </div>
    </div>
  );
}
