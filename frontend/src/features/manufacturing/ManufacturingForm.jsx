import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import FormShell from '../../components/FormShell';
import { FieldRow, FieldGrid } from '../../components/FieldRow';
import StatusBadge from '../../components/StatusBadge';
import ConfirmDialog from '../../components/ConfirmDialog';
import { QtyInput } from '../../components/QtyInput';
import WorkOrderTimer from './WorkOrderTimer';

export default function ManufacturingForm({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = mode === 'new';
  
  const [activeTab, setActiveTab] = useState('components');
  const [produceDialogOpen, setProduceDialogOpen] = useState(false);

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: async () => {
    const d = await api.get(E.users());
    return d.data.users || d.data.rows || d.data;
  }});
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => {
    const d = await api.get(E.products());
    return d.data.rows || d.data;
  }});

  const { data: mo, isLoading, refetch } = useQuery({
    queryKey: ['manufacturing', id],
    queryFn: async () => {
      const d = (await api.get(E.moOne(id))).data;
      return d.manufacturing_order || d;
    },
    enabled: !isNew
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['audit', 'manufacturing', id],
    queryFn: async () => (await api.get(`/audit?entity_type=ManufacturingOrder&entity_id=${id}`)).data.rows || [],
    enabled: !isNew
  });

  const form = useForm({
    defaultValues: { finishedProduct: '', quantityToProduce: 1, billOfMaterials: '', scheduledDate: '', responsiblePerson: '', components: [], workOrders: [] }
  });

  const { fields: compFields } = useFieldArray({ control: form.control, name: 'components' });
  const { fields: woFields } = useFieldArray({ control: form.control, name: 'workOrders' });

  const formFinishedProductId = (() => {
    try {
      return form.watch('finishedProduct');
    } catch (e) {
      return '';
    }
  })();
  const finishedProductId = formFinishedProductId || '';

  const { data: boms } = useQuery({
    queryKey: ['boms', finishedProductId],
    queryFn: async () => (await api.get(`${E.bom()}?product_id=${finishedProductId}`)).data,
    enabled: !!finishedProductId
  });

  useEffect(() => {
    if (!isNew && mo) {
      form.reset({
        finishedProduct: mo.product_id || '',
        quantityToProduce: mo.qty || 1,
        billOfMaterials: mo.bom_id || '',
        scheduledDate: mo.schedule_date ? format(new Date(mo.schedule_date), 'yyyy-MM-dd') : '',
        responsiblePerson: mo.assignee_id || '',
        components: mo.components || [],
        workOrders: mo.work_orders || []
      });
    }
  }, [mo, isNew, form]);

  const handleBomChange = async (e) => {
    const bomId = e.target.value;
    form.setValue('billOfMaterials', bomId);
    if (!bomId || !isNew) return;
    
    try {
      const { data: bom } = await api.get(E.bomOne(bomId));
      const qty = form.getValues('quantityToProduce') || 1;
      form.setValue('components', bom.components.map(c => ({
        product: c.product,
        toConsumeQuantity: c.quantity * qty,
        consumedQuantity: 0
      })));
      form.setValue('workOrders', bom.workOrders.map(w => ({
        operation: w.operation,
        workCenter: w.workCenter,
        duration: w.duration * qty,
        status: 'pending',
        real_duration_secs: 0
      })));
    } catch (err) {
      toast.error('Failed to load BoM details');
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        product_id: data.finishedProduct,
        bom_id: data.billOfMaterials,
        qty: data.quantityToProduce,
        assignee_id: data.responsiblePerson || null,
        schedule_date: data.scheduledDate || null
      };
      if (isNew) return (await api.post(E.mo(), payload)).data;
      return (await api.put(E.moOne(id), payload)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['manufacturing']);
      toast.success(isNew ? 'Draft created' : 'Saved');
      const moId = data.manufacturing_order?.id || data.id;
      if (isNew && moId) navigate(`/manufacturing/${moId}`, { replace: true });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to save')
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action }) => {
      if (action === 'confirm') return (await api.post(E.moConfirm(id))).data;
      if (action === 'produce') return (await api.post(E.moProduce(id))).data;
      if (action === 'cancel') return (await api.post(E.moCancel(id))).data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['manufacturing']);
      refetch();
      setProduceDialogOpen(false);
      toast.success(variables.action === 'produce' ? `Production complete · Passport ${data.passport_id || 'generated'} created` : 'Action successful');
    },
    onError: (err) => {
      setProduceDialogOpen(false);
      toast.error(err.response?.data?.message || 'Action failed')
    }
  });

  const woMutation = useMutation({
    mutationFn: async ({ woId, action }) => {
      let endpoint = '';
      if (action === 'start') endpoint = E.woStart(id, woId);
      if (action === 'pause') endpoint = E.woPause(id, woId);
      if (action === 'resume') endpoint = E.woResume(id, woId);
      if (action === 'done') endpoint = E.woDone(id, woId);
      return (await api.post(endpoint)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['manufacturing']);
      refetch();
      if (data.status === 'to_close') {
        toast.success('All work orders complete. Ready to produce.', { duration: 5000, icon: '🚀' });
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update work order')
  });

  const onSubmit = (data) => saveMutation.mutate(data);

  const handleConfirm = async () => {
    if (form.formState.isDirty) await form.handleSubmit(onSubmit)();
    actionMutation.mutate({ action: 'confirm' });
  };

  const status = mo?.status?.toLowerCase() || 'draft';
  const isDraft = status === 'draft';
  const isConfirmed = status === 'confirmed';
  const isInProgress = status === 'in_progress';
  const isToClose = status === 'to_close';
  const isDone = status === 'done';
  const isCancelled = status === 'cancelled';

  if (!isNew && isLoading) return <div className="p-8 text-steel">Loading...</div>;

  const qtyProducedText = `${mo?.qty || 0} ${mo?.product_name || ''}`;

  return (
    <div className="h-full flex flex-col gap-6">
      {isToClose && (
        <div className="bg-successBg border-[0.5px] border-success text-success px-6 py-4 rounded-md flex items-center justify-between shadow-sm">
          <div className="font-semibold text-[14px]">All work orders complete. Ready to produce.</div>
          <button className="btn btn-rust" onClick={() => setProduceDialogOpen(true)}>Produce {qtyProducedText}</button>
        </div>
      )}

      <FormShell>
        <FormShell.Header 
          title={isNew ? 'New manufacturing order' : `Manufacturing order ${mo?.mo_number}`}
          subtitle={isNew ? 'Draft' : mo?.product_name}
          reference={isNew ? '—' : mo?.mo_number}
          status={isNew ? 'draft' : mo?.status}
        />
        
        <FormShell.Tabs 
          tabs={[
            { id: 'components', label: 'Components' },
            { id: 'work_orders', label: 'Work orders' },
            ...(!isNew ? [{ id: 'audit', label: 'Audit' }] : [])
          ]}
          active={activeTab}
          onChange={(t) => {
            if (t === 'audit') navigate(`/audit?entity_type=ManufacturingOrder&entity_id=${id}`);
            else setActiveTab(t);
          }}
        />

        <FormShell.Body>
          <div className="card p-6">
            <FieldGrid>
              <FieldRow label="Finished Product">
                <select {...form.register('finishedProduct')} className="field" disabled={!isDraft}>
                  <option value="">Select product...</option>
                  {products?.filter(p => p.procurementMethod === 'Manufacturing').map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Quantity to Produce">
                <QtyInput {...form.register('quantityToProduce', { valueAsNumber: true })} disabled={!isDraft} />
              </FieldRow>
              <FieldRow label="Bill of Materials">
                <select {...form.register('billOfMaterials')} onChange={handleBomChange} className="field" disabled={!isDraft || !finishedProductId}>
                  <option value="">Select BoM...</option>
                  {boms?.map(b => <option key={b._id} value={b._id}>{b.reference || 'BoM'}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Schedule Date">
                <input {...form.register('scheduledDate')} type="date" className="field" disabled={!isDraft} />
              </FieldRow>
              <FieldRow label="Assignee">
                <select {...form.register('responsiblePerson')} className="field" disabled={!isDraft}>
                  <option value="">Select user...</option>
                  {users?.map(u => <option key={u._id} value={u._id}>{u.name || u.full_name}</option>)}
                </select>
              </FieldRow>
            </FieldGrid>
          </div>

          {activeTab === 'components' && (
            <div className="card overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="w-[40%]">COMPONENT</th>
                    <th className="w-[20%] text-right">TO CONSUME</th>
                    <th className="w-[20%] text-right">CONSUMED</th>
                    <th className="w-[20%] text-right">AVAILABILITY</th>
                  </tr>
                </thead>
                <tbody>
                  {compFields.map((f, i) => {
                    const comp = mo?.components?.[i] || f;
                    const prodId = comp.component_id || comp.product?._id || comp.product;
                    const prod = products?.find(p => p.id === prodId || p._id === prodId);
                    const prodName = comp.component_name || prod?.name || 'Unknown';
                    
                    const freeToUse = comp.free_to_use_qty || prod?.freeToUseQty || 0;
                    const toConsume = comp.qty_required || comp.toConsumeQuantity || 0;
                    const consumed = comp.qty_consumed || comp.consumedQuantity || 0;
                    const available = freeToUse >= toConsume;

                    return (
                      <tr key={f.id} className="border-b-[0.5px] border-rule">
                        <td className="px-3 py-2 text-[13px]">{prodName}</td>
                        <td className="px-3 py-2 font-mono text-right">{toConsume}</td>
                        <td className="px-3 py-2 font-mono text-right">{consumed}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${available ? 'bg-successBg text-success' : 'bg-dangerBg text-danger'}`}>
                            {available ? 'Available' : 'Not available'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {compFields.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-3 py-4 text-center text-steel2 text-[13px]">Select a BoM to populate components</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'work_orders' && (
            <div className="card overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="w-[10%]">SEQ</th>
                    <th className="w-[25%]">OPERATION</th>
                    <th className="w-[20%]">WORK CENTER</th>
                    <th className="w-[15%] text-right">EXPECTED</th>
                    <th className="w-[30%]">STATUS / REAL TIMER</th>
                  </tr>
                </thead>
                <tbody>
                  {woFields.map((f, i) => {
                    const wo = mo?.work_orders?.[i] || f;
                    
                    const dur = wo.duration_mins || wo.duration || 0;
                    const expH = Math.floor(dur / 60).toString().padStart(2, '0');
                    const expM = (dur % 60).toString().padStart(2, '0');
                    const expectedStr = `${expH}:${expM}`;

                    return (
                      <tr key={f.id} className="border-b-[0.5px] border-rule">
                        <td className="px-3 py-2 font-mono">{i + 1}</td>
                        <td className="px-3 py-2">{wo.operation_name || wo.operation}</td>
                        <td className="px-3 py-2">{wo.work_center_name || wo.workCenter}</td>
                        <td className="px-3 py-2 font-mono text-right">{expectedStr}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-3 justify-between">
                            <StatusBadge status={wo.status} />
                            {!isNew && (
                              <WorkOrderTimer 
                                workOrder={wo} 
                                onAction={(action) => woMutation.mutate({ woId: wo.id || wo._id, action })} 
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {woFields.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-3 py-4 text-center text-steel2 text-[13px]">Select a BoM to populate work orders</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </FormShell.Body>

        <FormShell.Side>
          {isDraft && (
            <div className="flex flex-col gap-2">
              <button className="btn btn-rust justify-center" onClick={handleConfirm} disabled={actionMutation.isPending || saveMutation.isPending}>
                Confirm
              </button>
              <button className="btn justify-center" onClick={form.handleSubmit(onSubmit)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save Draft'}
              </button>
              {!isNew && (
                <button className="btn btn-danger justify-center mt-4" onClick={() => actionMutation.mutate({ action: 'cancel' })}>
                  Cancel Order
                </button>
              )}
            </div>
          )}

          {isConfirmed && (
            <div className="flex flex-col gap-2">
              <div className="text-[12px] text-steel bg-paper2 p-3 rounded border-[0.5px] border-rule mb-2">
                Use the Start buttons on the Work Orders tab to begin manufacturing.
              </div>
              <button className="btn btn-danger justify-center" onClick={() => actionMutation.mutate({ action: 'cancel' })}>
                Cancel Order
              </button>
            </div>
          )}

          {isInProgress && (
            <div className="flex flex-col gap-2">
              <button className="btn btn-danger justify-center" onClick={() => {
                if (window.confirm('Components have been allocated. Are you sure you want to cancel?')) {
                  actionMutation.mutate({ action: 'cancel' });
                }
              }}>
                Cancel Order
              </button>
            </div>
          )}

          {isToClose && (
            <div className="flex flex-col gap-2">
              <button className="btn btn-rust justify-center" onClick={() => setProduceDialogOpen(true)}>
                Produce
              </button>
              <button className="btn btn-danger justify-center mt-2" onClick={() => actionMutation.mutate({ action: 'cancel' })}>
                Cancel Order
              </button>
            </div>
          )}

          {isDone && (
            <div className="flex flex-col gap-2">
              {mo?.passport && (
                <a href={`/passports/${mo.passport}`} className="text-ink hover:underline text-[13px] inline-flex items-center gap-1 font-medium">
                  View passport ↗
                </a>
              )}
            </div>
          )}

          {isCancelled && (
            <div className="text-danger text-[13px]">
              Manufacturing was cancelled.
            </div>
          )}

          {!isNew && !isDraft && (
            <div className="card p-4 mt-2 bg-paper2">
              <a href={`${import.meta.env.VITE_API_BASE || 'http://localhost:5000/api'}${E.moPdf(id)}`} target="_blank" rel="noreferrer" className="text-ink hover:underline text-[13px] inline-flex items-center gap-1 font-medium mb-1">
                Download MO worksheet ↗
              </a>
            </div>
          )}

          {!isNew && mo?.source_type === 'auto_from_so' && (
            <div className="card p-4 mt-2 border-l-2 border-ink">
              <div className="text-[11px] font-semibold text-steel uppercase mb-2">Source</div>
              <div className="text-[13px] text-ink flex items-center gap-1">
                From <a href={`/sales/${mo.source_ref_id}`} className="font-mono text-rust hover:underline">{mo.source_ref}</a>
              </div>
            </div>
          )}

          {!isNew && auditLogs && (
            <div className="mt-4">
              <div className="text-[11px] font-semibold text-steel uppercase mb-3 tracking-wider">Status Timeline</div>
              <div className="relative border-l-[0.5px] border-rule ml-2 space-y-4 pb-2">
                {auditLogs.filter(a => a.action === 'Updated' && (a.fieldChanged === 'status' || a.field_name === 'status')).map((log, idx) => (
                  <div key={idx} className="relative pl-4">
                    <div className="absolute w-2 h-2 rounded-full bg-ink -left-[4.5px] top-[6px]"></div>
                    <div className="text-[13px] text-ink capitalize">{log.newValue || log.new_value}</div>
                    <div className="text-[11px] text-steel font-mono">{format(new Date(log.dateAndTime || log.created_at || new Date()), 'dd MMM HH:mm')}</div>
                  </div>
                ))}
                <div className="relative pl-4">
                  <div className="absolute w-2 h-2 rounded-full bg-steel2 -left-[4.5px] top-[6px]"></div>
                  <div className="text-[13px] text-ink">Draft</div>
                  <div className="text-[11px] text-steel font-mono">{format(new Date(mo?.created_at || mo?.createdAt || new Date()), 'dd MMM HH:mm')}</div>
                </div>
              </div>
            </div>
          )}
        </FormShell.Side>
      </FormShell>

      <ConfirmDialog
        isOpen={produceDialogOpen}
        onClose={() => setProduceDialogOpen(false)}
        title="Confirm production"
        message={`Confirm production of ${qtyProducedText}? This will consume components and credit finished goods. This cannot be undone.`}
        confirmText="Produce"
        onConfirm={async () => {
          await actionMutation.mutateAsync({ action: 'produce' });
        }}
      />
    </div>
  );
}
