import React from 'react';
import clsx from 'clsx';

export default function Avatar({ name, size = '28px', className }) {
  const initials = name 
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) 
    : '??';

  const isSmall = size === '28px';

  return (
    <div 
      className={clsx(
        "bg-ink text-white rounded-sm flex items-center justify-center font-medium tracking-wider select-none shrink-0",
        isSmall ? "w-[28px] h-[28px] text-[11px]" : "w-[36px] h-[36px] text-[14px]",
        className
      )}
      title={name}
    >
      {initials}
    </div>
  );
}
