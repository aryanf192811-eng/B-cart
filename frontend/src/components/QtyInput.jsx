import React, { forwardRef } from 'react';
import clsx from 'clsx';

export const QtyInput = forwardRef(({ unit, className, ...props }, ref) => {
  return (
    <div className="relative flex items-center w-full">
      <input 
        ref={ref}
        type="number"
        step="1"
        className={clsx("field w-full pr-12 font-mono text-right", className)}
        {...props}
      />
      {unit && (
        <span className="absolute right-3 font-mono text-steel z-10 select-none bg-white pl-1">
          {unit}
        </span>
      )}
    </div>
  );
});

QtyInput.displayName = 'QtyInput';
