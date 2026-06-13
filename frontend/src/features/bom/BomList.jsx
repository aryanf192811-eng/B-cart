import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { E } from '../../api/endpoints';
import Toolbar from '../../components/Toolbar';
import DataTable from '../../components/DataTable';

export default function BomList() {
  const navigate = useNavigate();

  const { data: listData, isLoading } = useQuery({
    queryKey: ['boms'],
    queryFn: async () => (await api.get(E.bom())).data
  });

  const columns = [
    { key: 'reference', label: 'REFERENCE', render: (r) => <span className="font-mono">{r.reference || '—'}</span> },
    // Backend field: product_name (not finishedProduct.name)
    { key: 'product_name', label: 'PRODUCT' },
    { key: 'product_sku', label: 'SKU', render: (r) => <span className="font-mono text-[12px]">{r.product_sku}</span> },
    { key: 'qty_produced', label: 'QTY PRODUCED', render: (r) => <span className="font-mono">{r.qty_produced}</span> },
    { key: 'component_count', label: 'COMPONENTS', render: (r) => <span className="font-mono">{r.component_count}</span> },
    { key: 'operation_count', label: 'OPERATIONS', render: (r) => <span className="font-mono">{r.operation_count}</span> },
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      <Toolbar 
        title="Bills of Materials" 
        count={listData?.total || 0}
        actions={<button onClick={() => navigate('/bom/new')} className="btn btn-rust">New</button>}
      />
      <div className="flex-1 bg-white border-[0.5px] border-rule rounded-md overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-auto">
          <DataTable 
            columns={columns}
            rows={listData?.rows || []}
            loading={isLoading}
            onRowClick={(r) => navigate(`/bom/${r.id}`)}
            emptyMessage="No BoMs found."
          />
        </div>
      </div>
    </div>
  );
}
