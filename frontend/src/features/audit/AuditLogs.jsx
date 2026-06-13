import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import Toolbar from '../../components/Toolbar';
import DataTable from '../../components/DataTable';

export default function AuditLogs() {
  const [filters, setFilters] = useState({ module: 'All', action: 'All' });

  const { data: stats } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: async () => (await api.get('/audit/stats')).data.stats
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit', filters],
    queryFn: async () => (await api.get(`/audit?module=${filters.module}&action=${filters.action}`)).data
  });

  const columns = [
    { key: 'dateAndTime', label: 'TIMESTAMP', render: (r) => format(new Date(r.created_at || r.dateAndTime || new Date()), 'dd MMM yy HH:mm') },
    { key: 'user', label: 'USER', render: (r) => r.user_name || r.user?.name || r.user?.full_name || 'System' },
    { key: 'entityType', label: 'MODULE', render: (r) => r.module || r.entity_type },
    { key: 'action', label: 'ACTION', render: (r) => {
        let col = 'text-ink';
        if(r.action==='Created') col='text-success';
        if(r.action==='Deleted') col='text-danger';
        if(r.action==='Updated') col='text-info';
        return <span className={`font-medium ${col}`}>{r.action}</span>;
      }
    },
    { key: 'fieldChanged', label: 'FIELD', render: (r) => <span className="font-mono text-[12px]">{r.field_name || r.fieldChanged || '—'}</span> },
    { key: 'oldValue', label: 'OLD VALUE', render: (r) => <span className="font-mono text-[12px] text-steel truncate block max-w-[150px]" title={String(r.old_value || r.oldValue || '')}>{(r.old_value || r.oldValue) != null ? String(r.old_value || r.oldValue) : '—'}</span> },
    { key: 'newValue', label: 'NEW VALUE', render: (r) => <span className="font-mono text-[12px] text-ink truncate block max-w-[150px]" title={String(r.new_value || r.newValue || '')}>{(r.new_value || r.newValue) != null ? String(r.new_value || r.newValue) : '—'}</span> }
  ];

  return (
    <div className="flex flex-col gap-6 h-full">
      <Toolbar title="Audit Logs" />
      
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-block"><div className="stat-label">Total Logs</div><div className="stat-value">{stats?.total_logs || 0}</div></div>
        <div className="stat-block border-l-2 border-success"><div className="stat-label">Records Created</div><div className="stat-value text-success">{stats?.records_created || 0}</div></div>
        <div className="stat-block border-l-2 border-info"><div className="stat-label">Records Updated</div><div className="stat-value text-info">{stats?.records_updated || 0}</div></div>
        <div className="stat-block border-l-2 border-danger"><div className="stat-label">Records Deleted</div><div className="stat-value text-danger">{stats?.records_changed || 0}</div></div>
      </div>

      <div className="flex gap-2">
        <select className="field w-auto" value={filters.module} onChange={e => setFilters(p => ({...p, module: e.target.value}))}>
          <option value="All">All Modules</option>
          <option value="SalesOrder">Sales</option>
          <option value="PurchaseOrder">Purchase</option>
          <option value="ManufacturingOrder">Manufacturing</option>
        </select>
        <select className="field w-auto" value={filters.action} onChange={e => setFilters(p => ({...p, action: e.target.value}))}>
          <option value="All">All Actions</option>
          <option value="Created">Created</option>
          <option value="Updated">Updated</option>
          <option value="Deleted">Deleted</option>
        </select>
      </div>

      <div className="flex-1 bg-white border-[0.5px] border-rule rounded-md overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-auto">
          <DataTable 
            columns={columns}
            rows={logs?.rows || (Array.isArray(logs) ? logs : [])}
            loading={isLoading}
            emptyMessage="No audit logs found."
          />
        </div>
      </div>
    </div>
  );
}
