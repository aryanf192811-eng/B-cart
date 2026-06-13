import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import { Package } from 'lucide-react';

export default function ProductsList() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('grid');

  const { data: listData, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get(E.products())).data
  });

  const rows = listData?.rows || (Array.isArray(listData) ? listData : []);

  const columns = [
    { key: 'sku', label: 'SKU', render: (r) => <span className="font-mono">{r.sku}</span> },
    {
      key: 'name',
      label: 'PRODUCT',
      render: (r) => (
        <div className="flex items-center gap-3">
          {r.imageUrl ? (
            <img src={r.imageUrl} alt={r.name} className="w-8 h-8 rounded-md object-cover border-[0.5px] border-rule" />
          ) : (
            <div className="w-8 h-8 rounded-md bg-paper2 border-[0.5px] border-rule flex items-center justify-center text-[10px] text-steel font-medium">No Img</div>
          )}
          <span className="font-medium text-ink">{r.name}</span>
        </div>
      )
    },
    { key: 'category', label: 'CATEGORY' },
    { key: 'salesPrice', label: 'SALES PRICE', align: 'right', render: (r) => <span className="font-mono">₹ {Number(r.sales_price || r.salesPrice || 0).toFixed(2)}</span> },
    { key: 'costPrice', label: 'COST PRICE', align: 'right', render: (r) => <span className="font-mono">₹ {Number(r.cost_price || r.costPrice || 0).toFixed(2)}</span> },
    { key: 'onHandQty', label: 'ON HAND', align: 'right', render: (r) => <span className="font-mono">{r.on_hand_qty || 0}</span> },
    { key: 'freeToUseQty', label: 'FREE TO USE', align: 'right', render: (r) => <span className="font-mono">{r.free_to_use_qty || ((r.on_hand_qty || 0) - (r.reserved_qty || 0))}</span> },
    { key: 'unitOfMeasure', label: 'UNIT', align: 'right' }
  ];

  const getStockDotClass = (r) => {
    const qty = r.on_hand_qty || 0;
    const min = r.min_stock_qty || 0;
    if (qty <= 0) return 'critical';
    if (qty < min) return 'low';
    return '';
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* ── TOOLBAR ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 500, color: 'var(--on-surface)', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
            Products
          </h1>
          {rows.length > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: '26px', height: '24px', padding: '0 8px',
              background: 'var(--surface-container-high)', color: 'var(--on-surface-variant)',
              borderRadius: '9999px', fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700,
            }}>
              {rows.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Grid / List toggle */}
          <div className="view-toggle-group">
            <button
              className={`btn-icon ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
              aria-label="Grid view"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
            </button>
            <button
              className={`btn-icon ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
              aria-label="List view"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
          </div>

          <button onClick={() => navigate('/products/new')} className="btn btn-rust">
            + New Product
          </button>
        </div>
      </div>

      {/* ── GRID VIEW ── */}
      {viewMode === 'grid' && (
        <>
          {isLoading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-sans)', fontSize: '14px' }}>
              Loading products...
            </div>
          ) : rows.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', color: 'var(--on-surface-variant)', gap: '12px' }}>
              <Package size={40} style={{ opacity: 0.3 }} />
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px' }}>No products found.</p>
            </div>
          ) : (
            <div className="products-grid animate-in">
              {rows.map((r) => {
                const dotClass = getStockDotClass(r);
                return (
                  <div
                    key={r.id || r._id}
                    className="product-card"
                    onClick={() => navigate(`/products/${r._id || r.id}`)}
                  >
                    <div className="product-card__image">
                      {r.imageUrl ? (
                        <img src={r.imageUrl} alt={r.name} />
                      ) : (
                        <div className="product-card__image product-card__image--empty" style={{ display: 'flex' }}>
                          <Package size={36} style={{ opacity: 0.25 }} />
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--outline)', letterSpacing: '0.05em' }}>No Image</span>
                        </div>
                      )}
                      <span className="product-card__sku">{r.sku}</span>
                    </div>
                    <div className="product-card__body">
                      <div className="product-card__name">{r.name}</div>
                      {(r.category || r.category_name) && (
                        <span className="product-card__category">{r.category || r.category_name}</span>
                      )}
                      <div className="product-card__stock">
                        <span className={`product-card__stock-dot ${dotClass}`} />
                        <span>{r.on_hand_qty || 0} {r.unit || ''} on hand</span>
                      </div>
                      <div className="product-card__pricing">
                        <span className="product-card__sales-price">₹{Number(r.sales_price || r.salesPrice || 0).toFixed(2)}</span>
                        <span className="product-card__cost-price">₹{Number(r.cost_price || r.costPrice || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── LIST VIEW (original table) ── */}
      {viewMode === 'list' && (
        <div className="flex-1 border-[0.5px] border-rule rounded-2xl overflow-hidden flex flex-col min-h-[400px]" style={{ background: 'var(--surface-container-lowest)', boxShadow: 'var(--shadow-md)' }}>
          <div className="flex-1 overflow-auto">
            <DataTable
              columns={columns}
              rows={rows}
              loading={isLoading}
              onRowClick={(r) => navigate(`/products/${r._id || r.id}`)}
              emptyMessage="No products found."
            />
          </div>
        </div>
      )}
    </div>
  );
}
