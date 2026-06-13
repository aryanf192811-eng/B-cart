import { useState, useEffect } from 'react';
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
    const handler = () => queryClient.invalidateQueries(['manufacturing']);
    socket.on('mo:update', handler);
    return () => socket.off('mo:update', handler);
  }, [socket, queryClient]);

  const { data: counts } = useQuery({
    queryKey: ['manufacturing', 'counts'],
    queryFn: async () => (await api.get(E.moCounts())).data
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ['manufacturing', statusFilter, mineFilter],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (statusFilter !== 'All') p.set('status', statusFilter.toLowerCase().replace(/ /g, '_'));
      if (mineFilter) p.set('mine', 'true');
      return (await api.get(`${E.mo()}?${p.toString()}`)).data;
    }
  });

  const filters = ['All', 'Draft', 'Confirmed', 'In progress', 'To close', 'Done', 'Late', 'Not assigned'];
  const getCount = (f) => {
    if (!counts) return 0;
    if (f === 'All') return counts.total || 0;
    return counts[f.toLowerCase().replace(/ /g, '_')] || 0;
  };

  const columns = [
    { key: 'moNumber', label: 'REF', render: (r) => <span className="font-mono">{r.moNumber}</span>, width: '110px' },
    { key: 'scheduledDate', label: 'START DATE', render: (r) => r.scheduledDate ? format(new Date(r.scheduledDate), 'dd MMM yyyy') : '—' },
    { key: 'finishedProduct', label: 'FINISHED PRODUCT', render: (r) => r.finishedProduct?.name || '—' },
    { key: 'quantityToProduce', label: 'QTY', render: (r) => <span className="font-mono">{r.quantityToProduce}</span> },
    { key: 'components', label: 'COMPONENT STATUS', render: (r) => (
        r.components_available 
          ? <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-successBg text-success">Available</span>
          : <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-dangerBg text-danger">Not available</span>
      ) 
    },
    { key: 'status', label: 'STATE', render: (r) => <StatusBadge status={r.status} /> }
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      <Toolbar 
        title="Manufacturing orders" 
        count={counts?.total || 0}
        actions={<button onClick={() => navigate('/manufacturing/new')} className="btn btn-rust">New</button>}
      />

      <div className="flex items-center justify-between overflow-x-auto no-scrollbar pb-2">
        <div className="flex items-center gap-2">
          {filters.map(f => (
            <StatChip 
              key={f} label={f} count={getCount(f)} active={statusFilter === f}
              onClick={() => {
                const p = new URLSearchParams(searchParams);
                p.set('status', f); setSearchParams(p);
              }}
            />
          ))}
        </div>
        <StatChip 
          label="My" count={counts?.mine || 0} active={mineFilter}
          onClick={() => {
            const p = new URLSearchParams(searchParams);
            mineFilter ? p.delete('mine') : p.set('mine', 'true');
            setSearchParams(p);
          }}
        />
      </div>

      <div className="flex-1 bg-white border-[0.5px] border-rule rounded-md overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-auto">
          <DataTable 
            columns={columns}
            rows={listData}
            loading={isLoading}
            onRowClick={(r) => navigate(`/manufacturing/${r._id || r.id}`)}
            emptyMessage="No manufacturing orders found."
          />
        </div>
      </div>
    </div>
  );
}
