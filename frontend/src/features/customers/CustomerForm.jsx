import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import FormShell from '../../components/FormShell';
import { FieldRow, FieldGrid } from '../../components/FieldRow';

export default function CustomerForm({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = mode === 'new';
  const [isEditing, setIsEditing] = useState(isNew);
  const [activeTab, setActiveTab] = useState('general');

  const { data: customerData, isLoading } = useQuery({
    queryKey: ['customers', id],
    queryFn: async () => (await api.get(E.customer(id))).data,
    enabled: !isNew
  });
  const customer = customerData?.customer;

  const form = useForm({
    defaultValues: { name: '', email: '', phone: '', address: '', tags: [] }
  });

  useEffect(() => {
    if (!isNew && customer) {
      form.reset({
        name: customer.name || '', email: customer.email || '', phone: customer.phone || '', address: customer.address || '', tags: customer.tags || []
      });
    }
  }, [customer, isNew, form]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (isNew) return (await api.post(E.customers(), data)).data;
      return (await api.put(E.customer(id), data)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['customers']);
      toast.success('Customer saved');
      if (isNew) navigate(`/customers/${data._id || data.id}`, { replace: true });
      else setIsEditing(false);
    },
    onError: () => toast.error('Failed to save')
  });

  if (!isNew && isLoading) return <div className="p-8 text-steel">Loading...</div>;

  return (
    <div className="h-full">
      <FormShell>
        <FormShell.Header title={isNew ? 'New Customer' : (isEditing ? 'Edit Customer' : customer?.name)} subtitle="Customer Profile" />
        
        <FormShell.Tabs 
          tabs={[{ id: 'general', label: 'General' }]}
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
        </FormShell.Body>

        <FormShell.Side>
          {!isEditing ? (
            <button className="btn justify-center" onClick={() => setIsEditing(true)}>
              Edit Customer
            </button>
          ) : (
            <button className="btn btn-rust justify-center" onClick={form.handleSubmit((d) => saveMutation.mutate(d))} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Customer'}
            </button>
          )}
        </FormShell.Side>
      </FormShell>
    </div>
  );
}
