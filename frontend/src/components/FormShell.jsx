import React from 'react';
import clsx from 'clsx';
import StatusBadge from './StatusBadge';

function FormShell({ children }) {
  const header = React.Children.toArray(children).find(c => c.type === Header);
  const tabs = React.Children.toArray(children).find(c => c.type === Tabs);
  const body = React.Children.toArray(children).find(c => c.type === Body);
  const side = React.Children.toArray(children).find(c => c.type === Side);

  return (
    <div className="flex flex-col min-h-full gap-6">
      {header}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="w-full lg:w-[70%] flex flex-col gap-6">
          {tabs}
          {body}
        </div>
        <div className="w-full lg:w-[30%] flex flex-col gap-6">
          {side}
        </div>
      </div>
    </div>
  );
}

function Header({ title, subtitle, reference, status }) {
  return (
    <div className="h-[80px] bg-white border-[0.5px] border-rule rounded-md px-6 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-steel mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4 text-right">
        {status && <StatusBadge status={status} />}
        {reference && <span className="font-mono text-lg font-medium text-ink">{reference}</span>}
      </div>
    </div>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs w-full">
      {tabs.map(t => (
        <div 
          key={t.id} 
          className={clsx('tab', active === t.id && 'tab-active')}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </div>
      ))}
    </div>
  );
}

function Body({ children }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}

function Side({ children }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}

FormShell.Header = Header;
FormShell.Tabs = Tabs;
FormShell.Body = Body;
FormShell.Side = Side;

export default FormShell;
