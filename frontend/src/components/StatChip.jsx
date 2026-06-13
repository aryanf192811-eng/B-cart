import clsx from 'clsx';

export default function StatChip({ label, count, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={clsx(
        "h-[28px] inline-flex items-center px-3 gap-2 rounded-full border-[0.5px] text-[12px] transition-colors",
        active 
          ? "bg-ink text-white border-ink" 
          : "bg-white text-steel border-rule hover:border-ink hover:text-ink"
      )}
    >
      <span className="font-medium tracking-wide">{label}</span>
      <span className={clsx("font-mono", active ? "text-paper" : "text-ink")}>
        {count}
      </span>
    </button>
  );
}
