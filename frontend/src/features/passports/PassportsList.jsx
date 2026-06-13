import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import Toolbar from '../../components/Toolbar';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';

export default function PassportsList() {
  const navigate = useNavigate();
  const { data: listData, isLoading } = useQuery({
    queryKey: ['passports'],
    queryFn: async () => (await api.get(E.passports())).data
  });

  const columns = [
    { key: 'passportId', label: 'PASSPORT ID', render: (r) => <span className="font-mono font-bold text-ink">{r.passport_id || r.passportId}</span> },
    { key: 'product', label: 'PRODUCT', render: (r) => r.product_name || r.product?.name },
    { key: 'batchNumber', label: 'BATCH', render: (r) => <span className="font-mono">{r.batch_number || r.batchNumber}</span> },
    { key: 'manufacturedDate', label: 'MFG DATE', render: (r) => format(new Date(r.manufacture_date || r.manufacturedDate || r.created_at || new Date()), 'dd MMM yyyy') },
    { key: 'quantity', label: 'QTY', render: (r) => <span className="font-mono">{r.qty_produced || r.quantity}</span> },
    { key: 'qcStatus', label: 'QC STATUS', render: (r) => <StatusBadge status={r.qc_status || r.qcStatus} /> },
    { key: 'manufacturedBy', label: 'MANUFACTURED BY', render: (r) => r.manufactured_by_name || r.manufacturedBy?.name || '—' }
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      <Toolbar title="Digital Product Passports" />
      <div className="flex-1 bg-white border-[0.5px] border-rule rounded-md overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-auto">
          <DataTable 
            columns={columns}
            rows={listData?.rows || (Array.isArray(listData) ? listData : [])}
            loading={isLoading}
            onRowClick={(r) => navigate(`/passports/${r._id || r.id}`)}
            emptyMessage="No passports found."
          />
        </div>
      </div>
    </div>
  );
}
