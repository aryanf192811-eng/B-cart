import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { Upload } from 'lucide-react';

import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import { useAuth } from '../../store/auth';
import { assetUrl } from '../../utils/assetUrl';
import FormShell from '../../components/FormShell';
import { FieldRow, FieldGrid } from '../../components/FieldRow';

const MODULES = ['Sales', 'Purchase', 'Manufacturing', 'Product', 'BoM', 'Inventory'];

export default function UserForm({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser, refreshUser } = useAuth();
  const avatarInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const isMe = mode === 'me';
  const isNew = mode === 'new';
  const targetId = isMe ? currentUser?.id : id;

  const [activeTab, setActiveTab] = useState('profile');

  // For 'me' mode: use GET /auth/me (has module_access).
  // For admin viewing other user: use GET /api/users/:id.
  const { data: userData, isLoading } = useQuery({
    queryKey: ['users', isMe ? 'me' : targetId],
    queryFn: async () => {
      if (isMe) return (await api.get(E.me())).data; // { user: {..., module_access: [...] } }
      return (await api.get(E.user(targetId))).data;  // { user: {..., module_access: [...] } }
    },
    enabled: !isNew && !!targetId,
  });

  const u = userData?.user;

  const form = useForm({
    defaultValues: {
      full_name: '', email: '', mobile: '', address: '', avatar_url: '',
      position: '', role_id: '',
      access_matrix: {}
    }
  });

  useEffect(() => {
    if (!isNew && u) {
      // Build access_matrix object from module_access array
      const access_matrix = {};
      (u.module_access || []).forEach(row => {
        access_matrix[row.module] = row.access_level;
      });

      form.reset({
        full_name: u.full_name || '',
        email: u.email || '',
        mobile: u.mobile || '',
        address: u.address || '',
        position: u.position || '',
        role_id: u.role_id || '',
        access_matrix,
      });

      if (u.avatar_url) setAvatarPreview(assetUrl(u.avatar_url));
    }
  }, [u, isNew, form]);

  // ── Avatar Upload ─────────────────────────────────────────
  const avatarMutation = useMutation({
    mutationFn: async (file) => {
      const fd = new FormData();
      fd.append('avatar', file);
      return (await api.post(E.avatarUpload(), fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })).data;
    },
    onSuccess: (data) => {
      setAvatarPreview(assetUrl(data.avatar_url));
      refreshUser();
      toast.success('Avatar updated');
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Avatar upload failed')
  });

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
      setAvatarPreview(URL.createObjectURL(file));
      avatarMutation.mutate(file);
  };

  // ── Save Profile / User ───────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (isMe) {
        // PATCH /api/users/me — only allowed fields
        const payload = {
          full_name: data.full_name,
          mobile: data.mobile,
          address: data.address,
        };
        return (await api.patch(E.userMe(), payload)).data;
      }
      if (isNew) {
        return (await api.post(E.users(), {
          login_id: data.login_id,
          email: data.email,
          full_name: data.full_name,
          position: data.position,
          role_id: parseInt(data.role_id) || null,
          password: data.password || 'password123',
        })).data;
      }
      // Admin updating another user
      return (await api.put(E.user(targetId), {
        full_name: data.full_name,
        position: data.position,
        role_id: data.role_id ? parseInt(data.role_id) : undefined,
        mobile: data.mobile,
        address: data.address,
      })).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (isMe) refreshUser();
      toast.success('Saved successfully');
      if (isNew) navigate(`/users/${data.user?.id}`, { replace: true });
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to save')
  });

  // ── Save Access Matrix ─────────────────────────────────────
  const accessMutation = useMutation({
    mutationFn: async (accessMatrix) => {
      // Convert {Module: 'admin'} → [{module, level}] array
      const access = Object.entries(accessMatrix).map(([module, level]) => ({ module, level }));
      return (await api.put(E.userAccess(targetId), { access })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', targetId] });
      toast.success('Access rights updated');
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to update access')
  });

  if (!isNew && isLoading) return <div className="p-8 text-steel">Loading...</div>;

  const initials = u?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="h-full">
      <FormShell>
        <FormShell.Header
          title={isNew ? 'New User' : isMe ? 'My Profile' : u?.full_name}
          subtitle={u?.position || u?.role}
          reference={u?.login_id}
        />

        <FormShell.Tabs
          tabs={[
            { id: 'profile', label: 'Profile' },
            ...(!isMe ? [{ id: 'access', label: 'Access Rights' }] : [])
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />

        <FormShell.Body>
          {activeTab === 'profile' && (
            <div className="card p-6">
              {/* Avatar */}
              {!isNew && (
                <div className="flex items-center gap-5 mb-8 pb-6 border-b-[0.5px] border-rule">
                  <div
                    className="w-20 h-20 rounded-full border-2 border-rule bg-paper2 flex items-center justify-center overflow-hidden cursor-pointer group relative"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    {avatarPreview
                      ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                      : <span className="text-2xl font-bold text-steel">{initials}</span>
                    }
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center">
                      <Upload size={16} className="text-white" />
                    </div>
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-ink mb-1">{u?.full_name}</div>
                    <div className="text-[12px] text-steel mb-2">{u?.email}</div>
                    <button
                      type="button"
                      className="text-[12px] text-rust hover:underline font-medium"
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      {avatarMutation.isPending ? 'Uploading...' : 'Change Photo'}
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>
                </div>
              )}

              <FieldGrid>
                {isNew && (
                  <>
                    <FieldRow label="Login ID">
                      <input {...form.register('login_id')} className="field font-mono" placeholder="e.g. john.doe" />
                    </FieldRow>
                    <FieldRow label="Password">
                      <input type="password" {...form.register('password')} className="field" placeholder="Min 8 chars" />
                    </FieldRow>
                  </>
                )}
                <FieldRow label="Full Name">
                  <input {...form.register('full_name')} className="field" />
                </FieldRow>
                <FieldRow label="Email">
                  <input {...form.register('email')} type="email" className="field" disabled={!isNew} />
                </FieldRow>
                {!isMe && (
                  <FieldRow label="Position">
                    <input {...form.register('position')} className="field" />
                  </FieldRow>
                )}
                <FieldRow label="Mobile">
                  <input {...form.register('mobile')} className="field" placeholder="+91 98765 43210" />
                </FieldRow>
                <FieldRow label="Address">
                  <textarea {...form.register('address')} className="field" rows={2} />
                </FieldRow>
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
                  {(() => {
                    const accessMatrixWatched = (() => {
                      try {
                        return form.watch('access_matrix') || {};
                      } catch(e) {
                        return {};
                      }
                    })();
                    return MODULES.map(mod => {
                      const val = accessMatrixWatched[mod] || 'none';
                      return (
                      <tr key={mod} className="border-b-[0.5px] border-rule">
                        <td className="px-4 py-3 font-medium text-ink">{mod}</td>
                        <td className="px-4 py-3 text-center">
                          <input type="radio" name={`access_${mod}`} value="admin" checked={val === 'admin'} onChange={() => form.setValue(`access_matrix.${mod}`, 'admin')} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input type="radio" name={`access_${mod}`} value="user" checked={val === 'user'} onChange={() => form.setValue(`access_matrix.${mod}`, 'user')} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input type="radio" name={`access_${mod}`} value="none" checked={val === 'none'} onChange={() => form.setValue(`access_matrix.${mod}`, 'none')} />
                        </td>
                      </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
              <div className="p-4 border-t-[0.5px] border-rule flex justify-end">
                <button
                  className="btn btn-rust"
                  onClick={() => accessMutation.mutate(form.getValues('access_matrix'))}
                  disabled={accessMutation.isPending}
                >
                  {accessMutation.isPending ? 'Saving...' : 'Save Access Rights'}
                </button>
              </div>
            </div>
          )}
        </FormShell.Body>

        <FormShell.Side>
          <button
            className="btn btn-rust justify-center"
            onClick={form.handleSubmit((d) => saveMutation.mutate(d))}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>

          {!isNew && u && (
            <div className="card p-5 mt-6 space-y-3 text-[13px]">
              <div className="text-[11px] font-semibold text-steel uppercase tracking-wider mb-3">User Info</div>
              <div className="flex justify-between">
                <span className="text-steel">Role</span>
                <span className="font-semibold text-ink">{u.role || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-steel">Status</span>
                <span className={`font-semibold ${u.is_active ? 'text-success' : 'text-rust'}`}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-steel">Joined</span>
                <span className="text-ink">{u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}</span>
              </div>
            </div>
          )}
        </FormShell.Side>
      </FormShell>
    </div>
  );
}
