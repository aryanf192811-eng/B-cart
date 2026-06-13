import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import Toolbar from '../../components/Toolbar';
import DataTable from '../../components/DataTable';
import Avatar from '../../components/Avatar';

export default function UsersList() {
  const navigate = useNavigate();

  const { data: listData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get(E.users())).data
  });

  const columns = [
    { key: 'user', label: 'USER', render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.name || r.full_name} size="28px" />
          <span className="font-medium text-ink">{r.name || r.full_name}</span>
        </div>
      )
    },
    { key: 'email', label: 'EMAIL', render: (r) => r.email },
    { key: 'role', label: 'ROLE', render: (r) => <span className={`badge ${r.role === 'admin' ? 'badge-progress' : 'badge-draft'}`}>{r.role}</span> },
    { key: 'status', label: 'STATUS', render: (r) => <span className="text-[12px] text-success">Active</span> }
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      <Toolbar 
        title="Users" 
        actions={<button onClick={() => navigate('/users/new')} className="btn btn-rust">New</button>}
      />
      <div className="flex-1 bg-white border-[0.5px] border-rule rounded-md overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-auto">
          <DataTable 
            columns={columns}
            rows={listData}
            loading={isLoading}
            onRowClick={(r) => navigate(`/users/${r._id || r.id}`)}
            emptyMessage="No users found."
          />
        </div>
      </div>
    </div>
  );
}
