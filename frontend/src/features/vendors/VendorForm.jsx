import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import FormShell from '../../components/FormShell';
import { FieldRow, FieldGrid } from '../../components/FieldRow';

export default function VendorForm({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = mode === 'new';
  const [isEditing, setIsEditing] = useState(isNew);
  const [activeTab, setActiveTab] = useState('general');

  const { data: vendorData, isLoading } = useQuery({
    queryKey: ['vendors', id],
    queryFn: async () => (await api.get(E.vendor(id))).data,
    enabled: !isNew
  });
  const vendor = vendorData?.vendor;

  const { data: performanceData } = useQuery({
    queryKey: ['vendors', id, 'performance'],
    queryFn: async () => (await api.get(`/vendors/${id}/performance`)).data,
    enabled: !isNew && activeTab === 'performance'
  });
  const performance = performanceData?.reliability;

  const form = useForm({
    defaultValues: { name: '', email: '', phone: '', address: '', tags: [] }
  });

  useEffect(() => {
    if (!isNew && vendor) {
      form.reset({
        name: vendor.name || '', email: vendor.email || '', phone: vendor.phone || '', address: vendor.address || '', tags: vendor.tags || []
      });
    }
  }, [vendor, isNew, form]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (isNew) return (await api.post(E.vendors(), data)).data;
      return (await api.put(E.vendor(id), data)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['vendors']);
      toast.success('Vendor saved');
      if (isNew) navigate(`/vendors/${data._id || data.id}`, { replace: true });
      else setIsEditing(false);
    },
    onError: () => toast.error('Failed to save')
  });

  if (!isNew && isLoading) return <div className="p-8 text-steel">Loading...</div>;

  return (
    <div className="h-full">
      <FormShell>
        <FormShell.Header title={isNew ? 'New Vendor' : (isEditing ? 'Edit Vendor' : vendor?.name)} subtitle="Vendor Profile" />
        
        <FormShell.Tabs 
          tabs={[{ id: 'general', label: 'General' }, ...(!isNew ? [{ id: 'performance', label: 'Performance' }] : [])]}
          active={activeTab}
          onChange={setActiveTab}
        />

        <FormShell.Body>
          {activeTab === 'general' && (
            <div className="card p-6">
              <fieldset disabled={!isEditing}>
                <FieldGrid>
                  <FieldRow label="Name"><input {...form.register('name')} className="field" /></FieldRow>
                  <FieldRow label="Email"><input {...form.register('email')} type="email" className="field" /></FieldRow>
                  <FieldRow label="Phone"><input {...form.register('phone')} className="field" /></FieldRow>
                  <FieldRow label="Address"><input {...form.register('address')} className="field" /></FieldRow>
                </FieldGrid>
              </fieldset>
            </div>
          )}

          {activeTab === 'performance' && performance && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="stat-block"><div className="stat-label">Total Orders</div><div className="stat-value">{performance.total_orders || 0}</div></div>
                <div className="stat-block"><div className="stat-label">On-time %</div><div className="stat-value font-mono">{parseFloat(performance.on_time_rate || 0).toFixed(1)}%</div></div>
                <div className="stat-block"><div className="stat-label">Fulfillment %</div><div className="stat-value font-mono">{parseFloat(performance.fulfillment_rate || 0).toFixed(1)}%</div></div>
                <div className="stat-block"><div className="stat-label">Reliability Score</div><div className="stat-value font-mono">{parseFloat(performance.reliability_score || 0).toFixed(1)}/100</div></div>
              </div>
            </div>
          )}
        </FormShell.Body>

        <FormShell.Side>
          {!isEditing ? (
            <button className="btn justify-center" onClick={() => setIsEditing(true)}>
              Edit Vendor
            </button>
          ) : (
            <button className="btn btn-rust justify-center" onClick={form.handleSubmit((d) => saveMutation.mutate(d))} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Vendor'}
            </button>
          )}
        </FormShell.Side>
      </FormShell>
    </div>
  );
}
