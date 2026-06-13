import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import { useSocket } from '../../hooks/useSocket';
import Toolbar from '../../components/Toolbar';
import StatChip from '../../components/StatChip';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';

export default function ManufacturingList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const statusFilter = searchParams.get('status') || 'All';
  const mineFilter = searchParams.get('mine') === 'true';

  useEffect(() => {
    if (!socket) return;
    const handler = () => queryClient.invalidateQueries({ queryKey: ['manufacturing'] });
    socket.on('mo:created', handler);
    socket.on('mo:confirmed', handler);
    socket.on('mo:produced', handler);
    socket.on('mo:cancelled', handler);
    socket.on('mo:updated', handler);
    socket.on('wo:start', handler);
    socket.on('wo:done', handler);
    return () => {
      socket.off('mo:created', handler);
      socket.off('mo:confirmed', handler);
      socket.off('mo:produced', handler);
      socket.off('mo:cancelled', handler);
      socket.off('mo:updated', handler);
      socket.off('wo:start', handler);
      socket.off('wo:done', handler);
    };
  }, [socket, queryClient]);

  // Backend returns { counts: { all, draft, confirmed, ... } }
  const { data: countsData } = useQuery({
    queryKey: ['manufacturing', 'counts'],
    queryFn: async () => (await api.get(E.moCounts())).data
  });
  const counts = countsData?.counts || {};

  // Backend returns { rows: [...], total, page, limit }
  const { data: listData, isLoading } = useQuery({
    queryKey: ['manufacturing', statusFilter, mineFilter],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (statusFilter !== 'All') p.set('status', statusFilter.toLowerCase().replace(/ /g, '_'));
      if (mineFilter) p.set('mine', 'true');
      return (await api.get(`${E.mo()}?${p.toString()}`)).data;
    }
  });

  const rows = listData?.rows || [];

  const filters = ['All', 'Draft', 'Confirmed', 'In progress', 'To close', 'Done', 'Late', 'Not assigned'];
  const getCount = (f) => {
    if (f === 'All') return parseInt(counts.all) || 0;
    return parseInt(counts[f.toLowerCase().replace(/ /g, '_')]) || 0;
  };

  // Backend field names: mo_number, schedule_date, product_name, qty, status, assignee_name
  const columns = [
    { key: 'mo_number', label: 'REF', render: (r) => <span className="font-mono text-[13px]">{r.mo_number}</span>, width: '120px' },
    { key: 'schedule_date', label: 'START DATE', render: (r) => r.schedule_date ? format(new Date(r.schedule_date), 'dd MMM yyyy') : '—' },
    { key: 'product_name', label: 'FINISHED PRODUCT' },
    { key: 'qty', label: 'QTY', render: (r) => <span className="font-mono">{parseFloat(r.qty).toFixed(0)}</span> },
    { key: 'assignee_name', label: 'ASSIGNEE', render: (r) => r.assignee_name || <span className="text-steel italic">Unassigned</span> },
    { key: 'status', label: 'STATE', render: (r) => <StatusBadge status={r.status} /> }
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      <Toolbar
        title="Manufacturing Orders"
        count={parseInt(counts.all) || 0}
        actions={<button onClick={() => navigate('/manufacturing/new')} className="btn btn-rust">New</button>}
      />

      <div className="flex items-center justify-between overflow-x-auto no-scrollbar pb-2">
        <div className="flex items-center gap-2">
          {filters.map(f => (
            <StatChip
              key={f} label={f} count={getCount(f)} active={statusFilter === f}
              onClick={() => { const p = new URLSearchParams(searchParams); p.set('status', f); setSearchParams(p); }}
            />
          ))}
        </div>
        <StatChip
          label="My" count={parseInt(counts.mine) || 0} active={mineFilter}
          onClick={() => { const p = new URLSearchParams(searchParams); mineFilter ? p.delete('mine') : p.set('mine', 'true'); setSearchParams(p); }}
        />
      </div>

      <div className="flex-1 bg-white border-[0.5px] border-rule rounded-md overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-auto">
          <DataTable
            columns={columns}
            rows={rows}
            loading={isLoading}
            onRowClick={(r) => navigate(`/manufacturing/${r.id}`)}
            emptyMessage="No manufacturing orders found."
          />
        </div>
      </div>
    </div>
  );
}
