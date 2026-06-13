import { useState, useEffect } from 'react';

export default function WorkOrderTimer({ workOrder, onAction }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let interval = null;
    const computeElapsed = () => {
      let seconds = workOrder.real_duration_secs || 0;
      if (workOrder.status === 'in_progress' && workOrder.last_resume_at) {
        seconds += Math.floor((new Date() - new Date(workOrder.last_resume_at)) / 1000);
      }
      return seconds;
    };


    if (workOrder.status === 'in_progress') {
      interval = setInterval(() => {
        setElapsed(computeElapsed());
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [workOrder.status, workOrder.last_resume_at, workOrder.real_duration_secs]);

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const status = workOrder.status;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="font-mono text-[13px] text-ink min-w-[70px]">
        {status === 'pending' ? '—' : formatTime(elapsed)}
      </div>
      
      {status === 'paused' && (
        <span className="text-[10px] uppercase font-semibold text-rust tracking-wider bg-rustBg px-1.5 py-0.5 rounded-sm">PAUSED</span>
      )}

      <div className="flex gap-2">
        {status === 'pending' && (
          <button className="btn btn-rust btn-sm" onClick={() => onAction('start')}>Start</button>
        )}
        {status === 'in_progress' && (
          <>
            <button className="btn btn-sm" onClick={() => onAction('pause')}>Pause</button>
            <button className="btn btn-primary btn-sm" onClick={() => onAction('done')}>Done</button>
          </>
        )}
        {status === 'paused' && (
          <button className="btn btn-rust btn-sm" onClick={() => onAction('resume')}>Resume</button>
        )}
      </div>
    </div>
  );
}
