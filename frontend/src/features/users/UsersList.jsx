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

  // Backend returns { users: [...] } — each user has: id, login_id, email, full_name, position, mobile, is_active, role
  const columns = [
    { key: 'user', label: 'USER', render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.full_name} avatarUrl={r.avatar_url} size="28px" />
          <div>
            <div className="font-medium text-ink text-[13px]">{r.full_name}</div>
            <div className="text-[11px] text-steel font-mono">{r.login_id}</div>
          </div>
        </div>
      )
    },
    { key: 'email', label: 'EMAIL', render: (r) => r.email },
    { key: 'position', label: 'POSITION', render: (r) => r.position || '—' },
    { key: 'role', label: 'ROLE', render: (r) => <span className={`badge ${r.role === 'Admin' ? 'badge-progress' : 'badge-draft'}`}>{r.role || 'User'}</span> },
    { key: 'is_active', label: 'STATUS', render: (r) => r.is_active
        ? <span className="text-[12px] text-success font-semibold">Active</span>
        : <span className="text-[12px] text-rust font-semibold">Inactive</span>
    }
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      <Toolbar 
        title="Users" 
        count={listData?.users?.length || 0}
        actions={<button onClick={() => navigate('/users/new')} className="btn btn-rust">New</button>}
      />
      <div className="flex-1 bg-white border-[0.5px] border-rule rounded-md overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-auto">
          <DataTable 
            columns={columns}
            rows={listData?.users || []}
            loading={isLoading}
            onRowClick={(r) => navigate(`/users/${r.id}`)}
            emptyMessage="No users found."
          />
        </div>
      </div>
    </div>
  );
}
