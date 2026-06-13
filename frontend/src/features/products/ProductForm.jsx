import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { Camera, Upload } from 'lucide-react';

import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import { assetUrl } from '../../utils/assetUrl';
import FormShell from '../../components/FormShell';
import { FieldRow, FieldGrid } from '../../components/FieldRow';


export default function ProductForm({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = mode === 'new';
  const imageInputRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);

  const { data: prodData, isLoading } = useQuery({
    queryKey: ['products', id],
    queryFn: async () => (await api.get(E.product(id))).data,
    enabled: !isNew
  });

  const prod = prodData?.product;

  const { data: breakdown } = useQuery({
    queryKey: ['products', id, 'breakdown'],
    queryFn: async () => (await api.get(E.productBreakdown(id))).data,
    enabled: !isNew
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get(E.categories())).data
  });

  const form = useForm({
    defaultValues: {
      sku: '', name: '', category_id: '', unit: 'Units',
      sales_price: 0, cost_price: 0, on_hand_qty: 0,
      min_stock_qty: 0, lead_time_days: 7,
      procure_on_demand: false, procurement_type: 'purchase'
    }
  });



  useEffect(() => {
    if (!isNew && prod) {
      form.reset({
        sku: prod.sku || '',
        name: prod.name || '',
        category_id: prod.category_id || '',
        unit: prod.unit || 'Units',
        sales_price: parseFloat(prod.sales_price) || 0,
        cost_price: parseFloat(prod.cost_price) || 0,
        on_hand_qty: parseFloat(prod.on_hand_qty) || 0,
        min_stock_qty: parseFloat(prod.min_stock_qty) || 0,
        lead_time_days: prod.lead_time_days || 7,
        procure_on_demand: prod.procure_on_demand || false,
        procurement_type: prod.procurement_type || 'purchase',
        default_vendor_id: prod.default_vendor_id || null,
      });
      if (prod.image_url) setImagePreview(assetUrl(prod.image_url));
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
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product saved');
      const savedId = data?.product?.id || id;
      if (isNew) navigate(`/products/${savedId}`, { replace: true });
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to save product')
  });

  const imageMutation = useMutation({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append('image', file);
      return (await api.post(E.productImage(id), form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })).data;
    },
    onSuccess: (data) => {
      setImagePreview(assetUrl(data.image_url));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Image uploaded');
    },
    onError: () => toast.error('Image upload failed')
  });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (isNew) {
      toast.error('Save product first, then upload an image.');
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);
    imageMutation.mutate(file);
  };

  if (!isNew && isLoading) return <div className="p-8 text-steel">Loading...</div>;

  const onHandQty = parseFloat(prod?.on_hand_qty) || 0;
  const freeToUseQty = parseFloat(prod?.free_to_use_qty) || 0;
  const reservedQty = parseFloat(prod?.reserved_qty) || 0;

  return (
    <div className="h-full">
      <FormShell>
        <FormShell.Header
          title={isNew ? 'New Product' : prod?.name}
          subtitle={prod?.category}
          reference={prod?.sku}
        />
        
        <FormShell.Tabs tabs={[{ id: 'general', label: 'General Information' }]} active="general" onChange={() => {}} />

        <FormShell.Body>
          <div className="card p-6">
            {/* Product Image */}
            {!isNew && (
              <div className="mb-6 flex items-start gap-5">
                <div
                  className="w-24 h-24 rounded-lg border-[0.5px] border-rule bg-paper2 flex items-center justify-center overflow-hidden cursor-pointer group relative"
                  onClick={() => imageInputRef.current?.click()}
                >
                  {imagePreview
                    ? <img src={imagePreview} alt={prod?.name} className="w-full h-full object-cover" />
                    : <Camera size={28} className="text-steel group-hover:text-rust transition-colors" />
                  }
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload size={18} className="text-white" />
                  </div>
                </div>
                <div className="pt-1">
                  <div className="text-[12px] font-semibold text-ink mb-1">Product Image</div>
                  <div className="text-[11px] text-steel mb-2">Click to upload. JPEG, PNG, WebP up to 5 MB.</div>
                  <button
                    type="button"
                    className="text-[12px] text-rust hover:underline font-medium"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    {imageMutation.isPending ? 'Uploading...' : imagePreview ? 'Change Image' : 'Upload Image'}
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </div>
              </div>
            )}

            <FieldGrid>
              <FieldRow label="SKU">
                <input {...form.register('sku')} className="field font-mono" disabled={!isNew} />
              </FieldRow>
              <FieldRow label="Name">
                <input {...form.register('name')} className="field" />
              </FieldRow>
              <FieldRow label="Category">
                <select {...form.register('category_id', { valueAsNumber: true })} className="field">
                  <option value="">-- Select Category --</option>
                  {Array.isArray(categories) && categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow label="Unit of Measure">
                <select {...form.register('unit')} className="field">
                  <option value="Units">Units</option>
                  <option value="kg">kg</option>
                  <option value="Meters">Meters</option>
                  <option value="Packs">Packs</option>
                  <option value="Liters">Liters</option>
                </select>
              </FieldRow>
              <FieldRow label="Sales Price (₹)">
                <input type="number" step="0.01" min="0" {...form.register('sales_price', { valueAsNumber: true })} className="field font-mono" />
              </FieldRow>
              <FieldRow label="Cost Price (₹)">
                <input type="number" step="0.01" min="0" {...form.register('cost_price', { valueAsNumber: true })} className="field font-mono" />
              </FieldRow>
              <FieldRow label="On Hand Qty" hint="Editing this writes a stock adjustment">
                <input type="number" step="0.001" min="0" {...form.register('on_hand_qty', { valueAsNumber: true })} className="field font-mono" />
              </FieldRow>
              <FieldRow label="Min Stock Qty">
                <input type="number" step="0.001" min="0" {...form.register('min_stock_qty', { valueAsNumber: true })} className="field font-mono" />
              </FieldRow>
              <FieldRow label="Lead Time (days)">
                <input type="number" step="1" min="0" {...form.register('lead_time_days', { valueAsNumber: true })} className="field font-mono" />
              </FieldRow>
            </FieldGrid>

            <div className="mt-8 border-t-[0.5px] border-rule pt-6">
              <h3 className="text-sm font-semibold text-ink mb-4">Procurement</h3>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" id="pod" {...form.register('procure_on_demand')} className="rounded border-[0.5px] border-rule" />
                <label htmlFor="pod" className="text-[13px] text-ink">Procure on demand (MTO)</label>
              </div>
              
              {(() => {
                const pod = form.watch('procure_on_demand');
                return pod ? (
                <div className="flex items-center gap-4 ml-6 p-4 bg-paper2 rounded border-[0.5px] border-rule">
                  <label className="flex items-center gap-2 text-[13px]">
                    <input type="radio" value="purchase" {...form.register('procurement_type')} />
                    Purchase from Vendor
                  </label>
                  <label className="flex items-center gap-2 text-[13px]">
                    <input type="radio" value="manufacturing" {...form.register('procurement_type')} />
                    Manufacturing Order
                  </label>
                </div>
              ) : null;
              })()}
            </div>
          </div>

          {/* Inventory Breakdown */}
          {!isNew && breakdown?.breakdown && (
            <div className="card p-6 mt-4">
              <h3 className="text-sm font-semibold text-ink mb-4">Inventory Breakdown</h3>
              <div className="space-y-2">
                {breakdown.breakdown.map((b, i) => (
                  <div key={i} className="flex justify-between items-center text-[13px] py-1.5 border-b-[0.5px] border-rule last:border-0">
                    <span className="text-steel">{b.category}</span>
                    <span className={`font-mono font-semibold ${parseFloat(b.qty) < 0 ? 'text-rust' : 'text-success'}`}>
                      {parseFloat(b.qty) > 0 ? '+' : ''}{parseFloat(b.qty).toFixed(3)}
                    </span>
                  </div>
                ))}
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
            {saveMutation.isPending ? 'Saving...' : 'Save Product'}
          </button>
          
          {!isNew && (
            <>
              <div className="card p-5 mt-6 border-l-2 border-rust bg-paper">
                <div className="text-[11px] font-semibold text-steel uppercase mb-4 tracking-wider">Stock Summary</div>
                <div className="space-y-3 font-mono text-[13px]">
                  <div className="flex justify-between items-center">
                    <span className="text-steel font-sans text-[12px]">ON HAND</span>
                    <span className="text-ink text-base">{onHandQty.toFixed(3)} {prod?.unit}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-steel font-sans text-[12px]">FREE TO USE</span>
                    <span className="text-success text-base">{freeToUseQty.toFixed(3)} {prod?.unit}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-steel font-sans text-[12px]">RESERVED</span>
                    <span className="text-warn text-base">{reservedQty.toFixed(3)} {prod?.unit}</span>
                  </div>
                  {prod?.is_low_stock && (
                    <div className="mt-2 text-[11px] font-bold text-rust uppercase bg-rust/10 px-2 py-1 rounded text-center tracking-wide">
                      ⚠ Below Minimum Stock
                    </div>
                  )}
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
