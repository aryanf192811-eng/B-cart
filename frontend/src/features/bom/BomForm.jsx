import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { toast } from 'react-hot-toast';

import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import FormShell from '../../components/FormShell';
import { FieldRow, FieldGrid } from '../../components/FieldRow';
import { QtyInput } from '../../components/QtyInput';

export default function BomForm({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = mode === 'new';
  
  const [activeTab, setActiveTab] = useState('components');

  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => {
    const d = await api.get(E.products());
    return d.data.rows || d.data;
  }});
  const { data: workCenters } = useQuery({ queryKey: ['workCenters'], queryFn: async () => {
    const d = await api.get(E.workCenters());
    return d.data.rows || d.data;
  }});

  const { data: bom, isLoading } = useQuery({
    queryKey: ['bom', id],
    queryFn: async () => (await api.get(E.bomOne(id))).data,
    enabled: !isNew
  });

  const form = useForm({
    defaultValues: { reference: '', product_id: '', qty_produced: 1, components: [], operations: [] }
  });

  const { fields: compFields, append: appendComp, remove: removeComp } = useFieldArray({ control: form.control, name: 'components' });
  const { fields: woFields, append: appendWo, remove: removeWo } = useFieldArray({ control: form.control, name: 'operations' });

  useEffect(() => {
    if (!isNew && bom) {
      form.reset({
        reference: bom.reference || '',
        product_id: bom.product_id || '',
        qty_produced: bom.qty_produced || 1,
        components: bom.components?.map(c => ({ component_id: c.component_id, qty: c.qty })) || [],
        operations: bom.operations?.map(o => ({
          sequence: o.sequence,
          name: o.name,
          work_center_id: o.work_center_id,
          duration_mins: o.duration_mins
        })) || []
      });
    }
  }, [bom, isNew, form]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (isNew) return (await api.post(E.bom(), data)).data;
      return (await api.put(E.bomOne(id), data)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['boms']);
      toast.success('BoM saved');
      if (isNew) navigate(`/bom/${data._id || data.id}`, { replace: true });
    },
    onError: (err) => toast.error('Failed to save BoM')
  });

  if (!isNew && isLoading) return <div className="p-8 text-steel">Loading...</div>;

  return (
    <div className="h-full">
      <FormShell>
        <FormShell.Header 
          title={isNew ? 'New Bill of Materials' : `Bill of materials ${bom?.reference || ''}`}
          subtitle={bom?.finishedProduct?.name}
          reference={bom?.reference}
        />
        
        <FormShell.Tabs 
          tabs={[{ id: 'components', label: 'Components' }, { id: 'operations', label: 'Operations' }]}
          active={activeTab}
          onChange={setActiveTab}
        />

        <FormShell.Body>
          <div className="card p-6">
            <FieldGrid>
              <FieldRow label="Reference" hint="Auto-generated if left blank">
                <input {...form.register('reference')} className="field" />
              </FieldRow>
              <FieldRow label="Finished Product">
                <select {...form.register('product_id')} className="field">
                  <option value="">Select product...</option>
                  {products?.filter(p => p.procurement_type === 'manufacturing' || p.procurementMethod === 'Manufacturing').map(p => <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Quantity Produced">
                <QtyInput {...form.register('qty_produced', { valueAsNumber: true })} min={1} />
              </FieldRow>
            </FieldGrid>
          </div>

          {activeTab === 'components' && (
            <div className="card overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="w-[50%]">COMPONENT</th>
                    <th className="w-[30%]">TO CONSUME</th>
                    <th className="w-[20%] text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {compFields.map((f, i) => (
                    <tr key={f.id} className="border-b-[0.5px] border-rule">
                      <td className="px-3 py-2">
                        <select {...form.register(`components.${i}.component_id`)} className="field w-full">
                          <option value="">Select component...</option>
                          {products?.map(p => <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <QtyInput {...form.register(`components.${i}.qty`, { valueAsNumber: true })} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button type="button" onClick={() => removeComp(i)} className="text-danger hover:text-danger/80">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 border-b-[0.5px] border-rule">
                <button type="button" onClick={() => appendComp({ component_id: '', qty: 1 })} className="text-rust text-[13px] hover:underline">
                  + Add a component
                </button>
              </div>
            </div>
          )}

          {activeTab === 'operations' && (
            <div className="card overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="w-[10%]">SEQ</th>
                    <th className="w-[30%]">OPERATION</th>
                    <th className="w-[30%]">WORK CENTER</th>
                    <th className="w-[20%]">DURATION (mins)</th>
                    <th className="w-[10%] text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {woFields.map((f, i) => (
                    <tr key={f.id} className="border-b-[0.5px] border-rule">
                      <td className="px-3 py-2 font-mono text-steel">
                        <input {...form.register(`operations.${i}.sequence`, { valueAsNumber: true })} type="number" className="field w-full" placeholder={i + 1} />
                      </td>
                      <td className="px-3 py-2">
                        <input {...form.register(`operations.${i}.name`)} className="field w-full" placeholder="e.g., Assembly" />
                      </td>
                      <td className="px-3 py-2">
                        <select {...form.register(`operations.${i}.work_center_id`)} className="field w-full">
                          <option value="">Select center...</option>
                          {workCenters?.rows?.map(wc => <option key={wc.id} value={wc.id}>{wc.name}</option>)}
                          {workCenters?.map?.(wc => <option key={wc.id || wc._id} value={wc.id || wc._id}>{wc.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <QtyInput {...form.register(`operations.${i}.duration_mins`, { valueAsNumber: true })} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button type="button" onClick={() => removeWo(i)} className="text-danger hover:text-danger/80">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 border-b-[0.5px] border-rule">
                <button type="button" onClick={() => appendWo({ sequence: woFields.length + 1, name: '', work_center_id: '', duration_mins: 60 })} className="text-rust text-[13px] hover:underline">
                  + Add an operation
                </button>
              </div>
            </div>
          )}
        </FormShell.Body>

        <FormShell.Side>
          <button className="btn btn-rust justify-center" onClick={form.handleSubmit((d) => saveMutation.mutate(d))} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save BoM'}
          </button>
          
          <div className="card p-4 mt-6 bg-paper2 border-l-2 border-ink">
            <div className="text-[12px] text-steel">
              When this BoM is selected on a Manufacturing Order, all components and operations populate automatically — scaled to the MO quantity.
            </div>
          </div>
        </FormShell.Side>
      </FormShell>
    </div>
  );
}
