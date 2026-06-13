import React, { forwardRef } from 'react';
import clsx from 'clsx';

export const MoneyInput = forwardRef(({ className, ...props }, ref) => {
  return (
    <div className="relative flex items-center w-full">
      <span className="absolute left-3 font-mono text-steel z-10 select-none">₹</span>
      <input 
        ref={ref}
        type="number"
        step="0.01"
        className={clsx("field w-full pl-8 font-mono text-right", className)}
        {...props}
      />
    </div>
  );
});

MoneyInput.displayName = 'MoneyInput';
