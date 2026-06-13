import React from 'react';

export function FieldRow({ label, required, error, hint, children }) {
  return (
    <div className="flex flex-col">
      {label && (
        <label className={`field-label ${required ? 'field-required' : ''}`}>
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="field-help">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export function FieldGrid({ children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
      {children}
    </div>
  );
}
