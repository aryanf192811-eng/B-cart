import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import Toolbar from '../../components/Toolbar';
import DataTable from '../../components/DataTable';

export default function ProductsList() {
  const navigate = useNavigate();

  const { data: listData, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get(E.products())).data
  });

  const columns = [
    { key: 'sku', label: 'SKU', render: (r) => <span className="font-mono">{r.sku}</span> },
    { 
      key: 'name', 
      label: 'PRODUCT',
      render: (r) => (
        <div className="flex items-center gap-3">
          {r.imageUrl ? (
            <img src={r.imageUrl} alt={r.name} className="w-8 h-8 rounded object-cover bg-white border-[0.5px] border-rule" />
          ) : (
            <div className="w-8 h-8 rounded bg-paper2 border-[0.5px] border-rule flex items-center justify-center text-[10px] text-steel font-medium">No Img</div>
          )}
          <span className="font-medium text-ink">{r.name}</span>
        </div>
      )
    },
    { key: 'category', label: 'CATEGORY' },
    { key: 'salesPrice', label: 'SALES PRICE', align: 'right', render: (r) => <span className="font-mono">₹ {(r.salesPrice || 0).toFixed(2)}</span> },
    { key: 'costPrice', label: 'COST PRICE', align: 'right', render: (r) => <span className="font-mono">₹ {(r.costPrice || 0).toFixed(2)}</span> },
    { key: 'onHandQty', label: 'ON HAND', align: 'right', render: (r) => <span className="font-mono">{r.onHandQty || 0}</span> },
    { key: 'freeToUseQty', label: 'FREE TO USE', align: 'right', render: (r) => <span className="font-mono">{r.freeToUseQty || (r.onHandQty - (r.reservedQty || 0))}</span> },
    { key: 'unitOfMeasure', label: 'UNIT', align: 'right' }
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      <Toolbar 
        title="Products" 
        actions={<button onClick={() => navigate('/products/new')} className="btn btn-rust">New</button>}
      />
      <div className="flex-1 bg-white border-[0.5px] border-rule rounded-md overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-auto">
          <DataTable 
            columns={columns}
            rows={listData}
            loading={isLoading}
            onRowClick={(r) => navigate(`/products/${r._id || r.id}`)}
            emptyMessage="No products found."
          />
        </div>
      </div>
    </div>
  );
}
