import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import Toolbar from '../../components/Toolbar';
import DataTable from '../../components/DataTable';

export default function VendorsList() {
  const navigate = useNavigate();

  const { data: listData, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => (await api.get(E.vendors())).data
  });

  const columns = [
    { key: 'name', label: 'VENDOR NAME' },
    { key: 'email', label: 'EMAIL' },
    { key: 'phone', label: 'PHONE' },
    { key: 'address', label: 'ADDRESS' },
    { key: 'tags', label: 'TAGS', render: (r) => (r.tags||[]).map(t=><span key={t} className="badge badge-draft mr-1">{t}</span>) }
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      <Toolbar 
        title="Vendors" 
        actions={<button onClick={() => navigate('/vendors/new')} className="btn btn-rust">New</button>}
      />
      <div className="flex-1 bg-white border-[0.5px] border-rule rounded-md overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-auto">
          <DataTable 
            columns={columns}
            rows={listData}
            loading={isLoading}
            onRowClick={(r) => navigate(`/vendors/${r._id || r.id}`)}
            emptyMessage="No vendors found."
          />
        </div>
      </div>
    </div>
  );
}
