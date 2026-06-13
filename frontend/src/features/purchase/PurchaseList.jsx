import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutList, LayoutGrid } from 'lucide-react';
import { format } from 'date-fns';

import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import { useSocket } from '../../hooks/useSocket';
import Toolbar from '../../components/Toolbar';
import StatChip from '../../components/StatChip';
import DataTable from '../../components/DataTable';
import StatusBadge, { STATUS_LABELS } from '../../components/StatusBadge';

export default function PurchaseList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const [view, setView] = useState('list');
  const statusFilter = searchParams.get('status') || 'All';
  const mineFilter = searchParams.get('mine') === 'true';

  useEffect(() => {
    if (!socket) return;
    const handler = () => queryClient.invalidateQueries({ queryKey: ['purchase'] });
    socket.on('purchase:created', handler);
    socket.on('purchase:confirmed', handler);
    socket.on('purchase:received', handler);
    socket.on('purchase:cancelled', handler);
    socket.on('purchase:paid', handler);
    return () => {
      socket.off('purchase:created', handler);
      socket.off('purchase:confirmed', handler);
      socket.off('purchase:received', handler);
      socket.off('purchase:cancelled', handler);
      socket.off('purchase:paid', handler);
    };
  }, [socket, queryClient]);

  // Backend returns { counts: { all, draft, confirmed, ... } }
  const { data: countsData } = useQuery({
    queryKey: ['purchase', 'counts'],
    queryFn: async () => (await api.get(E.purchaseCounts())).data
  });
  const counts = countsData?.counts || {};

  // Backend returns { rows: [...], total, page, limit }
  const { data: listData, isLoading } = useQuery({
    queryKey: ['purchase', statusFilter, mineFilter],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (statusFilter !== 'All') p.set('status', statusFilter.toLowerCase().replace(/ /g, '_'));
      if (mineFilter) p.set('mine', 'true');
      return (await api.get(`${E.purchase()}?${p.toString()}`)).data;
    }
  });

  const rows = listData?.rows || [];

  const filters = ['All', 'Draft', 'Confirmed', 'Partial', 'Received', 'Late'];
  const getCount = (f) => {
    if (f === 'All') return parseInt(counts.all) || 0;
    if (f === 'Partial') return parseInt(counts.partially_received) || 0;
    if (f === 'Received') return parseInt(counts.fully_received) || 0;
    return parseInt(counts[f.toLowerCase()]) || 0;
  };

  // Backend field names: po_number, vendor_name, responsible_name, expected_delivery_date, total_amount, created_at, status
  const columns = [
    { key: 'po_number', label: 'REF', render: (r) => <span className="font-mono text-[13px]">{r.po_number}</span>, width: '120px' },
    { key: 'created_at', label: 'DATE', render: (r) => format(new Date(r.created_at || Date.now()), 'dd MMM yyyy') },
    { key: 'vendor_name', label: 'VENDOR' },
    { key: 'responsible_name', label: 'RESPONSIBLE', render: (r) => r.responsible_name || '—' },
    { key: 'expected_delivery_date', label: 'EXPECTED', render: (r) => r.expected_delivery_date ? format(new Date(r.expected_delivery_date), 'dd MMM yyyy') : '—' },
    { key: 'total_amount', label: 'TOTAL', align: 'right', render: (r) => <span className="font-mono">₹ {(parseFloat(r.total_amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span> },
    { key: 'status', label: 'STATUS', render: (r) => <StatusBadge status={r.status} /> }
  ];

  const kanbanStages = ['draft', 'confirmed', 'partially_received', 'fully_received', 'cancelled'];

  return (
    <div className="flex flex-col h-full gap-6">
      <Toolbar
        title="Purchase Orders"
        count={parseInt(counts.all) || 0}
        actions={
          <>
            <div className="flex bg-white border-[0.5px] border-rule rounded-md overflow-hidden mr-4">
              <button onClick={() => setView('list')} className={`px-2.5 py-1.5 ${view === 'list' ? 'bg-paper2 text-ink' : 'text-steel hover:text-ink'}`}>
                <LayoutList size={16} />
              </button>
              <button onClick={() => setView('kanban')} className={`px-2.5 py-1.5 border-l-[0.5px] border-rule ${view === 'kanban' ? 'bg-paper2 text-ink' : 'text-steel hover:text-ink'}`}>
                <LayoutGrid size={16} />
              </button>
            </div>
            <button onClick={() => navigate('/purchase/new')} className="btn btn-rust">New</button>
          </>
        }
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
        {view === 'list' ? (
          <div className="flex-1 overflow-auto">
            <DataTable
              columns={columns}
              rows={rows}
              loading={isLoading}
              onRowClick={(r) => navigate(`/purchase/${r.id}`)}
              emptyMessage="No purchase orders found."
            />
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto p-4 flex gap-4 bg-paper2/30">
            {kanbanStages.map(stage => {
              const items = rows.filter(i => i.status === stage);
              return (
                <div key={stage} className="flex-1 min-w-[240px] flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink text-sm">{STATUS_LABELS[stage] || stage}</span>
                    <span className="text-xs text-steel font-mono">{items.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map(item => (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/purchase/${item.id}`)}
                        className="bg-white p-3 border-[0.5px] border-rule rounded-md cursor-pointer hover:border-ink transition-colors"
                      >
                        <div className="font-mono text-sm text-ink mb-1">{item.po_number}</div>
                        <div className="text-[13px] text-steel truncate mb-2">{item.vendor_name}</div>
                        <div className="font-mono text-sm text-ink text-right">₹ {(parseFloat(item.total_amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
