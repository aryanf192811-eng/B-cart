import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import Toolbar from '../../components/Toolbar';
import DataTable from '../../components/DataTable';

export default function CustomersList() {
  const navigate = useNavigate();

  const { data: listData, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => (await api.get(E.customers())).data
  });

  const columns = [
    { key: 'name', label: 'CUSTOMER NAME' },
    { key: 'email', label: 'EMAIL' },
    { key: 'phone', label: 'PHONE' },
    { key: 'address', label: 'ADDRESS' }
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      <Toolbar 
        title="Customers" 
        actions={<button onClick={() => navigate('/customers/new')} className="btn btn-rust">New</button>}
      />
      <div className="flex-1 bg-white border-[0.5px] border-rule rounded-md overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-auto">
          <DataTable 
            columns={columns}
            rows={listData}
            loading={isLoading}
            onRowClick={(r) => navigate(`/customers/${r._id || r.id}`)}
            emptyMessage="No customers found."
          />
        </div>
      </div>
    </div>
  );
}
