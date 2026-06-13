import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import Toolbar from '../../components/Toolbar';
import DataTable from '../../components/DataTable';

export default function VendorsList() {
  const navigate = useNavigate();

  // Backend returns { rows: [...], total, page, limit }
  const { data: listData, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => (await api.get(E.vendors())).data
  });

  const columns = [
    { key: 'name', label: 'VENDOR NAME' },
    { key: 'email', label: 'EMAIL' },
    { key: 'phone', label: 'PHONE' },
    { key: 'gst_number', label: 'GST NUMBER' },
    { key: 'address', label: 'ADDRESS', render: (r) => <span className="text-[12px] text-steel truncate max-w-[200px] block">{r.address || '—'}</span> }
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      <Toolbar 
        title="Vendors" 
        count={listData?.total || 0}
        actions={<button onClick={() => navigate('/vendors/new')} className="btn btn-rust">New</button>}
      />
      <div className="flex-1 bg-white border-[0.5px] border-rule rounded-md overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-auto">
          <DataTable 
            columns={columns}
            rows={listData?.rows || []}
            loading={isLoading}
            onRowClick={(r) => navigate(`/vendors/${r.id}`)}
            emptyMessage="No vendors found."
          />
        </div>
      </div>
    </div>
  );
}
