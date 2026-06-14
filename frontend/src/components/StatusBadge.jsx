import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { E } from '../api/endpoints';

// Fallback logic until query loads to avoid UI flash
export const STATUS_LABELS = {
  draft: 'Draft', confirmed: 'Confirmed', partially_delivered: 'Partial',
  partially_received: 'Partial', fully_delivered: 'Delivered', fully_received: 'Received',
  in_progress: 'In progress', paused: 'Paused', to_close: 'To close', done: 'Done',
  cancelled: 'Cancelled', pending: 'Pending', passed: 'Passed', failed: 'Failed',
  unpaid: 'Unpaid', paid: 'Paid'
};

export const STATUS_CLASS = {
  draft: 'badge-draft', confirmed: 'badge-confirmed', partially_delivered: 'badge-partial',
  partially_received: 'badge-partial', fully_delivered: 'badge-done', fully_received: 'badge-done',
  in_progress: 'badge-progress', paused: 'badge-progress', to_close: 'badge-progress', done: 'badge-done',
  cancelled: 'badge-cancelled', pending: 'badge-draft', passed: 'badge-done', failed: 'badge-cancelled',
  unpaid: 'badge-draft', paid: 'badge-done'
};

export default function StatusBadge({ status }) {
  const { data: config } = useQuery({
    queryKey: ['system-config'],
    queryFn: async () => (await api.get(E.config())).data,
    staleTime: Infinity,
    cacheTime: Infinity
  });

  const norm = String(status).toLowerCase().replace(/ /g, '_');
  
  const labelsMap = config?.statusLabels || STATUS_LABELS;
  const classMap = config?.statusClass || STATUS_CLASS;

  const label = labelsMap[norm] || status;
  const className = classMap[norm] || 'badge-draft';
  
  return (
    <span className={clsx('badge', className)}>
      {label}
    </span>
  );
}
