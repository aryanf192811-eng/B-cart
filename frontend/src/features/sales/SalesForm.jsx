import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import FormShell from '../../components/FormShell';
import { FieldRow, FieldGrid } from '../../components/FieldRow';
import StatusBadge from '../../components/StatusBadge';
import Drawer from '../../components/Drawer';
import { MoneyInput as MInput } from '../../components/MoneyInput';
import { QtyInput as QInput } from '../../components/QtyInput';

const salesSchema = z.object({
  customerName: z.string().min(1, 'Required'),
  customerAddress: z.string().optional(),
  salesPerson: z.string().optional().nullable(),
  items: z.array(z.object({
    product: z.string().min(1, 'Required'),
    orderedQuantity: z.number().positive('Must be > 0'),
    salesPrice: z.number().nonnegative()
  })).min(1, 'Add at least one product line')
});

export default function SalesForm({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = mode === 'new';
  
  const [activeTab, setActiveTab] = useState('order');
  const [deliverDrawerOpen, setDeliverDrawerOpen] = useState(false);
  const [deliverQuantities, setDeliverQuantities] = useState({});

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: async () => (await api.get(E.users())).data });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => (await api.get(E.products())).data });

  const { data: so, isLoading, refetch } = useQuery({
    queryKey: ['sales', id],
    queryFn: async () => (await api.get(E.salesOne(id))).data,
    enabled: !isNew
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['audit', 'sales', id],
    queryFn: async () => (await api.get(`/audit?entity_type=SalesOrder&entity_id=${id}`)).data,
    enabled: !isNew
  });

  const form = useForm({
    resolver: zodResolver(salesSchema),
    defaultValues: { items: [{ product: '', orderedQuantity: 1, salesPrice: 0 }] }
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  useEffect(() => {
    if (!isNew && so) {
      form.reset({
        customerName: so.customerName,
        customerAddress: so.customerAddress || '',
        salesPerson: so.salesPerson?._id || so.salesPerson || '',
        items: so.items.map(i => ({
          product: i.product?._id || i.product,
          orderedQuantity: i.orderedQuantity,
          salesPrice: i.salesPrice
        }))
      });
    }
  }, [so, isNew, form]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data, items: data.items.map(i => ({...i, total: i.orderedQuantity * i.salesPrice})) };
      if (isNew) return (await api.post(E.sales(), payload)).data;
      return (await api.put(E.salesOne(id), payload)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['sales']);
      toast.success(isNew ? 'Draft created' : 'Saved');
      if (isNew) navigate(`/sales/${data._id || data.id}`, { replace: true });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to save')
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, payload }) => {
      if (action === 'confirm') return (await api.post(E.salesConfirm(id))).data;
      if (action === 'deliver') return (await api.post(E.salesDeliver(id), payload)).data;
      if (action === 'cancel') return (await api.post(E.salesCancel(id))).data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['sales']);
      refetch();
      if (variables.action === 'deliver') {
        setDeliverDrawerOpen(false);
        toast.success('Delivered');
      } else {
        toast.success(variables.action === 'confirm' ? 'Confirmed' : 'Cancelled');
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Action failed')
  });

  const onSubmit = (data) => saveMutation.mutate(data);

  const handleConfirm = async () => {
    if (form.formState.isDirty) await form.handleSubmit(onSubmit)();
    actionMutation.mutate({ action: 'confirm' });
  };

  const status = so?.status?.toLowerCase() || 'draft';
  const isDraft = status === 'draft';
  const isConfirmed = status === 'confirmed';
  const isPartial = status === 'partially_delivered';
  const isDelivered = status === 'delivered' || status === 'fully_delivered';
  const isCancelled = status === 'cancelled';

  const sum = form.watch('items').reduce((acc, curr) => acc + (curr.orderedQuantity || 0) * (curr.salesPrice || 0), 0);

  if (!isNew && isLoading) return <div className="p-8 text-steel">Loading...</div>;

  return (
    <div className="h-full">
      <FormShell>
        <FormShell.Header 
          title={isNew ? 'New sales order' : `Sales order ${so?.soNumber}`}
          subtitle={isNew ? 'Draft' : so?.customerName}
          reference={isNew ? '—' : so?.soNumber}
          status={isNew ? 'draft' : so?.status}
        />
        
        <FormShell.Tabs 
          tabs={[
            { id: 'order', label: 'Order' },
            ...(!isNew ? [{ id: 'audit', label: 'Audit' }] : [])
          ]}
          active={activeTab}
          onChange={(t) => {
            if (t === 'audit') navigate(`/audit?entity_type=SalesOrder&entity_id=${id}`);
            else setActiveTab(t);
          }}
        />

        <FormShell.Body>
          <div className="card p-6">
            <FieldGrid>
              <FieldRow label="Customer" required error={form.formState.errors.customerName?.message}>
                <input {...form.register('customerName')} className="field" disabled={!isDraft} />
              </FieldRow>
              <FieldRow label="Customer Address">
                <input {...form.register('customerAddress')} className="field" disabled={!isDraft} />
              </FieldRow>
              <FieldRow label="Salesperson">
                <select {...form.register('salesPerson')} className="field" disabled={!isDraft}>
                  <option value="">Select user...</option>
                  {users?.map(u => <option key={u._id} value={u._id}>{u.name || u.full_name}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Creation Date">
                <div className="font-mono text-steel py-2">
                  {isNew ? format(new Date(), 'dd MMM yyyy') : format(new Date(so?.createdAt), 'dd MMM yyyy')}
                </div>
              </FieldRow>
            </FieldGrid>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="w-[30%]">PRODUCT</th>
                  {!isNew && <th>AVAILABILITY</th>}
                  <th className="w-[15%]">ORDERED</th>
                  <th className="w-[15%]">UNIT PRICE</th>
                  {!isDraft && !isNew && <th>DELIVERED</th>}
                  <th className="w-[15%] text-right">TOTAL</th>
                  {isDraft && <th className="w-[5%]"></th>}
                </tr>
              </thead>
              <tbody>
                {fields.map((f, i) => {
                  const ordered = form.watch(`items.${i}.orderedQuantity`) || 0;
                  const price = form.watch(`items.${i}.salesPrice`) || 0;
                  const prodId = form.watch(`items.${i}.product`);
                  const prod = products?.find(p => p._id === prodId);
                  
                  const origItem = so?.items?.[i];
                  const delivered = origItem?.deliveredQuantity || 0;
                  
                  let availableStatus = null;
                  if (!isNew && prod) {
                    const freeToUse = prod.freeToUseQty || (prod.onHandQty - (prod.reservedQty||0));
                    const remaining = ordered - delivered;
                    availableStatus = freeToUse >= remaining ? 'Available' : 'Not available';
                  }

                  return (
                    <tr key={f.id} className="border-b-[0.5px] border-rule">
                      <td className="px-3 py-2">
                        <select {...form.register(`items.${i}.product`)} className="field w-full" disabled={!isDraft}>
                          <option value="">Select product...</option>
                          {products?.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                        </select>
                      </td>
                      {!isNew && (
                        <td className="px-3 py-2">
                          {availableStatus && (
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${availableStatus==='Available' ? 'bg-successBg text-success' : 'bg-dangerBg text-danger'}`}>
                              {availableStatus}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <QInput {...form.register(`items.${i}.orderedQuantity`, { valueAsNumber: true })} disabled={!isDraft} />
                      </td>
                      <td className="px-3 py-2">
                        <MInput {...form.register(`items.${i}.salesPrice`, { valueAsNumber: true })} disabled={!isDraft} />
                      </td>
                      {!isDraft && !isNew && (
                        <td className="px-3 py-2 font-mono text-steel text-right">{delivered}</td>
                      )}
                      <td className="px-3 py-2 font-mono text-right text-ink bg-paper2/30">
                        ₹ {(ordered * price).toFixed(2)}
                      </td>
                      {isDraft && (
                        <td className="px-3 py-2 text-center">
                          <button type="button" onClick={() => remove(i)} className="text-danger hover:text-danger/80">×</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {isDraft && (
              <div className="p-3 border-b-[0.5px] border-rule">
                <button type="button" onClick={() => append({ product: '', orderedQuantity: 1, salesPrice: 0 })} className="text-rust text-[13px] hover:underline">
                  + Add a product line
                </button>
              </div>
            )}
            <div className="p-4 bg-paper2 flex justify-end">
              <span className="font-mono text-[16px] text-ink font-semibold">TOTAL ₹ {sum.toFixed(2)}</span>
            </div>
          </div>
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

          {(isConfirmed || isPartial) && (
            <div className="flex flex-col gap-2">
              <button className="btn btn-rust justify-center" onClick={() => setDeliverDrawerOpen(true)}>
                {isPartial ? 'Deliver remaining' : 'Deliver'}
              </button>
              <button className="btn btn-danger justify-center mt-4" onClick={() => actionMutation.mutate({ action: 'cancel' })}>
                Cancel Order
              </button>
            </div>
          )}

          {isDelivered && (
            <div className="flex flex-col gap-2">
              <a href={`${import.meta.env.VITE_API_BASE || 'http://localhost:5000/api'}${E.salesPdf(id)}`} target="_blank" rel="noreferrer" className="text-ink hover:underline text-[13px] inline-flex items-center gap-1 font-medium">
                Download invoice ↗
              </a>
            </div>
          )}

          {isCancelled && (
            <div className="text-danger text-[13px]">
              Order was cancelled.
            </div>
          )}

          {!isNew && so?.procurementSummary && (
            <div className="card p-4 mt-2 border-l-2 border-info">
              <div className="text-[11px] font-semibold text-steel uppercase mb-2">Procurement Summary</div>
              <div className="text-[13px] text-ink">This order triggered:</div>
              <ul className="mt-2 space-y-1">
                {so.procurementSummary.map((p, idx) => (
                  <li key={idx}>
                    <a href={p.link} className="text-rust hover:underline font-mono text-[12px]">{p.ref}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!isNew && auditLogs && (
            <div className="mt-4">
              <div className="text-[11px] font-semibold text-steel uppercase mb-3 tracking-wider">Status Timeline</div>
              <div className="relative border-l-[0.5px] border-rule ml-2 space-y-4 pb-2">
                {auditLogs.filter(a => a.action === 'Updated' && a.fieldChanged === 'status').map((log, idx) => (
                  <div key={idx} className="relative pl-4">
                    <div className="absolute w-2 h-2 rounded-full bg-ink -left-[4.5px] top-[6px]"></div>
                    <div className="text-[13px] text-ink capitalize">{log.newValue}</div>
                    <div className="text-[11px] text-steel font-mono">{format(new Date(log.dateAndTime), 'dd MMM HH:mm')}</div>
                  </div>
                ))}
                <div className="relative pl-4">
                  <div className="absolute w-2 h-2 rounded-full bg-steel2 -left-[4.5px] top-[6px]"></div>
                  <div className="text-[13px] text-ink">Draft</div>
                  <div className="text-[11px] text-steel font-mono">{format(new Date(so.createdAt), 'dd MMM HH:mm')}</div>
                </div>
              </div>
            </div>
          )}
        </FormShell.Side>
      </FormShell>

      <Drawer
        isOpen={deliverDrawerOpen}
        onClose={() => setDeliverDrawerOpen(false)}
        title="Deliver products"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDeliverDrawerOpen(false)}>Cancel</button>
            <button className="btn btn-rust" onClick={() => {
              const lines = Object.entries(deliverQuantities).map(([itemId, qty]) => ({
                id: itemId,
                qty_delivered: (so.items.find(i => i._id === itemId)?.deliveredQuantity || 0) + qty
              })).filter(l => l.qty_delivered > 0);
              actionMutation.mutate({ action: 'deliver', payload: { lines } });
            }}>Submit delivery</button>
          </>
        }
      >
        <div className="space-y-4">
          {so?.items?.map(item => {
            const prod = item.product;
            const remaining = item.orderedQuantity - (item.deliveredQuantity || 0);
            if (remaining <= 0) return null;
            
            const freeToUse = prod?.freeToUseQty || 0;
            const max = Math.min(remaining, freeToUse);

            return (
              <div key={item._id} className="p-3 bg-paper2 border-[0.5px] border-rule rounded flex flex-col gap-2">
                <div className="flex justify-between font-medium text-[13px]">
                  <span>{prod?.name || 'Product'}</span>
                  <span className="font-mono">{remaining} left</span>
                </div>
                <div className="text-[11px] text-steel">Available to deliver: <span className="font-mono text-ink">{freeToUse}</span></div>
                <QInput 
                  placeholder="Qty to deliver" 
                  max={max}
                  min={0}
                  value={deliverQuantities[item._id] || 0}
                  onChange={(e) => setDeliverQuantities(p => ({...p, [item._id]: Number(e.target.value)}))}
                />
              </div>
            );
          })}
        </div>
      </Drawer>
    </div>
  );
}
