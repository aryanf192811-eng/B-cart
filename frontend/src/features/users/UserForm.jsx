import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import { useAuth } from '../../store/auth';
import FormShell from '../../components/FormShell';
import { FieldRow, FieldGrid } from '../../components/FieldRow';

export default function UserForm({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  
  const isMe = mode === 'me';
  const isNew = mode === 'new';
  const targetId = isMe ? currentUser?._id : id;

  const [activeTab, setActiveTab] = useState('profile');

  const { data: u, isLoading } = useQuery({
    queryKey: ['users', targetId],
    queryFn: async () => (await api.get(isMe ? '/users/me' : E.user(targetId))).data,
    enabled: !isNew && !!targetId
  });

  const form = useForm({
    defaultValues: { full_name: '', email: '', role: 'user', access_matrix: {} }
  });

  useEffect(() => {
    if (!isNew && u) {
      form.reset({
        full_name: u.full_name || u.name || '',
        email: u.email || '',
        role: u.role || 'user',
        access_matrix: u.access_matrix || {}
      });
    }
  }, [u, isNew, form]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (isMe) return (await api.patch('/users/me', data)).data;
      if (isNew) return (await api.post(E.users(), data)).data;
      return (await api.put(E.user(targetId), data)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['users']);
      toast.success('User saved');
      if (isNew) navigate(`/users/${data._id || data.id}`, { replace: true });
    },
    onError: (err) => toast.error('Failed to save')
  });

  if (!isNew && isLoading) return <div className="p-8 text-steel">Loading...</div>;

  const modules = ['Sales', 'Purchase', 'Manufacturing', 'Products', 'Inventory'];

  return (
    <div className="h-full">
      <FormShell>
        <FormShell.Header 
          title={isNew ? 'New User' : isMe ? 'My Profile' : u?.full_name || u?.name} 
          subtitle={form.watch('email')} 
        />
        
        <FormShell.Tabs 
          tabs={[{ id: 'profile', label: 'Profile' }, ...(!isMe ? [{ id: 'access', label: 'Access Rights' }] : [])]}
          active={activeTab}
          onChange={setActiveTab}
        />

        <FormShell.Body>
          {activeTab === 'profile' && (
            <div className="card p-6">
              <FieldGrid>
                <FieldRow label="Full Name"><input {...form.register('full_name')} className="field" /></FieldRow>
                <FieldRow label="Email"><input {...form.register('email')} type="email" className="field" disabled={!isNew} /></FieldRow>
                {!isMe && (
                  <FieldRow label="Role">
                    <select {...form.register('role')} className="field">
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </FieldRow>
                )}
              </FieldGrid>
            </div>
          )}

          {activeTab === 'access' && !isMe && (
            <div className="card overflow-hidden">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="bg-paper2">
                    <th className="px-4 py-3">MODULE</th>
                    <th className="px-4 py-3 text-center">ADMIN</th>
                    <th className="px-4 py-3 text-center">USER</th>
                    <th className="px-4 py-3 text-center">NONE</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map(mod => {
                    const val = form.watch(`access_matrix.${mod}`) || 'none';
                    return (
                      <tr key={mod} className="border-b-[0.5px] border-rule">
                        <td className="px-4 py-3 font-medium text-ink">{mod}</td>
                        <td className="px-4 py-3 text-center"><input type="radio" value="admin" checked={val==='admin'} onChange={()=>form.setValue(`access_matrix.${mod}`, 'admin')} /></td>
                        <td className="px-4 py-3 text-center"><input type="radio" value="user" checked={val==='user'} onChange={()=>form.setValue(`access_matrix.${mod}`, 'user')} /></td>
                        <td className="px-4 py-3 text-center"><input type="radio" value="none" checked={val==='none'} onChange={()=>form.setValue(`access_matrix.${mod}`, 'none')} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </FormShell.Body>

        <FormShell.Side>
          <button className="btn btn-rust justify-center" onClick={form.handleSubmit((d) => saveMutation.mutate(d))} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save User'}
          </button>
        </FormShell.Side>
      </FormShell>
    </div>
  );
}
