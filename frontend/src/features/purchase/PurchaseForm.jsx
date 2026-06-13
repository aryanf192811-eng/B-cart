import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import { useAuth } from '../../store/auth';
import { loadRazorpay } from '../../utils/razorpay';
import FormShell from '../../components/FormShell';
import { FieldRow, FieldGrid } from '../../components/FieldRow';
import StatusBadge from '../../components/StatusBadge';
import Drawer from '../../components/Drawer';
import { MoneyInput as MInput } from '../../components/MoneyInput';
import { QtyInput as QInput } from '../../components/QtyInput';

const purchaseSchema = z.object({
  vendor_id: z.string().min(1, 'Required').or(z.number()),
  vendorAddress: z.string().optional(),
  responsiblePerson: z.string().optional().nullable(),
  expectedDelivery: z.string().min(1, 'Required'),
  items: z.array(z.object({
    product: z.string().min(1, 'Required'),
    orderedQuantity: z.number().positive('Must be > 0'),
    costPrice: z.number().nonnegative()
  })).min(1, 'Add at least one product line')
});

export default function PurchaseForm({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isNew = mode === 'new';
  const prefill = location.state || {};
  
  const [activeTab, setActiveTab] = useState('order');
  const [receiveDrawerOpen, setReceiveDrawerOpen] = useState(false);
  const [receiveQuantities, setReceiveQuantities] = useState({});

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: async () => {
    const d = await api.get(E.users());
    return d.data.users || d.data;
  }});
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => {
    const d = await api.get(E.products());
    return d.data.rows || d.data;
  }});
  const { data: vendors } = useQuery({ queryKey: ['vendors'], queryFn: async () => {
    const d = await api.get(E.vendors());
    return d.data.rows || d.data;
  }});
  const { data: po, isLoading, refetch } = useQuery({
    queryKey: ['purchase', id],
    queryFn: async () => {
      const res = await api.get(E.purchaseOne(id));
      return res.data.purchase_order || res.data;
    },
    enabled: !isNew
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['audit', 'purchase', id],
    queryFn: async () => (await api.get(`/audit?entity_type=PurchaseOrder&entity_id=${id}`)).data.rows || [],
    enabled: !isNew
  });

  const form = useForm({
    resolver: zodResolver(purchaseSchema),
    defaultValues: { 
      vendor_id: prefill.vendor_id || '',
      items: prefill.lines ? prefill.lines.map(l => ({
        product: l.product_id?.toString() || '',
        orderedQuantity: l.qty_ordered || 1,
        costPrice: l.unit_price || 0
      })) : [{ product: '', orderedQuantity: 1, costPrice: 0 }],
      expectedDelivery: '' 
    }
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  useEffect(() => {
    if (!isNew && po) {
      form.reset({
        vendor_id: po.vendor_id || '',
        vendorAddress: po.vendorAddress || '',
        responsiblePerson: po.responsible_id || '',
        expectedDelivery: po.expected_delivery_date ? format(new Date(po.expected_delivery_date), 'yyyy-MM-dd') : '',
        items: po.lines?.map(i => ({
          product: i.product_id,
          orderedQuantity: i.qty_ordered,
          costPrice: i.unit_price
        })) || []
      });
    }
  }, [po, isNew, form]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        vendor_id: data.vendor_id,
        responsible_id: data.responsiblePerson || null,
        expected_delivery_date: data.expectedDelivery || null,
        lines: data.items.map(i => ({
          product_id: i.product,
          qty_ordered: i.orderedQuantity,
          unit_price: i.costPrice
        }))
      };
      if (isNew) return (await api.post(E.purchase(), payload)).data;
      return (await api.put(E.purchaseOne(id), payload)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['purchase']);
      toast.success(isNew ? 'Draft created' : 'Saved');
      const poId = data.purchase_order?.id || data.id;
      if (isNew && poId) navigate(`/purchase/${poId}`, { replace: true });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to save')
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, payload, overrideId }) => {
      const targetId = overrideId || id;
      if (action === 'confirm') return (await api.post(E.purchaseConfirm(targetId))).data;
      if (action === 'receive') return (await api.post(E.purchaseReceive(targetId), payload)).data;
      if (action === 'cancel') return (await api.post(E.purchaseCancel(targetId))).data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['purchase']);
      refetch();
      if (variables.action === 'receive') {
        setReceiveDrawerOpen(false);
        toast.success('Received');
      } else {
        toast.success(variables.action === 'confirm' ? 'Confirmed' : 'Cancelled');
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Action failed')
  });

  const handlePay = async () => {
    try {
      await loadRazorpay();
      const { data } = await api.post(E.purchasePay(id));
      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: 'B-cart · ' + data.vendor,
        description: `Purchase Order Payment for ${data.po_number}`,
        order_id: data.razorpay_order_id,
        handler: async (resp) => {
          await api.post(E.purchaseVerify(), { ...resp, po_id: id });
          toast.success('Payment verified');
          queryClient.invalidateQueries(['purchase', id]);
          refetch();
        },
        prefill: { name: user?.name || user?.full_name, email: user?.email },
        theme: { color: '#0F1419' }
      };
      new window.Razorpay(options).open();
    } catch (err) {
      toast.error('Payment initialization failed');
    }
  };

  const onSubmit = (data) => saveMutation.mutate(data);

  const handleConfirm = async () => {
    if (form.formState.isDirty || isNew) {
      form.handleSubmit((data) => {
        saveMutation.mutate(data, {
          onSuccess: (res) => {
            const newId = res.purchase_order?.id || res.id || id;
            actionMutation.mutate({ action: 'confirm', overrideId: newId });
          }
        });
      })();
    } else {
      actionMutation.mutate({ action: 'confirm' });
    }
  };

  const status = po?.status?.toLowerCase() || 'draft';
  const isDraft = status === 'draft';
  const isConfirmed = status === 'confirmed';
  const isPartial = status === 'partially_received';
  const isReceived = status === 'received' || status === 'fully_received';
  const isCancelled = status === 'cancelled';
  const isUnpaid = po?.payment_status !== 'paid';

  const sum = form.watch('items').reduce((acc, curr) => acc + (curr.orderedQuantity || 0) * (curr.costPrice || 0), 0);

  if (!isNew && isLoading) return <div className="p-8 text-steel">Loading...</div>;

  return (
    <div className="h-full">
      <FormShell>
        <FormShell.Header 
          title={isNew ? 'New purchase order' : `Purchase order ${po?.po_number}`}
          subtitle={isNew ? 'Draft' : po?.vendor_name}
          reference={isNew ? '—' : po?.po_number}
          status={isNew ? 'draft' : po?.status}
        />
        
        <FormShell.Tabs 
          tabs={[
            { id: 'order', label: 'Order' },
            ...(!isNew ? [{ id: 'audit', label: 'Audit' }] : [])
          ]}
          active={activeTab}
          onChange={(t) => {
            if (t === 'audit') navigate(`/audit?entity_type=PurchaseOrder&entity_id=${id}`);
            else setActiveTab(t);
          }}
        />

        <FormShell.Body>
          <div className="card p-6">
            <FieldGrid>
              <FieldRow label="Vendor" required error={form.formState.errors.vendor_id?.message}>
                <select {...form.register('vendor_id')} className="field" disabled={!isDraft}>
                  <option value="">Select vendor...</option>
                  {vendors?.map?.(v => <option key={v.id || v._id} value={v.id || v._id}>{v.name}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Vendor Address">
                <input {...form.register('vendorAddress')} className="field" disabled={!isDraft} />
              </FieldRow>
              <FieldRow label="Responsible">
                <select {...form.register('responsiblePerson')} className="field" disabled={!isDraft}>
                  <option value="">Select user...</option>
                  {users?.map(u => <option key={u.id || u._id} value={u.id || u._id}>{u.name || u.full_name}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Expected Delivery" required error={form.formState.errors.expectedDelivery?.message}>
                <input {...form.register('expectedDelivery')} type="date" className="field" disabled={!isDraft} />
              </FieldRow>
            </FieldGrid>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="w-[30%]">PRODUCT</th>
                  <th className="w-[15%]">ORDERED</th>
                  <th className="w-[15%]">UNIT COST</th>
                  {!isDraft && !isNew && <th>RECEIVED</th>}
                  {!isDraft && !isNew && <th>REJECTED</th>}
                  <th className="w-[15%] text-right">TOTAL</th>
                  {isDraft && <th className="w-[5%]"></th>}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const itemsWatched = (() => {
                    try {
                      return form.watch('items');
                    } catch(e) {
                      return [];
                    }
                  })();
                  return fields.map((f, i) => {
                    const ordered = itemsWatched?.[i]?.orderedQuantity || 0;
                    const price = itemsWatched?.[i]?.costPrice || 0;
                    const origItem = po?.lines?.[i];
                    const received = origItem?.qty_received || 0;
                    const rejected = origItem?.rejected_qty || 0;

                  return (
                    <tr key={f.id} className="border-b-[0.5px] border-rule">
                      <td className="px-3 py-2">
                        <select {...form.register(`items.${i}.product`)} className="field w-full" disabled={!isDraft}>
                          <option value="">Select product...</option>
                          {products?.map?.(p => <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <QInput {...form.register(`items.${i}.orderedQuantity`, { valueAsNumber: true })} disabled={!isDraft} />
                      </td>
                      <td className="px-3 py-2">
                        <MInput {...form.register(`items.${i}.costPrice`, { valueAsNumber: true })} disabled={!isDraft} />
                      </td>
                      {!isDraft && !isNew && (
                        <td className="px-3 py-2 font-mono text-success text-right">{received}</td>
                      )}
                      {!isDraft && !isNew && (
                        <td className="px-3 py-2 font-mono text-danger text-right">{rejected}</td>
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
                });
              })()}
              </tbody>
            </table>
            {isDraft && (
              <div className="p-3 border-b-[0.5px] border-rule">
                <button type="button" onClick={() => append({ product: '', orderedQuantity: 1, costPrice: 0 })} className="text-rust text-[13px] hover:underline">
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
              <button className="btn btn-rust justify-center" onClick={() => setReceiveDrawerOpen(true)}>
                {isPartial ? 'Receive remaining' : 'Receive'}
              </button>
              {isUnpaid && (
                <button className="btn justify-center" onClick={handlePay}>
                  Pay with Razorpay
                </button>
              )}
              <button className="btn btn-danger justify-center mt-4" onClick={() => actionMutation.mutate({ action: 'cancel' })}>
                Cancel Order
              </button>
            </div>
          )}

          {isReceived && (
            <div className="flex flex-col gap-2">
              {isUnpaid && (
                <button className="btn justify-center mt-2" onClick={handlePay}>
                  Pay with Razorpay
                </button>
              )}
            </div>
          )}

          {isCancelled && (
            <div className="text-danger text-[13px]">
              Order was cancelled.
            </div>
          )}

          {!isNew && !isDraft && (
            <div className="card p-4 mt-2 bg-paper2">
              <a href={`${import.meta.env.VITE_API_BASE || 'http://localhost:5000/api'}${E.purchasePdf(id)}`} target="_blank" rel="noreferrer" className="text-ink hover:underline text-[13px] inline-flex items-center gap-1 font-medium mb-1">
                Download PDF ↗
              </a>
            </div>
          )}

          {!isNew && !isDraft && (
            <div className="card p-4 mt-2 border-l-2 border-ink bg-paper2">
              <div className="text-[11px] font-semibold text-steel uppercase mb-2">Payment Status</div>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={po?.payment_status || 'unpaid'} />
              </div>
              {po?.payment_status === 'paid' && po?.razorpay_payment_id && (
                <div className="text-[11px] text-steel">
                  Razorpay ref: <span className="font-mono">{po.razorpay_payment_id}</span>
                </div>
              )}
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
                  <div className="text-[11px] text-steel font-mono">{format(new Date(po?.created_at || po?.createdAt || new Date()), 'dd MMM HH:mm')}</div>
                </div>
              </div>
            </div>
          )}
        </FormShell.Side>
      </FormShell>

      <Drawer
        isOpen={receiveDrawerOpen}
        onClose={() => setReceiveDrawerOpen(false)}
        title="Receive products"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setReceiveDrawerOpen(false)}>Cancel</button>
            <button className="btn btn-rust" onClick={() => {
              const lines = Object.entries(receiveQuantities).map(([itemId, vals]) => {
                const lineId = po.lines.find(i => i.product_id == itemId || i.id == itemId)?.id;
                return {
                  id: lineId,
                  qty_received: (po.lines.find(i => i.id == lineId)?.qty_received || 0) + (vals.qty || 0),
                  rejected_qty: (po.lines.find(i => i.id == lineId)?.rejected_qty || 0) + (vals.rej || 0),
                };
              }).filter(l => l.qty_received > 0 || l.rejected_qty > 0);
              actionMutation.mutate({ action: 'receive', payload: { lines } });
            }}>Submit receipt</button>
          </>
        }
      >
        <div className="space-y-4">
          {po?.lines?.map(item => {
            const prod = products?.find?.(p => p.id == item.product_id || p._id == item.product_id);
            const remaining = item.qty_ordered - (item.qty_received || 0) - (item.rejected_qty || 0);
            if (remaining <= 0) return null;

            return (
              <div key={item._id} className="p-3 bg-paper2 border-[0.5px] border-rule rounded flex flex-col gap-2">
                <div className="flex justify-between font-medium text-[13px]">
                  <span>{prod?.name || 'Product'}</span>
                  <span className="font-mono">{remaining} left to receive</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="text-[11px] text-steel mb-1">Good quantity</div>
                    <QInput 
                      max={remaining}
                      min={0}
                      value={receiveQuantities[item.id]?.qty || 0}
                      onChange={(e) => setReceiveQuantities(p => ({...p, [item.id]: {...p[item.id], qty: Number(e.target.value)}}))}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] text-steel mb-1">Rejected quantity</div>
                    <QInput 
                      max={remaining - (receiveQuantities[item.id]?.qty || 0)}
                      min={0}
                      value={receiveQuantities[item.id]?.rej || 0}
                      onChange={(e) => setReceiveQuantities(p => ({...p, [item.id]: {...p[item.id], rej: Number(e.target.value)}}))}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Drawer>
    </div>
  );
}
