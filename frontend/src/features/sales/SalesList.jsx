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
import StatusBadge, { STATUS_CLASS, STATUS_LABELS } from '../../components/StatusBadge';

export default function SalesList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const [view, setView] = useState('list');
  const statusFilter = searchParams.get('status') || 'All';
  const mineFilter = searchParams.get('mine') === 'true';

  useEffect(() => {
    if (!socket) return;
    const handler = () => queryClient.invalidateQueries(['sales']);
    socket.on('sales:update', handler);
    return () => socket.off('sales:update', handler);
  }, [socket, queryClient]);

  const { data: counts } = useQuery({
    queryKey: ['sales', 'counts'],
    queryFn: async () => {
      const { data } = await api.get(E.salesCounts());
      return data;
    }
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ['sales', statusFilter, mineFilter],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (statusFilter !== 'All') p.set('status', statusFilter.toLowerCase());
      if (mineFilter) p.set('mine', 'true');
      const { data } = await api.get(`${E.sales()}?${p.toString()}`);
      return data;
    }
  });

  const filters = ['All', 'Draft', 'Confirmed', 'Partial', 'Delivered', 'Late'];
  const getCount = (f) => {
    if (!counts) return 0;
    if (f === 'All') return counts.total || 0;
    if (f === 'Partial') return counts.partially_delivered || 0;
    return counts[f.toLowerCase()] || 0;
  };

  const columns = [
    { key: 'soNumber', label: 'REF', render: (r) => <span className="font-mono">{r.soNumber}</span>, width: '110px' },
    { key: 'createdAt', label: 'DATE', render: (r) => format(new Date(r.createdAt || Date.now()), 'dd MMM yyyy') },
    { key: 'customerName', label: 'CUSTOMER' },
    { key: 'salesPersonName', label: 'SALESPERSON', render: (r) => r.salesPerson?.name || r.salesPerson?.full_name || '—' },
    { key: 'totalAmount', label: 'TOTAL', align: 'right', render: (r) => <span className="font-mono">₹ {(r.totalAmount || 0).toFixed(2)}</span> },
    { key: 'status', label: 'STATUS', render: (r) => <StatusBadge status={r.status} /> }
  ];

  const kanbanStages = ['draft', 'confirmed', 'partially_delivered', 'fully_delivered', 'cancelled'];

  return (
    <div className="flex flex-col h-full gap-6">
      <Toolbar 
        title="Sales orders" 
        count={counts?.total || 0}
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
            <button onClick={() => navigate('/sales/new')} className="btn btn-rust">New</button>
          </>
        }
      />

      <div className="flex items-center justify-between overflow-x-auto no-scrollbar pb-2">
        <div className="flex items-center gap-2">
          {filters.map(f => (
            <StatChip 
              key={f} 
              label={f} 
              count={getCount(f)} 
              active={statusFilter === f}
              onClick={() => {
                const p = new URLSearchParams(searchParams);
                p.set('status', f);
                setSearchParams(p);
              }}
            />
          ))}
        </div>
        <StatChip 
          label="My" 
          count={counts?.mine || 0} 
          active={mineFilter}
          onClick={() => {
            const p = new URLSearchParams(searchParams);
            mineFilter ? p.delete('mine') : p.set('mine', 'true');
            setSearchParams(p);
          }}
        />
      </div>

      <div className="flex-1 bg-white border-[0.5px] border-rule rounded-md overflow-hidden flex flex-col min-h-[400px]">
        {view === 'list' ? (
          <div className="flex-1 overflow-auto">
            <DataTable 
              columns={columns}
              rows={listData}
              loading={isLoading}
              onRowClick={(r) => navigate(`/sales/${r._id || r.id}`)}
              emptyMessage="No sales orders found."
            />
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto p-4 flex gap-4 bg-paper2/30">
            {kanbanStages.map(stage => {
              const items = (listData || []).filter(i => {
                const s = String(i.status).toLowerCase().replace(/ /g, '_');
                return s === stage || (stage === 'fully_delivered' && s === 'delivered');
              });
              
              return (
                <div key={stage} className="flex-1 min-w-[240px] flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink text-sm">{STATUS_LABELS[stage] || stage}</span>
                    <span className="text-xs text-steel font-mono">{items.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map(item => (
                      <div 
                        key={item._id || item.id} 
                        onClick={() => navigate(`/sales/${item._id || item.id}`)}
                        className={`bg-white p-3 border-[0.5px] border-rule rounded-md cursor-pointer hover:border-ink transition-colors border-l-2 ${STATUS_CLASS[stage]?.replace('badge-', 'border-') || 'border-l-rule'}`}
                      >
                        <div className="font-mono text-sm text-ink mb-1">{item.soNumber}</div>
                        <div className="text-[13px] text-steel truncate mb-2">{item.customerName}</div>
                        <div className="font-mono text-sm text-ink text-right">₹ {(item.totalAmount || 0).toFixed(2)}</div>
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
