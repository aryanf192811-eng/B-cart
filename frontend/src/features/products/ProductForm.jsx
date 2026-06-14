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
import MaterialTraceability from './MaterialTraceability';


export default function ProductForm({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = mode === 'new';
  const [isEditing, setIsEditing] = useState(isNew);
  const imageInputRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

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
      sales_price: 0, cost_price: 0, lead_time_days: 7,
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
        lead_time_days: parseInt(prod.lead_time_days) || 7,
        procure_on_demand: prod.procure_on_demand || false,
        procurement_type: prod.procurement_type || 'purchase'
      });
      if (prod.image_url) {
        setImagePreview(assetUrl(prod.image_url));
      }
    }
  }, [prod, isNew, form]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      let productId;
      if (isNew) {
        const res = await api.post(E.products(), data);
        productId = res.data._id || res.data.id;
      } else {
        const res = await api.put(E.product(id), data);
        productId = id;
      }

      if (selectedFile) {
        const fd = new FormData();
        fd.append('image', selectedFile);
        await api.post(`/products/${productId}/image`, fd);
      }

      return { id: productId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['products']);
      toast.success('Product saved');
      if (isNew) navigate(`/products/${data.id}`, { replace: true });
      else {
        setIsEditing(false);
        setSelectedFile(null);
      }
    },
    onError: () => toast.error('Failed to save product')
  });

  const imageMutation = useMutation({
    mutationFn: async (file) => {
      const fd = new FormData();
      fd.append('image', file);
      return (await api.post(`/products/${id}/image`, fd)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['products']);
      toast.success('Image uploaded');
      setImagePreview(assetUrl(data.product.image_url));
    },
    onError: () => toast.error('Failed to upload image')
  });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Create a local preview
    setImagePreview(URL.createObjectURL(file));
    setSelectedFile(file);

    // If not new, upload immediately as before
    if (!isNew) {
      imageMutation.mutate(file);
    }
  };

  const onSubmit = (data) => {
    saveMutation.mutate(data);
  };

  if (!isNew && isLoading) return <div className="p-8 text-steel">Loading...</div>;

  const onHandQty = parseFloat(prod?.on_hand_qty) || 0;
  const freeToUseQty = parseFloat(prod?.free_to_use_qty) || 0;
  const reservedQty = parseFloat(prod?.reserved_qty) || 0;

  return (
    <div className="h-full">
      <FormShell>
        <FormShell.Header title={isNew ? 'New Product' : (isEditing ? 'Edit Product' : prod?.name)} subtitle="Master Data" />
        
        <FormShell.Tabs tabs={[{ id: 'general', label: 'General Information' }]} active="general" onChange={() => {}} />

        <FormShell.Body>
          <div className="card p-6">
            {/* Product Image */}
            {/* Product Gallery */}
            {(isNew || isEditing || prod?.images?.length > 0) && (
              <div className="mb-6">
                <div className="text-[12px] font-semibold text-ink mb-1">Product Gallery</div>
                <div className="text-[11px] text-steel mb-3">Upload multiple images (JPEG, PNG, WebP up to 5 MB). The first image will be set as primary.</div>
                
                <div className="flex flex-wrap items-start gap-4">
                  {/* Existing Images */}
                  {!isNew && prod?.images?.map((img, idx) => (
                    <div key={img.id} className="relative group w-24 h-24 rounded-lg border-[0.5px] border-rule bg-paper2 overflow-hidden flex-shrink-0">
                      <img src={assetUrl(img.url)} alt={`${prod?.name} ${idx}`} className="w-full h-full object-cover" />
                      {img.is_primary && (
                        <div className="absolute top-1 left-1 bg-rust text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          Primary
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Local Selected Image Preview for New/Edit */}
                  {selectedFile && (
                    <div className="relative group w-24 h-24 rounded-lg border-[0.5px] border-rust bg-paper2 overflow-hidden flex-shrink-0">
                      <img src={imagePreview} alt="Selected preview" className="w-full h-full object-cover" />
                      <div className="absolute top-1 left-1 bg-rust text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                        To Upload
                      </div>
                    </div>
                  )}

                  {/* Upload Button Box */}
                  {isEditing && (
                    <div
                      className="w-24 h-24 rounded-lg border-[0.5px] border-dashed border-steel bg-paper2 flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:border-rust group transition-colors flex-shrink-0"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <Camera size={24} className="text-steel group-hover:text-rust transition-colors mb-1" />
                      <span className="text-[10px] text-steel group-hover:text-rust font-medium">Add Photo</span>
                    </div>
                  )}
                </div>

                {isEditing && (
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                )}
                
                {imageMutation.isPending && (
                  <div className="text-[12px] text-rust mt-2">Uploading image...</div>
                )}
              </div>
            )}

            <fieldset disabled={!isEditing}>
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
            </fieldset>
          </div>

          {/* Inventory Breakdown */}
          {!isNew && breakdown?.breakdown && (
            <div className="card p-6 mt-4">
              <h3 className="text-sm font-semibold text-ink mb-4">Inventory Breakdown</h3>
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b-[0.5px] border-rule text-steel">
                    <th className="py-2 font-medium">Location</th>
                    <th className="py-2 font-medium">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.breakdown.map((b, i) => (
                    <tr key={i} className="border-b-[0.5px] border-rule/50 last:border-0">
                      <td className="py-2">{b.location_name || 'Main Warehouse'}</td>
                      <td className="py-2 font-mono">{b.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Material Traceability */}
          {!isNew && <MaterialTraceability productId={id} />}
        </FormShell.Body>

        <FormShell.Side>
          {!isEditing ? (
            <button type="button" className="btn justify-center" onClick={() => setIsEditing(true)}>
              Edit Product
            </button>
          ) : (
            <button className="btn btn-rust justify-center" onClick={form.handleSubmit(onSubmit)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Product'}
            </button>
          )}
          
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
