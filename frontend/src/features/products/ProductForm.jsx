import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import FormShell from '../../components/FormShell';
import { FieldRow, FieldGrid } from '../../components/FieldRow';
import { MoneyInput } from '../../components/MoneyInput';
import { QtyInput } from '../../components/QtyInput';
import { Upload } from 'lucide-react';

export default function ProductForm({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = mode === 'new';

  const { data: prod, isLoading } = useQuery({
    queryKey: ['products', id],
    queryFn: async () => (await api.get(E.product(id))).data,
    enabled: !isNew
  });

  const { data: breakdown } = useQuery({
    queryKey: ['products', id, 'breakdown'],
    queryFn: async () => (await api.get(E.productBreakdown(id))).data,
    enabled: !isNew
  });

  const form = useForm({
    defaultValues: { sku: '', name: '', category: '', imageUrl: '', unitOfMeasure: 'Units', salesPrice: 0, costPrice: 0, onHandQty: 0, minStockQty: 0, leadTimeDays: 0, procureOnDemand: false, procurementMethod: 'Purchase' }
  });

  const procureOnDemand = form.watch('procureOnDemand');

  useEffect(() => {
    if (!isNew && prod) {
      form.reset(prod);
    }
  }, [prod, isNew, form]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue('imageUrl', reader.result, { shouldDirty: true });
      };
      reader.readAsDataURL(file);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (isNew) return (await api.post(E.products(), data)).data;
      return (await api.put(E.product(id), data)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['products']);
      toast.success('Product saved');
      if (isNew) navigate(`/products/${data._id || data.id}`, { replace: true });
    },
    onError: (err) => toast.error('Failed to save product')
  });

  if (!isNew && isLoading) return <div className="p-8 text-steel">Loading...</div>;

  return (
    <div className="h-full">
      <FormShell>
        <FormShell.Header 
          title={isNew ? 'New Product' : prod?.name}
          subtitle={prod?.category}
          reference={prod?.sku}
        />
        
        <FormShell.Tabs tabs={[{ id: 'general', label: 'General Information' }]} active="general" onChange={()=>{}} />

        <FormShell.Body>
          <div className="card p-6">
            <FieldGrid>
              <FieldRow label="SKU">
                <input {...form.register('sku')} className="field font-mono" disabled={!isNew} />
              </FieldRow>
              <FieldRow label="Name">
                <input {...form.register('name')} className="field" />
              </FieldRow>
              <FieldRow label="Category">
                <input {...form.register('category')} className="field" />
              </FieldRow>
              <FieldRow label="Image">
                <div className="flex gap-3 items-center w-full">
                  <div className="relative flex-1 flex items-center">
                    <input {...form.register('imageUrl')} className="field w-full pr-10" placeholder="Paste URL or upload..." />
                    <label className="absolute right-2 cursor-pointer text-steel hover:text-rust transition-colors">
                      <Upload size={16} />
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                  {form.watch('imageUrl') && (
                    <img 
                      src={form.watch('imageUrl')} 
                      alt="Preview" 
                      className="w-8 h-8 rounded object-cover bg-white border-[0.5px] border-rule flex-shrink-0" 
                      onError={(e) => e.target.style.display='none'} 
                    />
                  )}
                </div>
              </FieldRow>
              <FieldRow label="Unit of Measure">
                <select {...form.register('unitOfMeasure')} className="field">
                  <option value="Units">Units</option>
                  <option value="kg">kg</option>
                  <option value="m">m</option>
                  <option value="pack">pack</option>
                </select>
              </FieldRow>
              <FieldRow label="Sales Price">
                <MoneyInput {...form.register('salesPrice', { valueAsNumber: true })} />
              </FieldRow>
              <FieldRow label="Cost Price">
                <MoneyInput {...form.register('costPrice', { valueAsNumber: true })} />
              </FieldRow>
              <FieldRow label="On Hand Qty" hint="Editing this writes a stock adjustment">
                <QtyInput {...form.register('onHandQty', { valueAsNumber: true })} />
              </FieldRow>
              <FieldRow label="Min Stock Qty">
                <QtyInput {...form.register('minStockQty', { valueAsNumber: true })} />
              </FieldRow>
              <FieldRow label="Lead Time (days)">
                <QtyInput {...form.register('leadTimeDays', { valueAsNumber: true })} />
              </FieldRow>
            </FieldGrid>

            <div className="mt-8 border-t-[0.5px] border-rule pt-6">
              <h3 className="text-sm font-semibold text-ink mb-4">Procurement</h3>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" id="pod" {...form.register('procureOnDemand')} className="rounded border-[0.5px] border-rule" />
                <label htmlFor="pod" className="text-[13px] text-ink">Procure on demand (MTO)</label>
              </div>
              
              {procureOnDemand && (
                <div className="flex items-center gap-4 ml-6 p-4 bg-paper2 rounded border-[0.5px] border-rule">
                  <label className="flex items-center gap-2 text-[13px]">
                    <input type="radio" value="Purchase" {...form.register('procurementMethod')} />
                    Purchase
                  </label>
                  <label className="flex items-center gap-2 text-[13px]">
                    <input type="radio" value="Manufacturing" {...form.register('procurementMethod')} />
                    Manufacturing
                  </label>
                </div>
              )}
            </div>
          </div>
        </FormShell.Body>

        <FormShell.Side>
          <button className="btn btn-rust justify-center" onClick={form.handleSubmit((d) => saveMutation.mutate(d))} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save Product'}
          </button>
          
          {!isNew && (
            <>
              <div className="card p-5 mt-6 border-l-2 border-rust bg-paper">
                <div className="text-[11px] font-semibold text-steel uppercase mb-4 tracking-wider">Stock Summary</div>
                <div className="space-y-3 font-mono text-[13px]">
                  <div className="flex justify-between items-center">
                    <span className="text-steel font-sans text-[12px]">ON HAND</span>
                    <span className="text-ink text-base">{prod?.onHandQty || 0} {prod?.unitOfMeasure}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-steel font-sans text-[12px]">FREE</span>
                    <span className="text-success text-base">{prod?.freeToUseQty || (prod?.onHandQty - (prod?.reservedQty || 0))} {prod?.unitOfMeasure}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-steel font-sans text-[12px]">RESERVED</span>
                    <span className="text-warn text-base">{prod?.reservedQty || 0} {prod?.unitOfMeasure}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <a href={`/inventory?product=${id}`} className="text-ink hover:underline text-[13px] inline-flex items-center gap-1 font-medium">
                  Stock ledger entries ↗
                </a>
              </div>
            </>
          )}
        </FormShell.Side>
      </FormShell>
    </div>
  );
}
